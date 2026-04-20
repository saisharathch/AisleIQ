import { db } from './db'
import { getGoogleSheetsOwnerEmail } from './env'

const SHEETS_BASE = 'https://sheets.googleapis.com/v4/spreadsheets'
const TOKEN_ENDPOINT = 'https://oauth2.googleapis.com/token'
const SPREADSHEET_NAME = 'Grocery Expense Tracker'

export const ITEM_CATEGORIES = [
  'Produce', 'Dairy', 'Meat', 'Bakery', 'Frozen',
  'Snacks', 'Beverages', 'Household', 'Personal Care', 'Other',
] as const

export type ItemCategory = typeof ITEM_CATEGORIES[number]

const CATEGORY_KEYWORDS: Record<string, string[]> = {
  // Beverages must be checked before Produce so "orange juice" / "grape juice" etc.
  // match "juice" here rather than "orange" / "grape" in Produce.
  Beverages: ['juice', 'oj', ' ade', 'soda', 'water', 'coffee', 'tea', 'drink', 'beverage', 'wine', 'beer', 'folgers', 'lemonade', 'gatorade', 'powerade', 'energy', 'kombucha', 'cider', 'punch', 'kool', 'crystal light'],
  Produce: ['apple', 'banana', 'lettuce', 'tomato', 'onion', 'potato', 'carrot', 'broccoli', 'spinach', 'pepper', 'cucumber', 'celery', 'garlic', 'lemon', 'lime', 'grape', 'berry', 'avocado', 'mushroom', 'salad', 'kale', 'zucchini', 'corn', 'melon', 'mango', 'pineapple', 'peach', 'plum', 'pear', 'cilantro', 'parsley', 'radish'],
  Dairy: ['milk', 'cheese', 'butter', 'yogurt', 'cream', 'egg', 'parm', 'mozzarella', 'cheddar', 'cottage', 'sour cream', 'half and half', 'creamer', 'whip', 'dairy'],
  Meat: ['chicken', 'beef', 'pork', 'turkey', 'fish', 'salmon', 'tuna', 'shrimp', 'bacon', 'sausage', 'ham', 'steak', 'ground', 'deli', 'chkn', 'chnk chkn', 'tilapia', 'cod', 'crab', 'lobster', 'lamb'],
  Bakery: ['bread', 'bagel', 'muffin', 'cake', 'roll', 'tortilla', 'bun', 'croissant', 'donut', 'pie', 'cookie', 'cracker', 'biscuit', 'loaf'],
  Frozen: ['frozen', 'ice cream', 'pizza', 'waffle', 'nugget', 'fries', 'edamame', 'frost', 'gelato', 'sorbet'],
  Snacks: ['chip', 'popcorn', 'pretzel', 'granola', 'nuts', 'candy', 'chocolate', 'gummy', 'trail mix', 'jerky', 'peanut butter', 'pnt butt', 'snack'],
  Household: ['paper', 'towel', 'tissue', 'soap', 'detergent', 'cleaner', 'trash', 'bag', 'foil', 'wrap', 'glove', 'sponge', 'nitrile', 'nitril', 'bleach', 'mop', 'broom', 'laundry'],
  'Personal Care': ['shampoo', 'conditioner', 'toothpaste', 'razor', 'lotion', 'deodorant', 'body wash', 'face wash', 'vitamin', 'supplement', 'medicine', 'bandage'],
}

export function categorizeItem(itemName: string): ItemCategory {
  const lower = itemName.toLowerCase()
  for (const [category, keywords] of Object.entries(CATEGORY_KEYWORDS)) {
    if (keywords.some((keyword) => lower.includes(keyword))) return category as ItemCategory
  }
  return 'Other'
}

export async function getSheetsOwnerUser() {
  const ownerEmail = getGoogleSheetsOwnerEmail()
  if (!ownerEmail) return null

  return db.user.findUnique({
    where: { email: ownerEmail },
    select: { id: true, email: true, sheetsSpreadsheetId: true },
  })
}

async function refreshAccessToken(refreshToken: string): Promise<{ access_token: string; expires_at: number }> {
  const res = await fetch(TOKEN_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: process.env.GOOGLE_CLIENT_ID ?? '',
      client_secret: process.env.GOOGLE_CLIENT_SECRET ?? '',
      refresh_token: refreshToken,
      grant_type: 'refresh_token',
    }),
  })

  const body = await res.json().catch(() => ({})) as Record<string, string>

  if (!res.ok) {
    const detail = body.error_description ?? body.error ?? `HTTP ${res.status}`
    console.error('[sheets] Token refresh failed:', detail)
    if (body.error === 'invalid_grant') throw new Error('GOOGLE_AUTH_EXPIRED')
    throw new Error(`Token refresh failed: ${detail}`)
  }

  if (!body.access_token || typeof body.expires_in === 'undefined') {
    throw new Error('Token refresh returned an incomplete response from Google')
  }

  return {
    access_token: body.access_token,
    expires_at: Math.floor(Date.now() / 1000) + Number(body.expires_in),
  }
}

export async function getValidAccessToken(userId: string): Promise<string> {
  const account = await db.account.findFirst({
    where: { userId, provider: 'google' },
  })
  if (!account?.access_token) throw new Error('GOOGLE_NOT_CONNECTED')

  const hasScope = account.scope?.includes('spreadsheets') ?? false
  if (!hasScope) throw new Error('SHEETS_SCOPE_MISSING')

  const now = Math.floor(Date.now() / 1000)
  if (account.expires_at && account.expires_at > now + 60) {
    return account.access_token
  }

  if (!account.refresh_token) throw new Error('NO_REFRESH_TOKEN')

  const { access_token, expires_at } = await refreshAccessToken(account.refresh_token)
  await db.account.update({ where: { id: account.id }, data: { access_token, expires_at } })
  return access_token
}

async function sheetsRequest(method: string, url: string, token: string, body?: unknown) {
  const res = await fetch(url, {
    method,
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: body != null ? JSON.stringify(body) : undefined,
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    const status = res.status
    if (status === 401) throw new Error('GOOGLE_AUTH_EXPIRED')
    if (status === 403) throw new Error('PERMISSION_DENIED')
    if (status === 404) throw new Error('SHEET_NOT_FOUND')
    throw new Error((err as { error?: { message?: string } }).error?.message ?? `Sheets API error ${status}`)
  }
  return res.json().catch(() => ({}))
}

async function createSpreadsheet(token: string): Promise<string> {
  const spreadsheet = await sheetsRequest('POST', SHEETS_BASE, token, {
    properties: { title: SPREADSHEET_NAME },
    sheets: [
      { properties: { title: 'Receipts', sheetId: 0, index: 0 } },
      { properties: { title: 'Monthly Summary', sheetId: 1, index: 1 } },
    ],
  })

  const id: string = spreadsheet.spreadsheetId

  await sheetsRequest(
    'PUT',
    `${SHEETS_BASE}/${id}/values/Receipts!A1:L1?valueInputOption=USER_ENTERED`,
    token,
    { values: [['Receipt ID', 'Date', 'Store Name', 'Item Name', 'Category', 'Quantity', 'Price', 'Line Total', 'Tax', 'Total Receipt Amount', 'Payment Method', 'Notes']] },
  )
  await sheetsRequest(
    'PUT',
    `${SHEETS_BASE}/${id}/values/Monthly Summary!A1:C1?valueInputOption=USER_ENTERED`,
    token,
    { values: [['Month', 'Category', 'Total Spent']] },
  )

  await sheetsRequest('POST', `${SHEETS_BASE}/${id}:batchUpdate`, token, {
    requests: [0, 1].map((sheetId) => ({
      repeatCell: {
        range: { sheetId, startRowIndex: 0, endRowIndex: 1 },
        cell: {
          userEnteredFormat: {
            textFormat: { bold: true, foregroundColor: { red: 1, green: 1, blue: 1 } },
            backgroundColor: { red: 0.13, green: 0.77, blue: 0.37 },
          },
        },
        fields: 'userEnteredFormat(textFormat,backgroundColor)',
      },
    })),
  })

  return id
}

export interface SheetReceiptRow {
  receiptId: string
  date: string
  storeName: string
  item: string
  category: string
  quantity: number | null
  price: number | null
  lineTotal: number | null
  tax: number | null
  grandTotal: number | null
  paymentMethod: string
  notes: string
}

export async function uploadReceiptToSheets(
  googleAccountUserId: string,
  existingSpreadsheetId: string | null,
  rows: SheetReceiptRow[],
): Promise<string> {
  const token = await getValidAccessToken(googleAccountUserId)

  let sheetId = existingSpreadsheetId

  if (sheetId) {
    try {
      await sheetsRequest('GET', `${SHEETS_BASE}/${sheetId}?fields=spreadsheetId`, token)
    } catch (err) {
      if ((err as Error).message === 'SHEET_NOT_FOUND') sheetId = null
      else throw err
    }
  }

  if (!sheetId) sheetId = await createSpreadsheet(token)

  await replaceExistingReceiptRows(sheetId, token, rows)

  await sheetsRequest(
    'POST',
    `${SHEETS_BASE}/${sheetId}/values/Receipts!A:L:append?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS`,
    token,
    {
      values: rows.map((row) => [
        row.receiptId,
        row.date,
        row.storeName,
        row.item,
        row.category,
        row.quantity ?? '',
        row.price ?? '',
        row.lineTotal ?? '',
        row.tax ?? '',
        row.grandTotal ?? '',
        row.paymentMethod,
        row.notes,
      ]),
    },
  )

  await updateMonthlySummary(sheetId, token, rows)

  return sheetId
}

async function updateMonthlySummary(spreadsheetId: string, token: string, rows: SheetReceiptRow[]) {
  const incoming: Record<string, Record<string, number>> = {}
  for (const row of rows) {
    const date = new Date(row.date)
    const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
    const category = row.category || 'Other'
    incoming[monthKey] ??= {}
    incoming[monthKey][category] = ((incoming[monthKey][category] ?? 0) + (row.lineTotal ?? 0))
  }

  const receiptsData = await sheetsRequest(
    'GET',
    `${SHEETS_BASE}/${spreadsheetId}/values/Receipts!A2:L?majorDimension=ROWS`,
    token,
  ).catch(() => ({ values: [] }))

  const summaryMap: Record<string, Record<string, number>> = {}
  for (const row of (receiptsData.values ?? []) as string[][]) {
    const [, dateValue, , , category, , , lineTotal] = row
    if (!dateValue || !category) continue
    const date = new Date(dateValue)
    if (Number.isNaN(date.getTime())) continue
    const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
    summaryMap[monthKey] ??= {}
    summaryMap[monthKey][category] = (summaryMap[monthKey][category] ?? 0) + (parseFloat(lineTotal ?? '0') || 0)
  }

  const outputRows: (string | number)[][] = []
  const months = Object.keys(summaryMap).sort((a, b) => b.localeCompare(a))

  for (const month of months) {
    const categories = summaryMap[month]
    const categoryEntries = Object.entries(categories).sort(([a], [b]) => a.localeCompare(b))
    let monthTotal = 0
    for (const [category, amount] of categoryEntries) {
      const roundedAmount = round2(amount)
      outputRows.push([month, category, roundedAmount])
      monthTotal += roundedAmount
    }
    outputRows.push([month, 'TOTAL', round2(monthTotal)])
    outputRows.push(['', '', ''])
  }

  await sheetsRequest(
    'PUT',
    `${SHEETS_BASE}/${spreadsheetId}/values/Monthly Summary!A2:C?valueInputOption=USER_ENTERED`,
    token,
    { values: outputRows.length > 0 ? outputRows : [['', '', '']] },
  )
}

async function replaceExistingReceiptRows(spreadsheetId: string, token: string, rows: SheetReceiptRow[]) {
  const receiptIds = Array.from(new Set(rows.map((row) => row.receiptId)))
  if (receiptIds.length === 0) return

  const existing = await sheetsRequest(
    'GET',
    `${SHEETS_BASE}/${spreadsheetId}/values/Receipts!A2:L?majorDimension=ROWS`,
    token,
  ).catch(() => ({ values: [] }))

  const keptRows = ((existing.values ?? []) as string[][]).filter((row) => !receiptIds.includes(row[0] ?? ''))

  await sheetsRequest(
    'POST',
    `${SHEETS_BASE}/${spreadsheetId}/values/Receipts!A2:L:clear`,
    token,
    {},
  )

  if (keptRows.length === 0) return

  await sheetsRequest(
    'PUT',
    `${SHEETS_BASE}/${spreadsheetId}/values/Receipts!A2:L?valueInputOption=USER_ENTERED`,
    token,
    { values: keptRows },
  )
}

function round2(n: number) {
  return Math.round((n + Number.EPSILON) * 100) / 100
}
