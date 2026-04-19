import { db } from './db'
import { ITEM_CATEGORIES, categorizeItem, type ItemCategory } from './google-sheets'

type CategoryPreferenceRepo = Pick<typeof db, 'categoryPreference'>

export function normalizeItemName(itemName: string) {
  return itemName
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\b\d+(\.\d+)?\s?(oz|lb|ct|pk|gal|ml|l)\b/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

export async function learnCategoryPreference(
  userId: string,
  itemName: string,
  category: string | null | undefined,
  repo: CategoryPreferenceRepo = db,
) {
  if (!category || !ITEM_CATEGORIES.includes(category as ItemCategory)) return

  const normalizedName = normalizeItemName(itemName)
  if (!normalizedName) return

  await repo.categoryPreference.upsert({
    where: {
      userId_normalizedName: {
        userId,
        normalizedName,
      },
    },
    update: {
      category,
      usageCount: { increment: 1 },
      lastUsedAt: new Date(),
    },
    create: {
      userId,
      normalizedName,
      category,
      usageCount: 1,
      lastUsedAt: new Date(),
    },
  })
}

export async function predictLearnedCategory(
  userId: string,
  itemName: string,
  repo: CategoryPreferenceRepo = db,
): Promise<string> {
  const normalizedName = normalizeItemName(itemName)
  if (normalizedName) {
    const learned = await repo.categoryPreference.findUnique({
      where: {
        userId_normalizedName: {
          userId,
          normalizedName,
        },
      },
    })
    if (learned?.category) return learned.category
  }

  return categorizeItem(itemName)
}
