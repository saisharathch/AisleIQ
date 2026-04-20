import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

async function main() {
  if (process.env.SEED_DEMO_DATA !== 'true') {
    console.log('Skipping demo seed data. Set SEED_DEMO_DATA=true if you want sample users and receipts.')
    return
  }

  console.log('Seeding database...')

  // Admin user
  const adminPassword = await bcrypt.hash('Admin@1234', 12)
  const admin = await prisma.user.upsert({
    where: { email: 'admin@grocerybill.app' },
    update: {},
    create: {
      name: 'Admin',
      email: 'admin@grocerybill.app',
      password: adminPassword,
      role: 'admin',
      emailVerified: new Date(),
    },
  })

  // Demo user
  const demoPassword = await bcrypt.hash('Demo@1234', 12)
  const demoUser = await prisma.user.upsert({
    where: { email: 'demo@grocerybill.app' },
    update: {},
    create: {
      name: 'Demo User',
      email: 'demo@grocerybill.app',
      password: demoPassword,
      role: 'user',
      emailVerified: new Date(),
    },
  })

  // Sample receipt 1 — Walmart
  const receipt1 = await prisma.receipt.create({
    data: {
      userId: demoUser.id,
      storeName: 'Walmart Supercenter',
      fileUrl: '/uploads/sample-walmart-receipt.jpg',
      fileType: 'image/jpeg',
      fileName: 'walmart-receipt-2024.jpg',
      fileSize: 245000,
      status: 'done',
      purchaseDate: new Date(),
      overallConfidence: 0.93,
      reviewStatus: 'approved',
      reviewedAt: new Date(),
      syncStatus: 'synced',
      ocrRawText: 'WALMART SUPERCENTER\n1234 Main St\nSpringfield IL\n...',
      subtotal: 42.87,
      totalTax: 3.43,
      discount: 2.50,
      grandTotal: 43.80,
      processedAt: new Date(),
      items: {
        create: [
          {
            store: 'Walmart Supercenter',
            item: 'Great Value Whole Milk 1 Gal',
            category: 'Dairy',
            quantity: 2,
            unitPrice: 3.98,
            lineTotal: 7.96,
            tax: 0,
            confidence: 0.98,
            sortOrder: 0,
          },
          {
            store: 'Walmart Supercenter',
            item: 'Bananas',
            category: 'Produce',
            quantity: 1.52,
            unitPrice: 0.58,
            lineTotal: 0.88,
            tax: 0,
            confidence: 0.85,
            sortOrder: 1,
            sourceText: 'BANANAS 1.52 lb @ $0.58/lb',
          },
          {
            store: 'Walmart Supercenter',
            item: 'Sara Lee Bread White 20oz',
            category: 'Bakery',
            quantity: 1,
            unitPrice: 2.98,
            lineTotal: 2.98,
            tax: 0,
            confidence: 0.95,
            sortOrder: 2,
          },
          {
            store: 'Walmart Supercenter',
            item: 'Chicken Breast Boneless Skinless',
            category: 'Meat',
            quantity: 2.1,
            unitPrice: 4.99,
            lineTotal: 10.48,
            tax: 0,
            confidence: 0.92,
            sortOrder: 3,
          },
          {
            store: 'Walmart Supercenter',
            item: 'Tide Laundry Detergent 64oz',
            category: 'Household',
            quantity: 1,
            unitPrice: 11.97,
            lineTotal: 11.97,
            tax: 1.08,
            confidence: 0.99,
            sortOrder: 4,
          },
          {
            store: 'Walmart Supercenter',
            item: 'Great Value Eggs Large 12ct',
            category: 'Dairy',
            quantity: 1,
            unitPrice: 3.48,
            lineTotal: 3.48,
            tax: 0,
            confidence: 0.97,
            sortOrder: 5,
          },
          {
            store: 'Walmart Supercenter',
            item: 'Prego Pasta Sauce Traditional',
            category: 'Other',
            quantity: 1,
            unitPrice: 2.98,
            lineTotal: 2.98,
            tax: 0.27,
            confidence: 0.93,
            sortOrder: 6,
          },
          {
            store: 'Walmart Supercenter',
            item: 'GV Orange Juice 52oz',
            category: 'Beverages',
            quantity: 1,
            unitPrice: 3.48,
            lineTotal: 3.48,
            tax: 0,
            confidence: 0.88,
            needsReview: true,
            sourceText: 'GV OJ 52OZ 3.48',
            sortOrder: 7,
          },
        ],
      },
    },
  })

  // Sample receipt 2 — Trader Joe's
  const receipt2 = await prisma.receipt.create({
    data: {
      userId: demoUser.id,
      storeName: "Trader Joe's",
      fileUrl: '/uploads/sample-traderjoes-receipt.jpg',
      fileType: 'image/jpeg',
      fileName: 'traderjoes-receipt.jpg',
      fileSize: 198000,
      status: 'done',
      purchaseDate: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000),
      overallConfidence: 0.95,
      reviewStatus: 'approved',
      reviewedAt: new Date(),
      syncStatus: 'not_synced',
      subtotal: 28.45,
      totalTax: 1.14,
      grandTotal: 29.59,
      processedAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000), // 3 days ago
      uploadDate: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000),
      items: {
        create: [
          {
            store: "Trader Joe's",
            item: 'Organic Cage Free Brown Eggs',
            category: 'Dairy',
            quantity: 1,
            unitPrice: 3.99,
            lineTotal: 3.99,
            tax: 0,
            confidence: 0.96,
            sortOrder: 0,
          },
          {
            store: "Trader Joe's",
            item: 'Everything But The Bagel Seasoning',
            category: 'Other',
            quantity: 1,
            unitPrice: 1.99,
            lineTotal: 1.99,
            tax: 0.18,
            confidence: 0.98,
            sortOrder: 1,
          },
          {
            store: "Trader Joe's",
            item: 'Mandarin Orange Chicken',
            category: 'Frozen',
            quantity: 1,
            unitPrice: 5.99,
            lineTotal: 5.99,
            tax: 0,
            confidence: 0.99,
            sortOrder: 2,
          },
          {
            store: "Trader Joe's",
            item: 'Organic Whole Milk Greek Yogurt',
            category: 'Dairy',
            quantity: 2,
            unitPrice: 2.49,
            lineTotal: 4.98,
            tax: 0,
            confidence: 0.94,
            sortOrder: 3,
          },
          {
            store: "Trader Joe's",
            item: 'Dark Chocolate Peanut Butter Cups',
            category: 'Snacks',
            quantity: 1,
            unitPrice: 2.99,
            lineTotal: 2.99,
            tax: 0.27,
            confidence: 0.91,
            sortOrder: 4,
          },
          {
            store: "Trader Joe's",
            item: 'Cauliflower Gnocchi',
            category: 'Frozen',
            quantity: 2,
            unitPrice: 2.99,
            lineTotal: 5.98,
            tax: 0,
            confidence: 0.97,
            sortOrder: 5,
          },
          {
            store: "Trader Joe's",
            item: 'TJ Mixed Greens Salad',
            category: 'Produce',
            quantity: 1,
            unitPrice: 3.49,
            lineTotal: 3.49,
            tax: 0,
            confidence: 0.89,
            sortOrder: 6,
          },
        ],
      },
    },
  })

  // Parse logs
  await prisma.parseLog.createMany({
    data: [
      { receiptId: receipt1.id, success: true, duration: 3420, model: 'claude-opus-4-7' },
      { receiptId: receipt2.id, success: true, duration: 2890, model: 'claude-opus-4-7' },
    ],
  })

  console.log(`Seeded:
  - Admin: admin@grocerybill.app / Admin@1234
  - Demo:  demo@grocerybill.app  / Demo@1234
  - ${await prisma.receipt.count()} receipts
  - ${await prisma.receiptItem.count()} receipt items`)
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
