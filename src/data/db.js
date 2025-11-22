import Dexie from 'dexie'

export const db = new Dexie('sj_fact_db')

db.version(1).stores({
  customers: '++id, name, taxId, email',
  products: '++id, name, sku',
  priceLists: '++id, name, currency',
  prices: '++id, listId, productId, price',
  invoices: '++id, number, customerId, date, total',
  invoiceItems: '++id, invoiceId, productId, qty, unitPrice, total',
  ledger: '++id, customerId, date, type, amount, reference',
})

// Versión 2: Papelera de reciclaje para comprobantes (30 días)
db.version(2).stores({
  trash: '++id, type, reference, deletedAt, purgeAt',
})

// Versión 3: Configuración de márgenes para Calculadora de precios
db.version(3).stores({
  calcLists: '++id, name, marginPct'
})

// Versión 4: Configuración de calculadora (costos adicionales)
db.version(4).stores({
  calcConfig: 'id'
})

// Versión 5: Compras y Proveedores
db.version(5).stores({
  suppliers: '++id, name, taxId, email, taxPct',
  purchases: '++id, number, supplierId, date, total, taxPct',
  purchaseItems: '++id, purchaseId, productId, qty, unitCost, taxes, totalCost'
})

// Seed inicial mínimo
async function ensureSeed() {
  const count = await db.products.count()
  if (count === 0) {
    await db.products.bulkAdd([
      { name: 'Producto A', sku: 'A-001' },
      { name: 'Producto B', sku: 'B-002' },
      { name: 'Servicio C', sku: 'S-003' },
    ])
  }
  const plCount = await db.priceLists.count()
  if (plCount === 0) {
    const listId = await db.priceLists.add({ name: 'General', currency: 'ARS' })
    const prods = await db.products.toArray()
    await db.prices.bulkAdd(
      prods.map((p, i) => ({ listId, productId: p.id, price: 1000 + i * 250 }))
    )
  }
}

ensureSeed()