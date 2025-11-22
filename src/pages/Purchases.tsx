import { useEffect, useMemo, useRef, useState } from 'react'
import { db } from '../data/db'
import Card from '../components/Card'
import Button from '../components/Button'
import Input from '../components/Input'
import Select from '../components/Select'
import Badge from '../components/Badge'
import Modal from '../components/Modal'
import { useToast } from '../components/Toast'
import { formatMoney, parseMoney } from '../utils/format'

type Supplier = { id: number; name: string; taxPct?: number; taxId?: string; email?: string }
type PriceList = { id: number; name: string; currency?: string }
type Product = { id: number; name: string; sku?: string; barcode?: string; category?: string; weighable?: boolean; unitsPerBox?: number }
type Purchase = { id: number; number: string; supplierId: number; date: string; total: number; taxPct: number }
type ItemState = { productId: string | number; qty: number; unitCost: number; variantLists?: Record<string, string> }

export default function Purchases() {
  const { show } = useToast()
  const [suppliers, setSuppliers] = useState<Supplier[]>([])
  const [lists, setLists] = useState<PriceList[]>([])
  const [products, setProducts] = useState<Product[]>([])
  const [form, setForm] = useState({ supplierId: '', number: '', date: new Date().toISOString().slice(0,10), taxPct: 0 })
  const [items, setItems] = useState<ItemState[]>([])
  const [itemQueries, setItemQueries] = useState<string[]>([])
  const [itemActive, setItemActive] = useState<Record<number, number>>({})
  const [itemQtyText, setItemQtyText] = useState<string[]>([])
  const [itemCostText, setItemCostText] = useState<string[]>([])
  const [purchases, setPurchases] = useState<Purchase[]>([])
  const addQueryRef = useRef<HTMLInputElement | null>(null)
  const [supplierOpen, setSupplierOpen] = useState(false)
  const [supplierForm, setSupplierForm] = useState<{ name: string; taxPct: number; taxId: string; email: string }>({ name: '', taxPct: 0, taxId: '', email: '' })

  useEffect(() => { db.suppliers?.toArray().then(arr => setSuppliers(arr || [])) }, [])
  useEffect(() => { db.priceLists.toArray().then(setLists) }, [])
  useEffect(() => { db.products.toArray().then(setProducts) }, [])
  useEffect(() => { db.purchases?.toArray().then(arr => setPurchases(arr.sort((a,b) => new Date(b.date) - new Date(a.date)))) }, [])

  useEffect(() => {
    const s = suppliers.find(x => String(x.id) === String(form.supplierId))
    if (s) setForm(prev => ({ ...prev, taxPct: Number(s.taxPct || 0) }))
  }, [form.supplierId, suppliers])

  const pricesByKey = useMemo(() => {
    const map = new Map<string, PriceList>()
    lists.forEach(l => { map.set(`list:${l.id}`, l) })
    return map
  }, [lists])

  function addItem() {
    setItems(prev => ([...prev, { productId: '', qty: 1, unitCost: 0, variantLists: {} }]))
    setItemQueries(prev => ([...prev, '']))
    setItemQtyText(prev => ([...prev, '1']))
    setItemCostText(prev => ([...prev, '0']))
    setTimeout(() => { addQueryRef.current?.focus() }, 0)
  }

  function updateItem(idx: number, patch: Partial<ItemState>) {
    setItems(prev => prev.map((it, i) => i === idx ? { ...it, ...patch } : it))
  }

  function computeSalePrice(cost: number, taxPct: number, marginPct: number) {
    const base = Number(cost || 0)
    const withTax = base * (1 + Number(taxPct || 0) / 100)
    const withMargin = withTax * (1 + Number(marginPct || 0) / 100)
    return withMargin
  }

  function computePI(cost: number, taxPct: number) {
    return computeSalePrice(cost, taxPct, 0)
  }



  async function savePurchase() {
    if (!form.supplierId || !form.number) { show('Proveedor y número son obligatorios', 'warning'); return }
    const total = items.reduce((acc, it) => acc + computeSalePrice(it.unitCost, form.taxPct, 0) * Number(it.qty || 0), 0)
    const purId = await db.purchases.add({ number: String(form.number), supplierId: Number(form.supplierId), date: new Date(form.date).toISOString(), total, taxPct: Number(form.taxPct || 0) })
    if (items.length) {
      await db.purchaseItems.bulkAdd(items.map(it => ({ purchaseId: purId, productId: Number(it.productId || 0), qty: Number(it.qty || 0), unitCost: Number(it.unitCost || 0), taxes: Number(form.taxPct || 0), totalCost: Number(it.unitCost || 0) * Number(it.qty || 0) * (1 + Number(form.taxPct || 0)/100) })))
    }
    const all = await db.purchases.toArray()
    setPurchases(all.sort((a,b) => new Date(b.date) - new Date(a.date)))
    setItems([])
    setItemQueries([])
    setItemQtyText([])
    setItemCostText([])
    show('Compra guardada', 'success')
  }

  async function saveSupplier() {
    const name = (supplierForm.name || '').trim()
    const taxNum = Number(supplierForm.taxPct || 0)
    if (!name) return
    const id = await db.suppliers.add({ name, taxPct: isNaN(taxNum) ? 0 : taxNum, taxId: supplierForm.taxId || '', email: supplierForm.email || '' })
    const arr = await db.suppliers.toArray()
    setSuppliers(arr)
    setForm(prev => ({ ...prev, supplierId: String(id), taxPct: isNaN(taxNum) ? 0 : taxNum }))
    setSupplierOpen(false)
    setSupplierForm({ name: '', taxPct: 0, taxId: '', email: '' })
  }

  return (
    <div className="max-w-7xl mx-auto space-y-6 p-4">
      <h2 className="text-2xl font-bold tracking-tight text-slate-800">Compras</h2>

      <Card>
        <div className="grid grid-cols-1 md:grid-cols-5 gap-3 items-end">
          <Select label="Proveedor" value={form.supplierId} onChange={e => setForm({ ...form, supplierId: e.target.value })}>
            <option value="">Seleccione…</option>
            {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
          </Select>
          <Button type="button" variant="secondary" onClick={() => setSupplierOpen(true)}>Agregar proveedor</Button>
          <Input label="Número" value={form.number} onChange={e => setForm({ ...form, number: e.target.value })} placeholder="Ej.: 0001-00001234" />
          <Input label="Fecha" type="date" value={form.date} onChange={e => setForm({ ...form, date: e.target.value })} />
          <Input label="Impuestos (%)" type="text" value={String(form.taxPct)} onChange={e => {
            let val = e.target.value || ''
            val = val.replace(/\./g, ',').replace(/[^\d,]/g, '')
            const num = parseFloat(val.replace(',', '.'))
            setForm({ ...form, taxPct: isNaN(num) ? 0 : num })
          }} />
        </div>
      </Card>

      <Modal isOpen={supplierOpen} title="Nuevo proveedor" onClose={() => setSupplierOpen(false)}
        footer={(
          <div className="flex justify-end gap-2">
            <Button type="button" variant="secondary" onClick={() => setSupplierOpen(false)}>Cancelar</Button>
            <Button type="button" variant="success" onClick={saveSupplier}>Guardar</Button>
          </div>
        )}
      >
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <Input label="Nombre" value={supplierForm.name} onChange={e => setSupplierForm({ ...supplierForm, name: e.target.value })} />
          <Input label="Impuestos (%)" value={String(supplierForm.taxPct)} onChange={e => {
            let val = e.target.value || ''
            val = val.replace(/\./g, ',').replace(/[^\d,]/g, '')
            const num = parseFloat(val.replace(',', '.'))
            setSupplierForm({ ...supplierForm, taxPct: isNaN(num) ? 0 : num })
          }} />
          <Input label="CUIT/CUIL" value={supplierForm.taxId} onChange={e => setSupplierForm({ ...supplierForm, taxId: e.target.value })} />
          <Input label="Email" value={supplierForm.email} onChange={e => setSupplierForm({ ...supplierForm, email: e.target.value })} />
        </div>
      </Modal>

      <Card>
        <div className="flex justify-between items-center">
          <h3 className="font-semibold">Ítems de compra</h3>
          <Button type="button" variant="success" onClick={addItem}>Agregar ítem</Button>
        </div>
        <div className="space-y-2 mt-2">
          {items.map((it, idx) => {
            const q = (itemQueries[idx] || '').trim().toLowerCase()
            const selected = products.find(p => p.id === Number(it.productId))
            const suggestions = (!selected && q.length >= 1) ? products.filter(p => [p.name, p.sku, p.barcode, p.category].some(v => (v || '').toLowerCase().includes(q))).slice(0, 8) : []
            const piUnit = computePI(it.unitCost, form.taxPct)
            return (
              <div key={idx} className="grid grid-cols-1 md:grid-cols-5 gap-3 items-end">
                <div className="md:col-span-2 relative">
                  <Input label="Buscar producto" value={itemQueries[idx] || ''} onChange={e => {
                    const val = e.target.value
                    setItemQueries(prev => prev.map((x, i) => i === idx ? val : x))
                    setItemActive(prev => ({ ...prev, [idx]: 0 }))
                  }} onKeyDown={e => {
                    if (e.key === 'ArrowDown' && suggestions.length > 0) {
                      e.preventDefault(); e.stopPropagation()
                      setItemActive(prev => ({ ...prev, [idx]: Math.min((prev[idx] ?? 0) + 1, suggestions.length - 1) }))
                    } else if (e.key === 'ArrowUp' && suggestions.length > 0) {
                      e.preventDefault(); e.stopPropagation()
                      setItemActive(prev => ({ ...prev, [idx]: Math.max((prev[idx] ?? 0) - 1, 0) }))
                    } else if (e.key === 'Enter' && suggestions.length > 0) {
                      e.preventDefault(); e.stopPropagation()
                      const ai = Math.min(Math.max((itemActive[idx] ?? 0), 0), suggestions.length - 1)
                      const s = suggestions[ai]
                      updateItem(idx, { productId: String(s.id) })
                      setItemQueries(prev => prev.map((x, i) => i === idx ? '' : x))
                      setItemActive(prev => { const { [idx]: _, ...rest } = prev; return rest })
                    }
                  }} placeholder="Nombre, código, categoría…" ref={idx === items.length - 1 ? addQueryRef : undefined} />
                  {suggestions.length > 0 && (
                    <div className="mt-1 border rounded bg-white shadow text-sm max-h-60 overflow-auto z-10">
                      <div className="px-2 py-1 text-xs text-slate-600">Coincidencias</div>
                      {suggestions.map((s, i) => {
                        const isActive = i === Math.min(Math.max((itemActive[idx] ?? 0), 0), suggestions.length - 1)
                        return (
                          <Button type="button" key={s.id} variant="outline" size="sm" className={`w-full text-left px-2 py-1 flex items-center justify-between ${isActive ? 'bg-indigo-200 ring-2 ring-indigo-400' : 'hover:bg-gray-50'}`} onMouseDown={() => {
                            updateItem(idx, { productId: String(s.id) })
                            setItemQueries(prev => prev.map((x, i2) => i2 === idx ? '' : x))
                            setItemActive(prev => { const { [idx]: _, ...rest } = prev; return rest })
                          }}>
                            <span className="whitespace-normal break-words">{s.name}</span>
                            <span className="text-xs text-slate-600 ml-2">{s.barcode || s.sku || s.category || ''}</span>
                          </Button>
                        )
                      })}
                    </div>
                  )}
                </div>
                <Input label="Cantidad" type="text" value={itemQtyText[idx] ?? String(it.qty)} onChange={e => {
                  let val = e.target.value || ''
                  val = val.replace(/[^\d,]/g, '').replace(/\./g, ',')
                  const num = parseFloat(val.replace(',', '.'))
                  setItemQtyText(prev => prev.map((x, i) => i === idx ? val : x))
                  updateItem(idx, { qty: isNaN(num) ? 0 : num })
                }} />
                <Input label="PU" type="text" value={itemCostText[idx] ?? String(it.unitCost)} onChange={e => {
                  let val = e.target.value || ''
                  val = val.replace(/[^\d,]/g, '').replace(/\./g, ',')
                  const num = parseMoney(val)
                  setItemCostText(prev => prev.map((x, i) => i === idx ? val : x))
                  updateItem(idx, { unitCost: isNaN(num) ? 0 : num })
                }} />
                <Input label="Impuestos (%)" type="text" value={String(form.taxPct)} onChange={e => {
                  let val = e.target.value || ''
                  val = val.replace(/[^\d,]/g, '').replace(/\./g, ',')
                  const num = parseFloat(val.replace(',', '.'))
                  setForm(prev => ({ ...prev, taxPct: isNaN(num) ? 0 : num }))
                }} />
                <div className="p-2 border rounded bg-gray-50">
                  <div className="text-xs text-slate-600">PI</div>
                  <div className="font-semibold">{formatMoney(piUnit)}</div>
                </div>
              </div>
            )
          })}
        </div>
        <div className="mt-4">
          {items.map((it, idx) => {
            const prod = products.find(p => p.id === Number(it.productId))
            const pi = computePI(it.unitCost, form.taxPct)
            const units = parseInt(prod?.unitsPerBox || 0, 10)
            const isWeigh = !!prod?.weighable
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
              <div key={`variants-${idx}`} className="grid grid-cols-1 md:grid-cols-2 gap-2 p-2 border rounded mt-2">
                <div className="text-sm text-slate-700">{prod ? prod.name : '—'}</div>
                <div className="grid grid-cols-1 gap-2">
                  {lines.map(line => (
                    <div key={line.variant} className="flex items-center gap-2">
                      <span className="w-40">{line.label}</span>
                      <span className="font-semibold">{formatMoney(line.price)}</span>
                      <Select value={vlists[line.variant] || ''} onChange={e => {
                        const id = e.target.value
                        setItems(prev => prev.map((x, i) => i === idx ? { ...x, variantLists: { ...(x.variantLists || {}), [line.variant]: id } } : x))
                      }}>
                        <option value="">Lista…</option>
                        {lists.map(l => <option key={l.id} value={String(l.id)}>{l.name}</option>)}
                      </Select>
                      <Button type="button" variant="outline" size="sm" onClick={async () => {
                        const listId = Number((it.variantLists || {})[line.variant])
                        const pid = Number(it.productId)
                        if (!pid || !listId) { show('Elegí lista para aplicar', 'warning'); return }
                        const ex = await db.prices.where('listId').equals(listId).and(r => r.productId === pid && (r.variant || 'unidad') === line.variant).first()
                        if (ex) await db.prices.put({ id: ex.id, listId, productId: pid, price: line.price, variant: line.variant })
                        else await db.prices.add({ listId, productId: pid, price: line.price, variant: line.variant })
                        show(`Aplicado ${line.label}`, 'success')
                      }}>Aplicar</Button>
                    </div>
                  ))}
                </div>
              </div>
            )
          })}
          <div className="mt-3">
            <Button type="button" variant="primary" onClick={savePurchase}>Guardar compra</Button>
          </div>
        </div>
      </Card>

      <Card title="Compras recientes">
        <div className="overflow-auto">
          <table className="min-w-full border border-slate-200 rounded">
            <thead>
              <tr className="bg-slate-50 text-slate-700">
                <th className="text-left px-3 py-2 border border-slate-200">Número</th>
                <th className="text-left px-3 py-2 border border-slate-200">Proveedor</th>
                <th className="text-left px-3 py-2 border border-slate-200">Fecha</th>
                <th className="text-left px-3 py-2 border border-slate-200">Impuestos</th>
                <th className="text-right px-3 py-2 border border-slate-200">Total</th>
              </tr>
            </thead>
            <tbody>
              {purchases.length === 0 && (
                <tr>
                  <td colSpan="5" className="px-3 py-3 text-slate-600 text-center"><Badge variant="default">Sin compras</Badge></td>
                </tr>
              )}
              {purchases.map(p => {
                const sup = suppliers.find(s => s.id === Number(p.supplierId))
                return (
                  <tr key={p.id} className="hover:bg-slate-50">
                    <td className="px-3 py-2 border border-slate-200">{p.number}</td>
                    <td className="px-3 py-2 border border-slate-200">{sup ? sup.name : `#${p.supplierId}`}</td>
                    <td className="px-3 py-2 border border-slate-200">{new Date(p.date).toLocaleDateString()}</td>
                    <td className="px-3 py-2 border border-slate-200">{String(p.taxPct)}%</td>
                    <td className="px-3 py-2 border border-slate-200 text-right">{formatMoney(p.total)}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  )
}