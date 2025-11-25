"use client"
import { useEffect, useMemo, useRef, useState } from 'react'
import { db, Supplier, PriceList, Product } from '@/lib/db'

export default function ComprasPage() {
  const [suppliers, setSuppliers] = useState<Supplier[]>([])
  const [lists, setLists] = useState<PriceList[]>([])
  const [products, setProducts] = useState<Product[]>([])
  const [form, setForm] = useState({ supplierId: '', number: '', date: new Date().toISOString().slice(0,10), taxPct: 0 })
  const [items, setItems] = useState<Array<{ productId: string | number; qty: number; unitCost: number; variantLists?: Record<string, string> }>>([])
  const [itemQueries, setItemQueries] = useState<string[]>([])
  const [itemActive, setItemActive] = useState<Record<number, number>>({})
  const [itemQtyText, setItemQtyText] = useState<string[]>([])
  const [itemCostText, setItemCostText] = useState<string[]>([])
  const addQueryRef = useRef<HTMLInputElement | null>(null)

  useEffect(() => { db.suppliers.toArray().then(setSuppliers) }, [])
  useEffect(() => { db.priceLists.toArray().then(setLists) }, [])
  useEffect(() => { db.products.toArray().then(setProducts) }, [])

  useEffect(() => {
    const s = suppliers.find(x => String(x.id) === String(form.supplierId))
    if (s) setForm(prev => ({ ...prev, taxPct: Number(s.taxPct || 0) }))
  }, [form.supplierId, suppliers])

  function addItem() {
    setItems(prev => ([...prev, { productId: '', qty: 1, unitCost: 0, variantLists: {} }]))
    setItemQueries(prev => ([...prev, '']))
    setItemQtyText(prev => ([...prev, '1']))
    setItemCostText(prev => ([...prev, '0']))
    setTimeout(() => { addQueryRef.current?.focus() }, 0)
  }

  function updateItem(idx: number, patch: Partial<{ productId: string | number; qty: number; unitCost: number; variantLists?: Record<string, string> }>) {
    setItems(prev => prev.map((it, i) => i === idx ? { ...it, ...patch } : it))
  }

  const computePI = (cost: number, taxPct: number) => Number(cost || 0) * (1 + Number(taxPct || 0)/100)

  async function savePurchase() {
    if (!form.supplierId || !form.number) return
    const total = items.reduce((acc, it) => acc + computePI(it.unitCost, form.taxPct) * Number(it.qty || 0), 0)
    const purId = await db.purchases.add({ number: String(form.number), supplierId: Number(form.supplierId), date: new Date(form.date).toISOString(), total, taxPct: Number(form.taxPct || 0) })
    if (items.length) {
      await db.purchaseItems.bulkAdd(items.map(it => ({ purchaseId: purId, productId: Number(it.productId || 0), qty: Number(it.qty || 0), unitCost: Number(it.unitCost || 0), taxes: Number(form.taxPct || 0), totalCost: computePI(Number(it.unitCost || 0), Number(form.taxPct || 0)) * Number(it.qty || 0) })))
    }
    setItems([])
    setItemQueries([])
    setItemQtyText([])
    setItemCostText([])
  }

  return (
    <div className="max-w-7xl mx-auto space-y-6 p-6">
      <h2 className="text-2xl font-semibold tracking-tight text-slate-800">Compras</h2>

      <div className="rounded-xl border bg-white p-4">
        <div className="grid grid-cols-1 md:grid-cols-5 gap-3 items-end">
          <div>
            <label className="block text-sm font-medium text-slate-700">Proveedor</label>
            <select className="mt-1 w-full border rounded-xl px-3 py-2" value={form.supplierId} onChange={e => setForm({ ...form, supplierId: e.target.value })}>
              <option value="">Seleccione…</option>
              {suppliers.map(s => <option key={s.id} value={String(s.id)}>{s.name}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700">Número</label>
            <input className="mt-1 w-full border rounded-xl px-3 py-2" value={form.number} onChange={e => setForm({ ...form, number: e.target.value })} />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700">Fecha</label>
            <input type="date" className="mt-1 w-full border rounded-xl px-3 py-2" value={form.date} onChange={e => setForm({ ...form, date: e.target.value })} />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700">Impuestos (%)</label>
            <input className="mt-1 w-full border rounded-xl px-3 py-2" value={String(form.taxPct)} onChange={e => {
              let val = e.target.value || ''
              val = val.replace(/\./g, ',').replace(/[^\d,]/g, '')
              const num = parseFloat(val.replace(',', '.'))
              setForm({ ...form, taxPct: isNaN(num) ? 0 : num })
            }} />
          </div>
          <button className="px-4 py-2 rounded-md bg-indigo-600 text-white" onClick={addItem}>Agregar ítem</button>
        </div>
      </div>

      <div className="space-y-3">
        {items.map((it, idx) => {
          const q = (itemQueries[idx] || '').trim().toLowerCase()
          const selected = products.find(p => p.id === Number(it.productId))
          const suggestions = (!selected && q.length >= 1) ? products.filter(p => [p.name, p.sku, p.barcode, p.category].some(v => (v || '').toLowerCase().includes(q))).slice(0, 8) : []
          const pi = computePI(it.unitCost, form.taxPct)
          const units = Number(selected?.unitsPerBox ?? 0)
          const isWeigh = !!selected?.weighable
          const lines = isWeigh ? [
            { label: 'X CAJA', variant: 'caja', price: units > 0 ? (pi * units * 1.20) : pi * 1.20 },
            { label: 'X PZ', variant: 'x_pz', price: pi * 1.25 },
            { label: 'X MPZ', variant: 'x_mpz', price: pi * 1.30 },
            { label: 'X KG', variant: 'x_kg', price: pi * 1.40 },
            { label: 'PY', variant: 'py', price: pi * 1.10 },
            { label: 'ESPECIAL', variant: 'especial', price: pi * 1.15 },
          ] : [
            { label: 'GENERAL', variant: 'unidad', price: pi * 1.40 },
            { label: 'MAYORISTA', variant: 'mayor', price: pi * 1.30 },
            { label: 'X CAJA', variant: 'caja', price: units > 0 ? (pi * units * 1.25) : pi * 1.25 },
            { label: 'PY', variant: 'py', price: pi * 1.10 },
            { label: 'ESPECIAL', variant: 'especial', price: pi * 1.15 },
          ]
          const vlists = it.variantLists || {}
          return (
            <div key={idx} className="rounded-xl border bg-white p-4">
              <div className="grid grid-cols-1 md:grid-cols-5 gap-3 items-end">
                <div className="md:col-span-2 relative">
                  <label className="block text-sm font-medium text-slate-700">Buscar producto</label>
                  <input ref={idx === items.length - 1 ? addQueryRef : undefined} className="mt-1 w-full border rounded-xl px-3 py-2" value={itemQueries[idx] || ''} onChange={e => {
                    const val = e.target.value
                    setItemQueries(prev => prev.map((x, i) => i === idx ? val : x))
                    setItemActive(prev => ({ ...prev, [idx]: 0 }))
                  }} />
                  {suggestions.length > 0 && (
                    <div className="mt-1 border rounded bg-white shadow text-sm max-h-60 overflow-auto z-10">
                      {suggestions.map((s, i) => (
                        <button type="button" key={s.id} className={`w-full text-left px-2 py-1 flex items-center justify-between ${i === (itemActive[idx] ?? 0) ? 'bg-indigo-200 ring-2 ring-indigo-400' : 'hover:bg-gray-50'}`} onMouseDown={() => {
                          updateItem(idx, { productId: String(s.id) })
                          setItemQueries(prev => prev.map((x, i2) => i2 === idx ? '' : x))
                          setItemActive(prev => { const { [idx]: _, ...rest } = prev; return rest })
                        }}>
                          <span className="whitespace-normal break-words">{s.name}</span>
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
                    setItemQtyText(prev => prev.map((x, i) => i === idx ? val : x))
                    updateItem(idx, { qty: isNaN(num) ? 0 : num })
                  }} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700">PU</label>
                  <input className="mt-1 w-full border rounded-xl px-3 py-2" value={itemCostText[idx] ?? String(it.unitCost)} onChange={e => {
                    let val = e.target.value || ''
                    val = val.replace(/[^\d,]/g, '').replace(/\./g, ',')
                    const num = parseFloat(val.replace(',', '.'))
                    setItemCostText(prev => prev.map((x, i) => i === idx ? val : x))
                    updateItem(idx, { unitCost: isNaN(num) ? 0 : num })
                  }} />
                </div>
                <div>
                  <label className="block text-sm text-slate-700">PI</label>
                  <div className="mt-1 px-3 py-2 border rounded-xl bg-gray-50">{(pi).toLocaleString('es-AR', { style: 'currency', currency: 'ARS' })}</div>
                </div>
              </div>

              <div className="overflow-x-auto mt-3">
                <div className="min-w-[640px] grid grid-cols-1 md:grid-cols-2 gap-2">
                  <div className="text-sm text-slate-700">{selected ? selected.name : '—'}</div>
                  <div className="grid grid-cols-1 gap-2 text-sm">
                  {lines.map(line => (
                    <div key={line.variant} className="flex items-center gap-2">
                      <span className="w-40">{line.label}</span>
                      <span className="font-semibold">{(line.price).toLocaleString('es-AR', { style: 'currency', currency: 'ARS' })}</span>
                      <select className="border rounded px-2 py-1" value={vlists[line.variant] || ''} onChange={e => {
                        const id = e.target.value
                        setItems(prev => prev.map((x, i) => i === idx ? { ...x, variantLists: { ...(x.variantLists || {}), [line.variant]: id } } : x))
                      }}>
                        <option value="">Lista…</option>
                        {lists.map(l => <option key={l.id} value={String(l.id)}>{l.name}</option>)}
                      </select>
                      <button className="px-3 py-1 rounded-md border" onClick={async () => {
                        const listId = Number((it.variantLists || {})[line.variant])
                        const pid = Number(it.productId)
                        if (!pid || !listId) return
                        const ex = await db.prices.where('listId').equals(listId).and(r => r.productId === pid && (r.variant || 'unidad') === line.variant).first()
                        if (ex) await db.prices.put({ id: ex.id!, listId, productId: pid, price: line.price, variant: line.variant })
                        else await db.prices.add({ listId, productId: pid, price: line.price, variant: line.variant })
                      }}>Aplicar</button>
                    </div>
                  ))}
                  </div>
                </div>
              </div>
            </div>
          )
        })}
      </div>
      <div className="fixed bottom-0 left-0 right-0 z-30 md:hidden bg-white border-t p-2">
        <button className="w-full px-4 py-2 rounded-md bg-indigo-600 text-white" onClick={savePurchase}>Guardar compra</button>
      </div>
    </div>
  )
}