"use client"
import { useEffect, useMemo, useState } from 'react'
import { db, Customer, PriceList, Product } from '@/lib/db'

export default function FacturasPage() {
  const [customers, setCustomers] = useState<Customer[]>([])
  const [lists, setLists] = useState<PriceList[]>([])
  const [products, setProducts] = useState<Product[]>([])
  const [form, setForm] = useState({ customerId: '', listId: '', date: new Date().toISOString().slice(0,10), saleCondition: 'Contado' })
  const [items, setItems] = useState<Array<{ productId: string | number; qty: number; unitPrice: number; variant?: string }>>([])
  const [itemQueries, setItemQueries] = useState<string[]>([])
  const [itemActive, setItemActive] = useState<Record<number, number>>({})
  const [itemQtyText, setItemQtyText] = useState<string[]>([])
  const [itemPriceText, setItemPriceText] = useState<string[]>([])

  useEffect(() => { db.customers.toArray().then(setCustomers) }, [])
  useEffect(() => { db.priceLists.toArray().then(setLists) }, [])
  useEffect(() => { db.products.toArray().then(setProducts) }, [])

  const pricesByKey = useMemo(() => {
    const map = new Map<number, Record<string, number>>()
    if (!form.listId) return map
    db.prices.where('listId').equals(Number(form.listId)).toArray().then(list => {
      list.forEach(p => {
        const cur = map.get(p.productId) || {}
        const v = p.variant || 'unidad'
        cur[v] = p.price
        map.set(p.productId, cur)
      })
    })
    return map
  }, [form.listId])

  const total = useMemo(() => items.reduce((acc, it) => acc + it.qty * it.unitPrice, 0), [items])

  function addItem() {
    setItems(prev => ([...prev, { productId: '', qty: 1, unitPrice: 0, variant: 'unidad' }]))
    setItemQueries(prev => ([...prev, '']))
    setItemQtyText(prev => ([...prev, '1']))
    setItemPriceText(prev => ([...prev, '0']))
  }

  function updateItem(idx: number, patch: Partial<{ productId: string | number; qty: number; unitPrice: number; variant?: string }>) {
    setItems(prev => prev.map((it, i) => i === idx ? { ...it, ...patch } : it))
  }

  function computeUnitPrice(productId: number, qty: number, variant?: string) {
    const p = products.find(x => x.id === Number(productId))
    if (!p) return 0
    const pv = pricesByKey.get(Number(productId)) || {}
    if (p.weighable) {
      return pv.unidad ?? 0
    }
    const v = variant || 'unidad'
    if (v === 'caja') {
      if (pv.caja != null) return pv.caja
      const units = Number(p.unitsPerBox ?? 0)
      const totalUnits = (qty ?? 0) * (units || 0)
      const baseUnit = (totalUnits >= 5 && pv.mayor != null) ? pv.mayor : (pv.unidad ?? 0)
      return units > 0 ? (baseUnit * units) : baseUnit
    }
    if ((qty ?? 0) >= 5 && pv.mayor != null) return pv.mayor
    return pv.unidad ?? 0
  }

  return (
    <div className="max-w-7xl mx-auto space-y-6 p-6">
      <h2 className="text-2xl font-semibold tracking-tight text-slate-800">Emitir factura</h2>
      <div className="rounded-xl border bg-white p-4">
        <div className="grid grid-cols-1 md:grid-cols-5 gap-3 items-end">
          <div>
            <label className="block text-sm font-medium text-slate-700">Cliente</label>
            <select className="mt-1 w-full border rounded-xl px-3 py-2" value={form.customerId} onChange={e => setForm({ ...form, customerId: e.target.value })}>
              <option value="">Seleccione…</option>
              {customers.map(c => <option key={c.id} value={String(c.id)}>{c.name}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700">Lista de precios</label>
            <select className="mt-1 w-full border rounded-xl px-3 py-2" value={form.listId} onChange={e => setForm({ ...form, listId: e.target.value })}>
              <option value="">Seleccione…</option>
              {lists.map(l => <option key={l.id} value={String(l.id)}>{l.name}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700">Fecha</label>
            <input type="date" className="mt-1 w-full border rounded-xl px-3 py-2" value={form.date} onChange={e => setForm({ ...form, date: e.target.value })} />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700">Condición de venta</label>
            <select className="mt-1 w-full border rounded-xl px-3 py-2" value={form.saleCondition} onChange={e => setForm({ ...form, saleCondition: e.target.value })}>
              <option value="Contado">Contado</option>
              <option value="Cuenta corriente">Cuenta corriente</option>
              <option value="Tarjeta">Tarjeta</option>
              <option value="Transferencia">Transferencia</option>
            </select>
          </div>
          <div className="p-3 bg-slate-50 rounded border border-slate-200 text-slate-700">Total: <span className="font-semibold">{total.toLocaleString('es-AR', { style: 'currency', currency: 'ARS' })}</span></div>
        </div>
      </div>

      <div className="rounded-xl border bg-white p-4 space-y-2">
        <div className="flex justify-between items-center">
          <h3 className="font-semibold">Ítems</h3>
          <button className="px-4 py-2 rounded-md bg-emerald-600 text-white" onClick={addItem}>Agregar ítem</button>
        </div>
        <div className="space-y-2">
          {items.map((it, idx) => {
            const q = (itemQueries[idx] || '').trim().toLowerCase()
            const suggestions = q.length >= 1 ? products.filter(p => [p.name, p.sku, p.barcode, p.category].some(v => (v || '').toLowerCase().includes(q))).slice(0, 8) : []
            const selected = products.find(p => p.id === Number(it.productId))
            return (
              <div key={idx} className="grid grid-cols-1 md:grid-cols-5 gap-3 items-end">
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-slate-700">Buscar producto</label>
                  <input className="mt-1 w-full border rounded-xl px-3 py-2" value={itemQueries[idx] || ''} onChange={e => {
                    const val = e.target.value
                    setItemQueries(prev => prev.map((x, i) => i === idx ? val : x))
                    setItemActive(prev => ({ ...prev, [idx]: 0 }))
                  }} />
                  {suggestions.length > 0 && (
                    <div className="mt-1 border rounded bg-white shadow text-sm max-h-60 overflow-auto z-10">
                      {suggestions.map((s, i) => (
                        <button type="button" key={s.id} className={`w-full text-left px-2 py-1 flex items-center justify-between ${i === (itemActive[idx] ?? 0) ? 'bg-indigo-200 ring-2 ring-indigo-400' : 'hover:bg-gray-50'}`} onMouseDown={() => {
                          const qty = items[idx]?.qty ?? 0
                          const variant = items[idx]?.variant || 'unidad'
                          const price = computeUnitPrice(Number(s.id), qty, variant)
                          updateItem(idx, { productId: String(s.id), unitPrice: price })
                          setItemQueries(prev => prev.map((x, i2) => i2 === idx ? '' : x))
                          setItemPriceText(prev => prev.map((x, i2) => i2 === idx ? price.toLocaleString('es-AR', { style: 'currency', currency: 'ARS' }) : x))
                        }}>
                          <span className="truncate">{s.name}</span>
                          <span className="text-xs text-slate-600 ml-2">{s.barcode || s.sku || s.category || ''}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700">Cantidad</label>
                  <input className="mt-1 w-full border rounded-xl px-3 py-2" value={itemQtyText[idx] ?? String(it.qty)} onChange={e => {
                    let val = e.target.value || ''
                    val = val.replace(/[^\d,]/g, '').replace(/\./g, ',')
                    const num = parseFloat(val.replace(',', '.'))
                    const newQty = isNaN(num) ? 0 : num
                    setItemQtyText(prev => prev.map((x, i) => i === idx ? val : x))
                    const variant = items[idx]?.variant || 'unidad'
                    const productId = items[idx]?.productId
                    const autoPrice = productId ? computeUnitPrice(Number(productId), newQty, variant) : items[idx]?.unitPrice
                    updateItem(idx, { qty: newQty, unitPrice: autoPrice })
                    setItemPriceText(prev => prev.map((x, i) => i === idx ? autoPrice.toLocaleString('es-AR', { style: 'currency', currency: 'ARS' }) : x))
                  }} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700">Variante</label>
                  <select className="mt-1 w-full border rounded-xl px-3 py-2" value={it.variant || 'unidad'} disabled={!!selected?.weighable} onChange={e => {
                    const v = e.target.value
                    const productId = items[idx]?.productId
                    const qty = items[idx]?.qty ?? 0
                    const autoPrice = productId ? computeUnitPrice(Number(productId), qty, v) : items[idx]?.unitPrice
                    updateItem(idx, { variant: v, unitPrice: autoPrice })
                    setItemPriceText(prev => prev.map((x, i) => i === idx ? autoPrice.toLocaleString('es-AR', { style: 'currency', currency: 'ARS' }) : x))
                  }}>
                    <option value="unidad">Unidad</option>
                    <option value="caja">Caja</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700">Precio unitario</label>
                  <input className="mt-1 w-full border rounded-xl px-3 py-2" value={itemPriceText[idx] ?? String(it.unitPrice)} onChange={e => {
                    let val = e.target.value || ''
                    val = val.replace(/[^\d,]/g, '').replace(/\./g, ',')
                    const num = parseFloat(val.replace(',', '.'))
                    setItemPriceText(prev => prev.map((x, i) => i === idx ? val : x))
                    updateItem(idx, { unitPrice: isNaN(num) ? 0 : num })
                  }} />
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}