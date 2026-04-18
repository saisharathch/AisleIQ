import { db } from './db'

const SHEETS_BASE = 'https://sheets.googleapis.com/v4/spreadsheets'
const TOKEN_ENDPOINT = 'https://oauth2.googleapis.com/token'
const SPREADSHEET_NAME = 'Grocery Expense Tracker'

export const ITEM_CATEGORIES = [
  'Produce', 'Dairy', 'Meat', 'Bakery', 'Frozen',
  'Snacks', 'Beverages', 'Household', 'Personal Care', 'Other',
] as const

export type ItemCategory = typeof ITEM_CATEGORIES[number]

const CATEGORY_KEYWORDS: Record<string, string[]> = {
  Produce: ['apple', 'banana', 'lettuce', 'tomato', 'onion', 'potato', 'carrot', 'broccoli', 'spinach', 'pepper', 'cucumber', 'celery', 'garlic', 'lemon', 'lime', 'orange', 'grape', 'berry', 'avocado', 'mushroom', 'salad', 'kale', 'zucchini', 'corn', 'melon'],
  Dairy: ['milk', 'cheese', 'butter', 'yogurt', 'cream', 'egg', 'parm', 'mozzarella', 'cheddar', 'cottage', 'sour cream', 'half and half', 'creamer', 'whip', 'dairy'],
  Meat: ['chicken', 'beef', 'pork', 'turkey', 'fish', 'salmon', 'tuna', 'shrimp', 'bacon', 'sausage', 'ham', 'steak', 'ground', 'deli', 'chkn', 'chnk chkn', 'tilapia', 'cod', 'crab', 'lobster', 'lamb'],
  Bakery: ['bread', 'bagel', 'muffin', 'cake', 'roll', 'tortilla', 'bun', 'croissant', 'donut', 'pie', 'cookie', 'cracker', 'biscuit', 'loaf'],
  Frozen: ['frozen', 'ice cream', 'pizza', 'waffle', 'nugget', 'fries', 'edamame', 'frost', 'gelato', 'sorbet'],
  Snacks: ['chip', 'popcorn', 'pretzel', 'granola', 'nuts', 'candy', 'chocolate', 'gummy', 'trail mix', 'jerky', 'peanut butter', 'pnt butt', 'snack'],
  Beverages: ['juice', 'soda', 'water', 'coffee', 'tea', 'drink', 'beverage', 'wine', 'beer', 'folgers', 'twist', 'lemonade', 'gatorade', 'energy', 'bottle', 'can soda'],
  Household: ['paper', 'towel', 'tissue', 'soap', 'detergent', 'cleaner', 'trash', 'bag', 'foil', 'wrap', 'glove', 'sponge', 'nitrile', 'nitril', 'bleach', 'mop', 'broom', 'laundry'],
  'Personal Care': ['shampoo', 'conditioner', 'toothpaste', 'razor', 'lotion', 'deodorant', 'body wash', 'face wash', 'vitamin', 'supplement', 'medicine', 'bandage'],
}

export function categorizeItem(itemName: string): ItemCategory {
  const lower = itemName.toLowerCase()
  for (const [category, keywords] of Object.entries(CATEGORY_KEYWORDS)) {
    if (keywords.some((kw) => lower.includes(kw))) return category as ItemCategory
  }
  return 'Other'
}

// ─── Token management ──────────────────────────────────────────────────────

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
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(`Token refresh failed: ${err.error_description ?? err.error}`)
  }
  const data = await res.json()
  return {
    access_token: data.access_token,
    expires_at: Math.floor(Date.now() / 1000) + (data.expires_in as number),
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

// ─── Sheets API helpers ────────────────────────────────────────────────────

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
  return res.json()
}

// ─── Spreadsheet setup ─────────────────────────────────────────────────────

async function createSpreadsheet(token: string): Promise<string> {
  const spreadsheet = await sheetsRequest('POST', SHEETS_BASE, token, {
    properties: { title: SPREADSHEET_NAME },
    sheets: [
      { properties: { title: 'Receipts', sheetId: 0, index: 0 } },
      { properties: { title: 'Monthly Summary', sheetId: 1, index: 1 } },
    ],
  })

  const id: string = spreadsheet.spreadsheetId

  // Write headers
  await sheetsRequest(
    'PUT',
    `${SHEETS_BASE}/${id}/values/Receipts!A1:K1?valueInputOption=USER_ENTERED`,
    token,
    { values: [['Date', 'Store Name', 'Item Name', 'Category', 'Quantity', 'Price', 'Line Total', 'Tax', 'Total Receipt Amount', 'Payment Method', 'Notes']] },
  )
  await sheetsRequest(
    'PUT',
    `${SHEETS_BASE}/${id}/values/Monthly Summary!A1:C1?valueInputOption=USER_ENTERED`,
    token,
    { values: [['Month', 'Category', 'Total Spent']] },
  )

  // Bold + green header rows
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

// ─── Public upload function ────────────────────────────────────────────────

export interface SheetReceiptRow {
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
  userId: string,
  existingSpreadsheetId: string | null,
  rows: SheetReceiptRow[],
): Promise<string> {
  const token = await getValidAccessToken(userId)

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

  await sheetsRequest(
    'POST',
    `${SHEETS_BASE}/${sheetId}/values/Receipts!A:K:append?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS`,
    token,
    {
      values: rows.map((r) => [
        r.date, r.storeName, r.item, r.category,
        r.quantity ?? '', r.price ?? '', r.lineTotal ?? '', r.tax ?? '',
        r.grandTotal ?? '', r.paymentMethod, r.notes,
      ]),
    },
  )

  await updateMonthlySummary(sheetId, token, rows)

  return sheetId
}

// ─── Monthly summary updater ───────────────────────────────────────────────

async function updateMonthlySummary(spreadsheetId: string, token: string, rows: SheetReceiptRow[]) {
  // Aggregate new rows into month/category buckets
  const incoming: Record<string, Record<string, number>> = {}
  for (const row of rows) {
    const d = new Date(row.date)
    const monthKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
    const cat = row.category || 'Other'
    incoming[monthKey] ??= {}
    incoming[monthKey][cat] = ((incoming[monthKey][cat] ?? 0) + (row.lineTotal ?? 0))
  }

  // Read existing summary
  const existing = await sheetsRequest(
    'GET',
    `${SHEETS_BASE}/${spreadsheetId}/values/Monthly Summary!A2:C?majorDimension=ROWS`,
    token,
  ).catch(() => ({ values: [] }))

  const summaryMap: Record<string, Record<string, number>> = {}
  for (const row of (existing.values ?? []) as string[][]) {
    const [month, category, amt] = row
    if (!month || !category || category === 'TOTAL') continue
    summaryMap[month] ??= {}
    summaryMap[month][category] = (summaryMap[month][category] ?? 0) + (parseFloat(amt ?? '0') || 0)
  }

  // Merge
  for (const [month, cats] of Object.entries(incoming)) {
    summaryMap[month] ??= {}
    for (const [cat, amt] of Object.entries(cats)) {
      summaryMap[month][cat] = round2((summaryMap[month][cat] ?? 0) + amt)
    }
  }

  // Build output rows (sorted month desc, category asc) with monthly totals
  const outputRows: (string | number)[][] = []
  const months = Object.keys(summaryMap).sort((a, b) => b.localeCompare(a))

  for (const month of months) {
    const cats = summaryMap[month]
    const catEntries = Object.entries(cats).sort(([a], [b]) => a.localeCompare(b))
    let monthTotal = 0
    for (const [cat, amt] of catEntries) {
      outputRows.push([month, cat, amt])
      monthTotal += amt
    }
    outputRows.push([month, 'TOTAL', round2(monthTotal)])
    outputRows.push(['', '', ''])
  }

  if (outputRows.length === 0) return

  // Clear old summary data and write fresh
  await sheetsRequest(
    'PUT',
    `${SHEETS_BASE}/${spreadsheetId}/values/Monthly Summary!A2:C?valueInputOption=USER_ENTERED`,
    token,
    { values: outputRows },
  )
}

function round2(n: number) {
  return Math.round(n * 100) / 100
}
