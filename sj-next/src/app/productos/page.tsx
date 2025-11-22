"use client"
import { useEffect, useMemo, useRef, useState } from 'react'
import { db, Product, PriceList, Price } from '@/lib/db'

export default function ProductosPage() {
  const [products, setProducts] = useState<Product[]>([])
  const [lists, setLists] = useState<PriceList[]>([])
  const [selectedListId, setSelectedListId] = useState<string>('')
  const [selectedVariant, setSelectedVariant] = useState<string>('unidad')
  const [filterText, setFilterText] = useState('')
  const [inlineEditingId, setInlineEditingId] = useState<number | null>(null)
  const [inlinePriceText, setInlinePriceText] = useState('')
  const priceInputRef = useRef<HTMLInputElement | null>(null)

  useEffect(() => { db.products.orderBy('name').toArray().then(setProducts) }, [])
  useEffect(() => { db.priceLists.orderBy('name').toArray().then(setLists) }, [])

  const pricesMap = useMemo(() => {
    const map = new Map<number, Price>()
    const listNum = Number(selectedListId)
    if (!listNum) return map
    db.prices.where('listId').equals(listNum).toArray().then(prs => {
      const sVar = selectedVariant || 'unidad'
      const seen = new Map<number, Price>()
      prs.forEach(pr => {
        const cur = seen.get(pr.productId)
        const v = pr.variant || 'unidad'
        if (!cur) {
          seen.set(pr.productId, pr)
        } else if ((cur.variant || 'unidad') !== sVar && v === sVar) {
          seen.set(pr.productId, pr)
        }
      })
      seen.forEach((v, k) => map.set(k, v))
    })
    return map
  }, [selectedListId, selectedVariant])

  useEffect(() => { if (inlineEditingId != null) setTimeout(() => priceInputRef.current?.focus(), 0) }, [inlineEditingId])

  function startInlineEdit(p: Product) {
    const pr = pricesMap.get(p.id!)
    setInlineEditingId(p.id!)
    setInlinePriceText(pr ? String(pr.price) : '')
  }

  async function saveInlinePrice() {
    const listNum = Number(selectedListId)
    if (!listNum || inlineEditingId == null) { setInlineEditingId(null); return }
    const valStr = inlinePriceText.trim()
    if (!valStr) { setInlineEditingId(null); return }
    const val = parseFloat(valStr.replace(',', '.'))
    if (Number.isNaN(val)) return
    const existing = pricesMap.get(inlineEditingId)
    if (existing) {
      await db.prices.put({ id: existing.id!, listId: listNum, productId: inlineEditingId, price: val, variant: selectedVariant })
    } else {
      await db.prices.add({ listId: listNum, productId: inlineEditingId, price: val, variant: selectedVariant })
    }
    setInlineEditingId(null)
  }

  return (
    <div className="max-w-7xl mx-auto space-y-6 p-6">
      <h2 className="text-2xl font-semibold tracking-tight text-slate-800">Productos</h2>
      <div className="rounded-xl border bg-white p-4 space-y-3">
        <div className="flex gap-3 items-end">
          <div>
            <label className="block text-sm font-medium text-slate-700">Lista</label>
            <select className="mt-1 w-64 border rounded-xl px-3 py-2" value={selectedListId} onChange={e => setSelectedListId(e.target.value)}>
              <option value="">-- Sin lista --</option>
              {lists.map(l => <option key={l.id} value={String(l.id)}>{l.name} ({l.currency})</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700">Variante</label>
            <select className="mt-1 w-40 border rounded-xl px-3 py-2" value={selectedVariant} onChange={e => setSelectedVariant(e.target.value)}>
              <option value="unidad">Unidad</option>
              <option value="caja">Caja</option>
              <option value="mayor">Mayorista</option>
            </select>
          </div>
          <div className="flex-1">
            <label className="block text-sm font-medium text-slate-700">Buscar</label>
            <input className="mt-1 w-full border rounded-xl px-3 py-2" value={filterText} onChange={e => setFilterText(e.target.value)} placeholder="Nombre, código, categoría" />
          </div>
        </div>
        <div className="overflow-auto">
          <table className="min-w-full border border-slate-200 rounded">
            <thead>
              <tr className="bg-slate-50 text-slate-700 text-left">
                <th className="p-2">Código</th>
                <th className="p-2">Descripción</th>
                <th className="p-2">Categoría</th>
                <th className="p-2">Pesable</th>
                <th className="p-2">Precio</th>
              </tr>
            </thead>
            <tbody>
              {products.filter(p => {
                const q = filterText.trim().toLowerCase()
                const match = !q || [p.name, p.sku, p.barcode, p.category].some(v => (v || '').toLowerCase().includes(q))
                return match
              }).map(p => {
                const pr = pricesMap.get(p.id!)
                return (
                  <tr key={p.id} className="border-t hover:bg-slate-50">
                    <td className="p-2">{p.barcode || p.sku || '—'}</td>
                    <td className="p-2">{p.name}</td>
                    <td className="p-2">{p.category || '—'}</td>
                    <td className="p-2">{p.weighable ? 'Sí' : 'No'}</td>
                    <td className="p-2">
                      {!selectedListId ? (
                        <span className="text-slate-600">Seleccioná una lista</span>
                      ) : inlineEditingId === p.id ? (
                        <input ref={priceInputRef} className="w-28 border rounded px-2 py-1" value={inlinePriceText} onChange={e => setInlinePriceText(e.target.value)} onBlur={saveInlinePrice} onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); saveInlinePrice() } else if (e.key === 'Escape') { setInlineEditingId(null) } }} />
                      ) : pr ? (
                        <button type="button" className="inline-flex items-center gap-2 hover:bg-slate-50 rounded px-2 py-1" onClick={() => startInlineEdit(p)}>
                          <span>{pr.price.toLocaleString('es-AR', { style: 'currency', currency: 'ARS' })}</span>
                        </button>
                      ) : (
                        <button type="button" className="px-2 py-1 rounded border" onClick={() => startInlineEdit(p)}>Agregar precio</button>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}