// Stub de sincronización local/nube
// Aquí se podría integrar PouchDB/CouchDB para sync bidireccional,
// o clientes como Supabase/Firebase para la capa cloud.
import { db } from './db'
import { pushAll, pullAll } from './cloud/supabase'

export async function exportData() {
  const collections = {
    customers: await db.customers.toArray(),
    products: await db.products.toArray(),
    priceLists: await db.priceLists.toArray(),
    prices: await db.prices.toArray(),
    invoices: await db.invoices.toArray(),
    invoiceItems: await db.invoiceItems.toArray(),
    ledger: await db.ledger.toArray(),
  }
  return JSON.stringify(collections)
}

export async function importData(json) {
  const data = JSON.parse(json)
  // Estrategia simple: vaciar y cargar. En producción usar merges/conflict resolution.
  await db.transaction('rw', db.customers, db.products, db.priceLists, db.prices, db.invoices, db.invoiceItems, db.ledger, async () => {
    await Promise.all([
      db.customers.clear(),
      db.products.clear(),
      db.priceLists.clear(),
      db.prices.clear(),
      db.invoices.clear(),
      db.invoiceItems.clear(),
      db.ledger.clear(),
    ])
    await db.customers.bulkAdd(data.customers ?? [])
    await db.products.bulkAdd(data.products ?? [])
    await db.priceLists.bulkAdd(data.priceLists ?? [])
    await db.prices.bulkAdd(data.prices ?? [])
    await db.invoices.bulkAdd(data.invoices ?? [])
    await db.invoiceItems.bulkAdd(data.invoiceItems ?? [])
    await db.ledger.bulkAdd(data.ledger ?? [])
  })
}

export async function syncWithRemote() {
  try {
    const localJson = await exportData()
    const local = JSON.parse(localJson)
    const summary = await pushAll(local)
    const remote = await pullAll()
    await importData(JSON.stringify(remote))
    return { status: 'completed', message: 'Sincronización con Supabase exitosa', summary }
  } catch (err) {
    return { status: 'error', message: `Error de sync: ${err.message}` }
  }
}