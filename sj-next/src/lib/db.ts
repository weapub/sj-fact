import Dexie, { Table } from 'dexie'

export interface Customer { id?: number; name: string; taxId?: string; email?: string }
export interface Product { id?: number; name: string; sku?: string; barcode?: string; category?: string; weighable?: boolean; unitsPerBox?: number }
export interface PriceList { id?: number; name: string; currency: string }
export interface Price { id?: number; listId: number; productId: number; price: number; variant?: string }
export interface Purchase { id?: number; number: string; supplierId: number; date: string; total: number; taxPct: number }
export interface PurchaseItem { id?: number; purchaseId: number; productId: number; qty: number; unitCost: number; taxes: number; totalCost: number }
export interface Supplier { id?: number; name: string; taxPct?: number; taxId?: string; email?: string }

class AppDB extends Dexie {
  customers!: Table<Customer, number>
  products!: Table<Product, number>
  priceLists!: Table<PriceList, number>
  prices!: Table<Price, number>
  purchases!: Table<Purchase, number>
  purchaseItems!: Table<PurchaseItem, number>
  suppliers!: Table<Supplier, number>

  constructor() {
    super('sj_fact_db_next')
    this.version(1).stores({
      customers: '++id, name, taxId, email',
      products: '++id, name, sku',
      priceLists: '++id, name, currency',
      prices: '++id, listId, productId, price',
      purchases: '++id, number, supplierId, date, total, taxPct',
      purchaseItems: '++id, purchaseId, productId, qty, unitCost, taxes, totalCost',
      suppliers: '++id, name, taxId, email, taxPct',
    })
  }
}

export const db = new AppDB()