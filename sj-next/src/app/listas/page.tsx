"use client"
import { useEffect, useMemo, useState } from 'react'
import { db, PriceList, Price, Product } from '@/lib/db'

export default function ListasPage() {
  const [lists, setLists] = useState<PriceList[]>([])
  const [products, setProducts] = useState<Product[]>([])
  const [selectedListId, setSelectedListId] = useState<string>('')
  const [prices, setPrices] = useState<Price[]>([])
  const [inlineId, setInlineId] = useState<number | null>(null)
  const [inlineText, setInlineText] = useState('')
  const [variant, setVariant] = useState<string>('unidad')

  useEffect(() => { db.priceLists.orderBy('name').toArray().then(setLists) }, [])
  useEffect(() => { db.products.toArray().then(setProducts) }, [])
  useEffect(() => {
    const listNum = Number(selectedListId)
    if (!listNum) { setPrices([]); return }
    db.prices.where('listId').equals(listNum).toArray().then(setPrices)
  }, [selectedListId])

  function productName(id: number) {
    return products.find(p => p.id === id)?.name || `#${id}`
  }

  function startEdit(pr: Price) {
    setInlineId(pr.productId)
    setVariant(pr.variant || 'unidad')
    setInlineText(String(pr.price))
  }

  async function saveEdit(id: number) {
    const listNum = Number(selectedListId)
    const val = parseFloat(inlineText.replace(',', '.'))
    if (Number.isNaN(val)) { setInlineId(null); return }
    const existing = prices.find(p => p.productId === id && (p.variant || 'unidad') === variant)
    if (existing) {
      await db.prices.put({ id: existing.id!, listId: listNum, productId: id, price: val, variant })
    } else {
      await db.prices.add({ listId: listNum, productId: id, price: val, variant })
    }
    const refreshed = await db.prices.where('listId').equals(listNum).toArray()
    setPrices(refreshed)
    setInlineId(null)
  }

  return (
    <div className="max-w-7xl mx-auto space-y-6 p-6">
      <h2 className="text-2xl font-semibold tracking-tight text-slate-800">Listas de precios</h2>
      <div className="rounded-xl border bg-white p-4 space-y-3">
        <div>
          <label className="block text-sm font-medium text-slate-700">Lista</label>
          <select className="mt-1 w-64 border rounded-xl px-3 py-2" value={selectedListId} onChange={e => setSelectedListId(e.target.value)}>
            <option value="">-- Seleccione --</option>
            {lists.map(l => <option key={l.id} value={String(l.id)}>{l.name} ({l.currency})</option>)}
          </select>
        </div>
        {selectedListId ? (
          <div className="overflow-auto">
            <table className="min-w-full border border-slate-200 rounded">
              <thead>
                <tr className="bg-slate-50 text-slate-700 text-left">
                  <th className="p-2">Producto</th>
                  <th className="p-2">Variante</th>
                  <th className="p-2">Precio</th>
                  <th className="p-2">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {prices.map(pr => (
                  <tr key={`${pr.productId}-${pr.variant || 'unidad'}`} className="border-t hover:bg-slate-50">
                    <td className="p-2">{productName(pr.productId)}</td>
                    <td className="p-2">{pr.variant || 'unidad'}</td>
                    <td className="p-2">
                      {inlineId === pr.productId && (variant === (pr.variant || 'unidad')) ? (
                        <input className="w-28 border rounded px-2 py-1" value={inlineText} onChange={e => setInlineText(e.target.value)} onBlur={() => saveEdit(pr.productId)} onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); saveEdit(pr.productId) } else if (e.key === 'Escape') { setInlineId(null) } }} />
                      ) : (
                        <span>{pr.price.toLocaleString('es-AR', { style: 'currency', currency: 'ARS' })}</span>
                      )}
                    </td>
                    <td className="p-2">
                      <select className="border rounded px-2 py-1 mr-2" value={variant} onChange={e => setVariant(e.target.value)}>
                        <option value="unidad">Unidad</option>
                        <option value="caja">Caja</option>
                        <option value="mayor">Mayorista</option>
                        <option value="py">PY</option>
                        <option value="especial">Especial</option>
                        <option value="x_pz">X PZ</option>
                        <option value="x_mpz">X MPZ</option>
                        <option value="x_kg">X KG</option>
                      </select>
                      <button className="px-3 py-1 rounded border" onClick={() => startEdit(pr)}>Editar</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="text-slate-600">Seleccioná una lista</div>
        )}
      </div>
    </div>
  )
}