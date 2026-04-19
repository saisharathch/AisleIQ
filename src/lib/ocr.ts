import Anthropic from '@anthropic-ai/sdk'
import type { ParsedReceipt, ParsedReceiptItem } from '@/types'

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
const OCR_MODEL = process.env.ANTHROPIC_OCR_MODEL ?? 'claude-haiku-4-5-20251001'
const OCR_MAX_TOKENS = parseInt(process.env.ANTHROPIC_OCR_MAX_TOKENS ?? '2500', 10)

const RECEIPT_SYSTEM_PROMPT = `You are an expert grocery receipt OCR parser. Extract structured data from receipt images with high accuracy.

Rules:
- Detect the store name from the header.
- Detect the purchase date when present. Use ISO 8601 format if you can infer it reliably.
- Parse each purchased item into: item name, quantity, unit price, line total, tax.
- If quantity or unit price is missing but line total is present, infer carefully. Set confidence < 0.7 if unsure.
- Preserve the original item name abbreviations alongside a readable interpretation.
- Detect summary fields: subtotal, total tax, discount/savings, grand total.
- For weighted items (e.g. "1.52 lb @ $0.58/lb"), capture decimal quantity and per-unit price.
- Return confidence per item: 1.0 = very sure, 0.7 = reasonably sure, <0.7 = uncertain / needs review.
- Set needsReview = true when confidence < 0.7 or when a key field is inferred.
- TAX PER ITEM: Many receipts print a tax code at the end of each line (e.g. "N" = non-taxable, "X" or "T" = taxable, "O" = non-taxable, blank = taxable).
  - If a tax rate is shown in the receipt summary (e.g. "TAX 1 7.000%"), calculate each taxable item's tax as: lineTotal * taxRate.
  - Set tax = calculated amount (rounded to 2 decimals) for taxable items.
  - Set tax = 0 for items explicitly marked non-taxable (N, O, etc.).
  - Set tax = null only when you cannot determine taxability at all.

Return ONLY a valid JSON object matching this schema exactly:
{
  "storeName": string | null,
  "purchaseDate": string | null,
  "items": [
    {
      "item": string,
      "quantity": number | null,
      "unitPrice": number | null,
      "lineTotal": number | null,
      "tax": number | null,
      "confidence": number,
      "needsReview": boolean,
      "sourceText": string
    }
  ],
  "subtotal": number | null,
  "totalTax": number | null,
  "discount": number | null,
  "grandTotal": number | null,
  "rawText": string
}`

export async function parseReceiptFromBase64(
  base64: string,
  mimeType: 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp',
): Promise<ParsedReceipt> {
  const response = await client.messages.create({
    model: OCR_MODEL,
    max_tokens: OCR_MAX_TOKENS,
    system: RECEIPT_SYSTEM_PROMPT,
    messages: [
      {
        role: 'user',
        content: [
          {
            type: 'image',
            source: { type: 'base64', media_type: mimeType, data: base64 },
          },
          {
            type: 'text',
            text: 'Parse this grocery receipt and return the structured JSON. Be precise with numbers.',
          },
        ],
      },
    ],
  })

  const textBlock = response.content.find((b) => b.type === 'text')
  if (!textBlock || textBlock.type !== 'text') {
    throw new Error('No text response from OCR model')
  }

  return parseOcrResponse(textBlock.text)
}

export async function parseReceiptFromText(rawText: string): Promise<ParsedReceipt> {
  const response = await client.messages.create({
    model: OCR_MODEL,
    max_tokens: OCR_MAX_TOKENS,
    system: RECEIPT_SYSTEM_PROMPT,
    messages: [
      {
        role: 'user',
        content: `Parse this grocery receipt text and return the structured JSON:\n\n${rawText}`,
      },
    ],
  })

  const textBlock = response.content.find((b) => b.type === 'text')
  if (!textBlock || textBlock.type !== 'text') {
    throw new Error('No text response from OCR model')
  }

  return parseOcrResponse(textBlock.text)
}

function parseOcrResponse(raw: string): ParsedReceipt {
  // Extract JSON from the response (model may wrap it in markdown code blocks)
  const jsonMatch = raw.match(/```(?:json)?\s*([\s\S]*?)\s*```/) || raw.match(/(\{[\s\S]*\})/)
  const jsonStr = jsonMatch ? jsonMatch[1] : raw.trim()

  const parsed = JSON.parse(jsonStr)

  const items: ParsedReceiptItem[] = (parsed.items ?? []).map(
    (item: Partial<ParsedReceiptItem>) => ({
      item: item.item ?? 'Unknown Item',
      quantity: item.quantity ?? null,
      unitPrice: item.unitPrice ?? null,
      lineTotal: item.lineTotal ?? null,
      tax: item.tax ?? null,
      confidence: typeof item.confidence === 'number' ? item.confidence : 1.0,
      needsReview: item.needsReview ?? false,
      sourceText: item.sourceText ?? undefined,
    }),
  )

  return {
    storeName: parsed.storeName ?? null,
    purchaseDate: parsed.purchaseDate ?? null,
    items,
    subtotal: parsed.subtotal ?? null,
    totalTax: parsed.totalTax ?? null,
    discount: parsed.discount ?? null,
    grandTotal: parsed.grandTotal ?? null,
    rawText: parsed.rawText ?? '',
    confidence: items.length > 0 ? items.reduce((s, i) => s + i.confidence, 0) / items.length : 0,
  }
}

export function normalizeMediaType(
  mimeType: string,
): 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp' {
  const map: Record<string, 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp'> = {
    'image/jpeg': 'image/jpeg',
    'image/jpg': 'image/jpeg',
    'image/heic': 'image/jpeg', // will be converted by sharp
    'image/heif': 'image/jpeg',
    'image/png': 'image/png',
    'image/gif': 'image/gif',
    'image/webp': 'image/webp',
  }
  return map[mimeType.toLowerCase()] ?? 'image/jpeg'
}
