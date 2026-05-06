import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { db } from '../data/db'
import Card from '../components/Card'
import Button from '../components/Button'
import Input from '../components/Input'
import Select from '../components/Select'
import Modal from '../components/Modal'
import UnsavedChangesBar from '../components/UnsavedChangesBar'
import { useToast } from '../components/ToastContext'
import { formatMoney } from '../utils/format'
import Badge from '../components/Badge'
import { useFormDirty } from '../hooks/useDirtyState'

export default function Invoices() {
  const navigate = useNavigate()
  const [customers, setCustomers] = useState([])
  const [lists, setLists] = useState([])
  const [products, setProducts] = useState([])
  const [form, setForm] = useState({ customerId: '', listId: '', date: new Date().toISOString().slice(0,10), saleCondition: 'Contado' })
  const initialForm = { customerId: '', listId: '', date: new Date().toISOString().slice(0,10), saleCondition: 'Contado' }
  const isDirtyForm = useFormDirty(initialForm, form)
  
  // Validación visual del formulario
  const [errors, setErrors] = useState({ customerId: false, items: false })
  
  const [items, setItems] = useState([])
  const [itemQueries, setItemQueries] = useState([])
  const [itemQtyText, setItemQtyText] = useState([])
  const [itemPriceText, setItemPriceText] = useState([])
  const [itemActive, setItemActive] = useState({})
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [deleteIdx, setDeleteIdx] = useState(null)
  const [invoices, setInvoices] = useState([])
  const [detailOpen, setDetailOpen] = useState(false)
  const [detailInvoice, setDetailInvoice] = useState(null)
  const [detailItems, setDetailItems] = useState([])
  const [loadingDetail, setLoadingDetail] = useState(false)
  // Eliminación de factura
  const [deleteInvoiceOpen, setDeleteInvoiceOpen] = useState(false)
  const [invoiceToDelete, setInvoiceToDelete] = useState(null)
  // Edición de comprobantes
  const [editOpen, setEditOpen] = useState(false)
  const [editInvoice, setEditInvoice] = useState(null)
  const [editForm, setEditForm] = useState({ date: new Date().toISOString().slice(0,10), saleCondition: 'Contado' })
  const [editItems, setEditItems] = useState([])
  const [editItemQueries, setEditItemQueries] = useState([])
  const [editItemQtyText, setEditItemQtyText] = useState([])
  const [editItemPriceText, setEditItemPriceText] = useState([])
  const [editItemActive, setEditItemActive] = useState({})
  const [editDeleteOpen, setEditDeleteOpen] = useState(false)
  const [editDeleteIdx, setEditDeleteIdx] = useState(null)
  const { show } = useToast()

  // Papelera de reciclaje (30 días)
  const [trashOpen, setTrashOpen] = useState(false)
  const [trash, setTrash] = useState([])
  const trashSummaryByCustomer = useMemo(() => {
    const map = new Map()
    trash.forEach(t => {
      const cid = t?.data?.invoice?.customerId
      if (!cid) return
      map.set(cid, (map.get(cid) || 0) + 1)
    })
    return Array.from(map.entries()).map(([customerId, count]) => ({ customerId, count })).sort((a,b) => b.count - a.count)
  }, [trash])

  useEffect(() => { db.customers.toArray().then(setCustomers) }, [])
  useEffect(() => { db.priceLists.toArray().then(setLists) }, [])
  useEffect(() => { db.products.toArray().then(setProducts) }, [])
  useEffect(() => { db.invoices.toArray().then(arr => setInvoices(arr.sort((a,b) => new Date(b.date) - new Date(a.date)))) }, [])
  useEffect(() => { loadTrash() }, [])

  const pricesByKey = useMemo(() => {
    const map = new Map()
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

  function computeUnitPrice(productId, qty, variant) {
    const p = products.find(x => x.id === Number(productId))
    if (!p) return 0
    const pv = pricesByKey.get(Number(productId)) || {}
    if (p.weighable) {
      return pv.unidad ?? 0
    }
    const v = variant || 'unidad'
    if (v === 'caja') {
      if (pv.caja != null) return pv.caja
      const units = parseInt(p.unitsPerBox || 0, 10)
      const totalUnits = (qty ?? 0) * (units || 0)
      const baseUnit = (totalUnits >= 5 && pv.mayor != null) ? pv.mayor : (pv.unidad ?? 0)
      return units > 0 ? (baseUnit * units) : baseUnit
    }
    if ((qty ?? 0) >= 5 && pv.mayor != null) return pv.mayor
    return pv.unidad ?? 0
  }

  const total = useMemo(() => items.reduce((acc, it) => acc + it.qty * it.unitPrice, 0), [items])

  

  function addItem() {
    setItems(prev => ([...prev, { productId: '', qty: 1, unitPrice: 0, variant: 'unidad' }]))
    setItemQueries(prev => ([...prev, '']))
    setItemQtyText(prev => ([...prev, '1']))
    setItemPriceText(prev => ([...prev, '0']))
  }

  function updateItem(idx, patch) {
    setItems(prev => prev.map((it, i) => i === idx ? { ...it, ...patch } : it))
  }

  async function doSaveInvoice() {
    if (!form.customerId || items.length === 0) return
    const number = (await db.invoices.count()) + 1
    const invId = await db.invoices.add({ number, customerId: Number(form.customerId), date: new Date(form.date).toISOString(), total, condition: form.saleCondition || 'Contado' })
    await db.invoiceItems.bulkAdd(items.map(it => ({
      invoiceId: invId,
      productId: Number(it.productId),
      qty: Number(it.qty),
      unitPrice: Number(it.unitPrice),
      total: Number(it.qty) * Number(it.unitPrice)
    })))
    await db.ledger.add({ customerId: Number(form.customerId), date: new Date(form.date).toISOString(), type: 'debe', amount: total, reference: `Factura ${number}` })
    // Reset formulario
    setForm(initialForm)
    setItems([])
    setErrors({ customerId: false, items: false })
    // Refrescar listado de facturas
    const list = await db.invoices.toArray()
    setInvoices(list.sort((a,b) => new Date(b.date) - new Date(a.date)))
    show('Factura guardada', 'success')
  }

  function saveInvoice(e) {
    e.preventDefault()
    let hasErrors = false
    const newErrors = { customerId: false, items: false }
    
    if (!form.customerId) {
      newErrors.customerId = true
      hasErrors = true
    }
    if (items.length === 0) {
      newErrors.items = true
      hasErrors = true
    }
    
    setErrors(newErrors)
    
    if (hasErrors) {
      show('Por favor completa los campos requeridos', 'warning')
      return
    }
    
    setConfirmOpen(true)
  }

  function customerNameById(id) {
    const c = customers.find(x => x.id === Number(id))
    return c ? c.name : '—'
  }

  async function openInvoice(inv) {
    setDetailInvoice(inv)
    setDetailItems([])
    setLoadingDetail(true)
    const rows = await db.invoiceItems.where('invoiceId').equals(inv.id).toArray()
    const itemsWithProduct = rows.map(r => {
      const p = products.find(x => x.id === Number(r.productId))
      return {
        productName: p ? p.name : `#${r.productId}`,
        qty: r.qty,
        unitPrice: r.unitPrice,
        total: r.total
      }
    })
    setDetailItems(itemsWithProduct)
    setLoadingDetail(false)
    setDetailOpen(true)
  }

  // --- Edición de comprobantes emitidos ---
  function editAddItem() {
    setEditItems(prev => ([...prev, { productId: '', qty: 1, unitPrice: 0, variant: 'unidad' }]))
    setEditItemQueries(prev => ([...prev, '']))
    setEditItemQtyText(prev => ([...prev, '1']))
    setEditItemPriceText(prev => ([...prev, '0']))
  }

  function editUpdateItem(idx, patch) {
    setEditItems(prev => prev.map((it, i) => i === idx ? { ...it, ...patch } : it))
  }

  async function startEdit(inv) {
    setEditInvoice(inv)
    setEditForm({ date: new Date(inv.date).toISOString().slice(0,10), saleCondition: inv.condition || 'Contado' })
    const rows = await db.invoiceItems.where('invoiceId').equals(inv.id).toArray()
    const mapped = rows.map(r => ({ productId: String(r.productId), qty: Number(r.qty), unitPrice: Number(r.unitPrice), variant: 'unidad' }))
    setEditItems(mapped)
    // Prellenar textos
    const qs = mapped.map(m => { const p = products.find(x => x.id === Number(m.productId)); return p ? p.name : '' })
    setEditItemQueries(qs)
    setEditItemQtyText(mapped.map(m => String(m.qty).replace('.', ',')))
    setEditItemPriceText(mapped.map(m => String(m.unitPrice).replace('.', ',')))
    setEditItemActive({})
    setEditOpen(true)
  }

  const editTotal = useMemo(() => editItems.reduce((acc, it) => acc + it.qty * it.unitPrice, 0), [editItems])

  async function saveEditChanges() {
    if (!editInvoice) return
    if (editItems.length === 0) { show('Agrega al menos un ítem', 'warning'); return }
    const newDateIso = new Date(editForm.date).toISOString()
    const newTotal = editTotal
    // Actualizar factura
    await db.invoices.update(editInvoice.id, { date: newDateIso, total: newTotal, condition: editForm.saleCondition || 'Contado' })
    // Reemplazar ítems
    await db.invoiceItems.where('invoiceId').equals(editInvoice.id).delete()
    await db.invoiceItems.bulkAdd(editItems.map(it => ({
      invoiceId: editInvoice.id,
      productId: Number(it.productId),
      qty: Number(it.qty),
      unitPrice: Number(it.unitPrice),
      total: Number(it.qty) * Number(it.unitPrice)
    })))
    // Actualizar movimiento en cuenta corriente (debe) por referencia
    const moves = await db.ledger.where('customerId').equals(editInvoice.customerId).toArray()
    const refText = `Factura ${editInvoice.number}`
    const matchMove = moves.find(m => m.type === 'debe' && String(m.reference || '') === refText)
    if (matchMove) {
      await db.ledger.update(matchMove.id, { amount: newTotal, date: newDateIso })
    }
    // Refrescar listado
    const list = await db.invoices.toArray()
    setInvoices(list.sort((a,b) => new Date(b.date) - new Date(a.date)))
    setEditOpen(false)
    setEditInvoice(null)
    show('Comprobante actualizado', 'success')
  }

  // --- Eliminación de factura ---
  function startDeleteInvoice(inv) {
    setInvoiceToDelete(inv)
    setDeleteInvoiceOpen(true)
  }

  async function doDeleteInvoice() {
    if (!invoiceToDelete) return
    const inv = invoiceToDelete
    // Preparar datos para papelera (factura + ítems + movimientos vinculados)
    const items = await db.invoiceItems.where('invoiceId').equals(inv.id).toArray()
    const refText = `Factura ${inv.number}`
    const moves = await db.ledger.where('reference').equals(refText).toArray()
    const now = new Date()
    const deletedAt = now.toISOString()
    const purgeAt = new Date(now.getTime() + 30*24*60*60*1000).toISOString()
    await db.trash.add({
      type: 'invoice',
      reference: refText,
      deletedAt,
      purgeAt,
      data: { invoice: inv, items, moves }
    })
    // Eliminar registros originales
    await db.invoiceItems.where('invoiceId').equals(inv.id).delete()
    await db.invoices.delete(inv.id)
    await db.ledger.where('reference').equals(refText).delete()
    // Refrescar listado
    const list = await db.invoices.toArray()
    setInvoices(list.sort((a,b) => new Date(b.date) - new Date(a.date)))
    setInvoiceToDelete(null)
    await loadTrash()
    show('Factura enviada a papelera (30 días)', 'info')
  }

  // Cargar papelera y purgar vencidos
  async function loadTrash() {
    const nowIso = new Date().toISOString()
    const expired = await db.trash.where('purgeAt').below(nowIso).toArray()
    if (expired.length > 0) {
      await db.trash.bulkDelete(expired.map(x => x.id))
    }
    const arr = await db.trash.where('type').equals('invoice').toArray()
    setTrash(arr.sort((a,b) => new Date(b.deletedAt) - new Date(a.deletedAt)))
  }

  // Restaurar desde papelera
  async function restoreFromTrash(item) {
    const data = item.data || {}
    const inv = data.invoice
    const items = data.items || []
    const moves = data.moves || []
    if (!inv) { show('No hay datos para restaurar', 'warning'); return }
    // Si el número ya existe, asignar el siguiente número libre
    const exists = await db.invoices.where('number').equals(inv.number).count()
    let number = inv.number
    let refText = `Factura ${number}`
    if (exists > 0) {
      number = (await db.invoices.count()) + 1
      refText = `Factura ${number}`
    }
    const { id: _oldId, number: _oldNumber, ...restInv } = inv
    const newInvId = await db.invoices.add({ ...restInv, number })
    if (items.length > 0) {
      await db.invoiceItems.bulkAdd(items.map(r => ({
        invoiceId: newInvId,
        productId: Number(r.productId),
        qty: Number(r.qty),
        unitPrice: Number(r.unitPrice),
        total: Number(r.total)
      })))
    }
    // Restaurar movimientos, actualizando referencia si cambió el número
    for (const m of moves) {
      const { id: _mid, reference: _oldRef, ...rest } = m
      await db.ledger.add({ ...rest, reference: refText })
    }
    // Remover de papelera y refrescar
    await db.trash.delete(item.id)
    const list = await db.invoices.toArray()
    setInvoices(list.sort((a,b) => new Date(b.date) - new Date(a.date)))
    await loadTrash()
    show('Factura restaurada', 'success')
  }

  // Borrado definitivo desde papelera
  async function deletePermanently(item) {
    await db.trash.delete(item.id)
    await loadTrash()
    show('Elemento borrado definitivamente', 'info')
  }

  async function restoreAllFromTrash() {
    if (trash.length === 0) return
    const ok = window.confirm('¿Restaurar todos los elementos de la papelera?')
    if (!ok) return
    for (const t of trash) {
      await restoreFromTrash(t)
    }
    await loadTrash()
    show('Todos los elementos restaurados', 'success')
  }

  async function emptyTrash() {
    if (trash.length === 0) return
    const ok = window.confirm('¿Vaciar la papelera de forma definitiva? Esta acción no se puede deshacer.')
    if (!ok) return
    await db.trash.bulkDelete(trash.map(t => t.id))
    await loadTrash()
    show('Papelera vaciada', 'info')
  }

  return (
    <div className="max-w-7xl mx-auto space-y-6 p-4 pb-24">
<h2 className="text-2xl font-bold tracking-tight text-slate-800">Emitir factura</h2>
      <Card>
        <form onSubmit={saveInvoice} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-5 gap-3 items-end">
            <Select 
              label="Cliente" 
              value={form.customerId} 
              onChange={e => {
                setForm({ ...form, customerId: e.target.value })
                setErrors({ ...errors, customerId: false })
              }}
              error={errors.customerId}
              errorMessage={errors.customerId ? 'Selecciona un cliente' : ''}
            >
              <option value="">Seleccione…</option>
              {customers.map(c => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </Select>
            <Select label="Lista de precios" value={form.listId} onChange={e => setForm({ ...form, listId: e.target.value })}>
              <option value="">Seleccione…</option>
              {lists.map(l => (
                <option key={l.id} value={l.id}>{l.name}</option>
              ))}
            </Select>
            <Input label="Fecha" type="date" value={form.date} onChange={e => setForm({ ...form, date: e.target.value })} />
            <Select label="Condición de venta" value={form.saleCondition} onChange={e => setForm({ ...form, saleCondition: e.target.value })}>
              <option value="Contado">Contado</option>
              <option value="Cuenta corriente">Cuenta corriente</option>
              <option value="Tarjeta">Tarjeta</option>
              <option value="Transferencia">Transferencia</option>
            </Select>
            <div className="p-3 bg-slate-50 rounded border border-slate-200 text-slate-700">Total: <span className="font-semibold">{formatMoney(total)}</span></div>
          </div>

          <div className="space-y-2">
            <div className="flex justify-between items-center">
              <h3 className="font-semibold">
                Ítems
                {errors.items && <span className="text-red-600 text-sm ml-2">⚠️ Agrega al menos un ítem</span>}
              </h3>
              <Button type="button" variant="success" onClick={addItem}>Agregar ítem</Button>
            </div>
            <div className="space-y-2">
              {items.map((it, idx) => {
                const q = (itemQueries[idx] || '').trim().toLowerCase()
                const selected = products.find(p => p.id === Number(it.productId))
                const suggestions = (!selected && q.length >= 1) ? products.filter(p => [p.name, p.sku, p.barcode, p.category].some(v => (v || '').toLowerCase().includes(q))).slice(0, 8) : []
                return (
                <div key={idx} className="grid grid-cols-1 md:grid-cols-5 gap-3 items-end">
                  <div className="md:col-span-3 relative">
                    <Input label="Buscar producto" value={itemQueries[idx] || ''} onChange={e => {
                      const val = e.target.value
                      setItemQueries(prev => prev.map((x, i) => i === idx ? val : x))
                      setItemActive(prev => ({ ...prev, [idx]: 0 }))
                    }} onKeyDown={e => {
                      if (e.key === 'ArrowDown' && suggestions.length > 0) {
                        e.preventDefault()
                        e.stopPropagation()
                        setItemActive(prev => {
                          const cur = prev[idx] ?? 0
                          const next = Math.min(cur + 1, suggestions.length - 1)
                          return { ...prev, [idx]: next }
                        })
                      } else if (e.key === 'ArrowUp' && suggestions.length > 0) {
                        e.preventDefault()
                        e.stopPropagation()
                        setItemActive(prev => {
                          const cur = prev[idx] ?? 0
                          const next = Math.max(cur - 1, 0)
                          return { ...prev, [idx]: next }
                        })
                      } else if (e.key === 'Home' && suggestions.length > 0) {
                        e.preventDefault()
                        e.stopPropagation()
                        setItemActive(prev => ({ ...prev, [idx]: 0 }))
                      } else if (e.key === 'End' && suggestions.length > 0) {
                        e.preventDefault()
                        e.stopPropagation()
                        setItemActive(prev => ({ ...prev, [idx]: Math.max(0, suggestions.length - 1) }))
                      } else if ((e.key === 'Enter' || e.key === 'NumpadEnter') && suggestions.length > 0) {
                        e.preventDefault()
                        e.stopPropagation()
                        const ai = Math.min(Math.max((itemActive[idx] ?? 0), 0), suggestions.length - 1)
                        const s = suggestions[ai]
                        const qty = items[idx]?.qty ?? 0
                        const variant = items[idx]?.variant || 'unidad'
                        const price = computeUnitPrice(s.id, qty, variant)
                        updateItem(idx, { productId: String(s.id), unitPrice: price })
                        setItemQueries(prev => prev.map((x, i) => i === idx ? '' : x))
                        setItemPriceText(prev => prev.map((x, i) => i === idx ? formatMoney(price) : x))
                        setItemActive(prev => { const { [idx]: _, ...rest } = prev; return rest })
                      } else if (e.key === 'Escape') {
                        setItemActive(prev => {
                          const { [idx]: _, ...rest } = prev
                          return rest
                        })
                      }
                    }} placeholder="Nombre, código, categoría…" />
                    {selected && (
                      <div className="absolute right-0 top-0 flex items-center gap-2 text-xs text-slate-700">
                        <span className="px-2 py-0.5 rounded border bg-gray-50">{selected.name}</span>
                        <span className="text-slate-600">{selected.barcode || selected.sku || selected.category || ''}</span>
                        <Button type="button" variant="secondary" size="sm" className="px-2 py-0 text-xs" onClick={() => {
                          updateItem(idx, { productId: '', unitPrice: 0 })
                          setItemPriceText(prev => prev.map((x, i) => i === idx ? '0' : x))
                        }}>Quitar</Button>
                      </div>
                    )}
                    {suggestions.length > 0 && (
                      <div className="mt-1 border rounded bg-white shadow text-sm max-h-60 overflow-auto z-10">
                        <div className="px-2 py-1 text-xs text-slate-600">Coincidencias</div>
                        {suggestions.map((s, i) => {
                          const isActive = i === Math.min(Math.max((itemActive[idx] ?? 0), 0), suggestions.length - 1)
                          return (
                            <Button type="button" key={s.id} variant="outline" size="sm" className={`w-full text-left px-2 py-1 flex items-center justify-between ${isActive ? 'bg-indigo-200 ring-2 ring-indigo-400' : 'hover:bg-gray-50'}`} onMouseDown={() => {
                              const qty = items[idx]?.qty ?? 0
                              const variant = items[idx]?.variant || 'unidad'
                              const newPrice = computeUnitPrice(s.id, qty, variant)
                              updateItem(idx, { productId: String(s.id), unitPrice: newPrice })
                              setItemQueries(prev => prev.map((x, i2) => i2 === idx ? '' : x))
                              setItemPriceText(prev => prev.map((x, i2) => i2 === idx ? formatMoney(newPrice) : x))
                              setItemActive(prev => { const { [idx]: _, ...rest } = prev; return rest })
                            }} onClick={() => {
                              const qty = items[idx]?.qty ?? 0
                              const variant = items[idx]?.variant || 'unidad'
                              const newPrice = computeUnitPrice(s.id, qty, variant)
                              updateItem(idx, { productId: String(s.id), unitPrice: newPrice })
                              setItemQueries(prev => prev.map((x, i2) => i2 === idx ? '' : x))
                              setItemPriceText(prev => prev.map((x, i2) => i2 === idx ? formatMoney(newPrice) : x))
                              setItemActive(prev => { const { [idx]: _, ...rest } = prev; return rest })
                            }}>
                              <span className="whitespace-normal break-words">{s.name}</span>
                              <div className="flex items-center gap-2 ml-2">
                                <span className="text-xs text-slate-600">{s.barcode || s.sku || s.category || ''}</span>
                              {(() => {
                                const pv = pricesByKey.get(Number(s.id)) || {}
                                const u = pv.unidad ?? 0
                                const m = pv.mayor
                                const c = pv.caja
                                return (
                                  <div className="flex items-center gap-2">
                                    <span className="text-xs text-slate-800">{formatMoney(u)}</span>
                                    {m != null ? <span className="text-xs text-slate-600">Mayor: {formatMoney(m)}</span> : null}
                                    {c != null ? <span className="text-xs text-slate-600">Caja: {formatMoney(c)}</span> : null}
                                  </div>
                                )
                              })()}
                              </div>
                            </Button>
                          )
                        })}
                      </div>
                    )}
                  </div>
                  <Input label="Cantidad" type="text" value={itemQtyText[idx] ?? String(it.qty)} onChange={e => {
                    let val = e.target.value
                    val = val.replace(/\./g, ',')
                    val = val.replace(/[^0-9,]/g, '')
                    const parts = val.split(',')
                    if (parts.length > 2) {
                      val = parts[0] + ',' + parts.slice(1).join('').replace(/,/g, '')
                    }
                    setItemQtyText(prev => prev.map((x, i) => i === idx ? val : x))
                    const num = parseFloat(val.replace(',', '.'))
                    const newQty = isNaN(num) ? 0 : num
                    const variant = items[idx]?.variant || 'unidad'
                    const productId = items[idx]?.productId
                    const autoPrice = productId ? computeUnitPrice(productId, newQty, variant) : items[idx]?.unitPrice
                    updateItem(idx, { qty: newQty, unitPrice: autoPrice })
                    setItemPriceText(prev => prev.map((x, i) => i === idx ? formatMoney(autoPrice ?? 0) : x))
                  }} placeholder="Ej: 1,25" />
                  <Select label="Variante" value={it.variant || 'unidad'} disabled={!!selected?.weighable} onChange={e => {
                    const v = e.target.value
                    const productId = items[idx]?.productId
                    const qty = items[idx]?.qty ?? 0
                    const autoPrice = productId ? computeUnitPrice(productId, qty, v) : items[idx]?.unitPrice
                    updateItem(idx, { variant: v, unitPrice: autoPrice })
                    setItemPriceText(prev => prev.map((x, i) => i === idx ? formatMoney(autoPrice ?? 0) : x))
                  }}>
                    <option value="unidad">Unidad</option>
                    <option value="caja">Caja</option>
                  </Select>
                  {selected && (it.variant || 'unidad') === 'caja' && !selected.weighable && (() => {
                    const pv = pricesByKey.get(Number(selected.id)) || {}
                    const units = parseInt(selected.unitsPerBox || 0, 10)
                    const totalUnits = (items[idx]?.qty ?? 0) * (units || 0)
                    if (pv.caja == null && units > 0) {
                      const usedMayor = (pv.mayor != null) && (totalUnits >= 5)
                      return <div className="text-xs text-slate-600">Usando {usedMayor ? 'mayorista' : 'unidad'} × {units} u/caja</div>
                    }
                    return null
                  })()}
                  <Input label="Precio unitario" type="text" value={itemPriceText[idx] ?? String(it.unitPrice)} onChange={e => {
                    let val = e.target.value
                    val = val.replace(/\./g, ',')
                    val = val.replace(/[^0-9,]/g, '')
                    const parts = val.split(',')
                    if (parts.length > 2) {
                      val = parts[0] + ',' + parts.slice(1).join('').replace(/,/g, '')
                    }
                    setItemPriceText(prev => prev.map((x, i) => i === idx ? val : x))
                    const num = parseFloat(val.replace(',', '.'))
                    updateItem(idx, { unitPrice: isNaN(num) ? 0 : num })
                  }} placeholder="Ej: 10,50" />
                  <div className="p-2 border rounded bg-gray-50">{formatMoney(it.qty * it.unitPrice)}</div>
                  <div>
                    <Button type="button" variant="danger" onClick={() => { setDeleteIdx(idx); setDeleteOpen(true) }}>Eliminar</Button>
                  </div>
                </div>
              )})}
            </div>
          </div>

          <div>
            <Button variant="primary">Guardar factura</Button>
          </div>
        </form>
      </Card>

      <Card>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-lg font-semibold">Facturas emitidas</h3>
        </div>
        <div className="overflow-auto">
          <table className="min-w-full border border-slate-200 rounded">
            <thead>
              <tr className="bg-slate-50 text-slate-700">
                <th className="text-left px-3 py-2 border border-slate-200">Número</th>
                <th className="text-left px-3 py-2 border border-slate-200">Cliente</th>
                <th className="text-left px-3 py-2 border border-slate-200">Fecha</th>
                <th className="text-left px-3 py-2 border border-slate-200">Total</th>
                <th className="text-left px-3 py-2 border border-slate-200">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {invoices.length === 0 && (
                <tr>
<td colSpan="5" className="px-3 py-3 text-slate-600 text-center"><Badge variant="default">No hay facturas todavía</Badge></td>
                </tr>
              )}
              {invoices.map(inv => (
                <tr key={inv.id} className="hover:bg-slate-50">
                  <td className="px-3 py-2 border border-slate-200">{inv.number}</td>
                  <td className="px-3 py-2 border border-slate-200">{customerNameById(inv.customerId)}</td>
                  <td className="px-3 py-2 border border-slate-200">{new Date(inv.date).toLocaleDateString()}</td>
                  <td className="px-3 py-2 border border-slate-200">{formatMoney(inv.total)}</td>
                  <td className="px-3 py-2 border border-slate-200">
                    <div className="flex gap-2">
                      <Button type="button" variant="secondary" onClick={() => openInvoice(inv)}>Ver</Button>
                      <Button type="button" variant="primary" onClick={() => startEdit(inv)}>Editar</Button>
                      <Button type="button" variant="danger" onClick={() => startDeleteInvoice(inv)}>Eliminar</Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <Card>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-lg font-semibold">Papelera (30 días)</h3>
          <div className="flex items-center gap-2">
            <Badge variant="default">{trash.length} en papelera</Badge>
            <Button type="button" variant="secondary" onClick={() => setTrashOpen(o => !o)}>{trashOpen ? 'Ocultar' : 'Mostrar'}</Button>
            <Button type="button" variant="outline" onClick={loadTrash}>Actualizar</Button>
            <Button type="button" variant="success" onClick={restoreAllFromTrash}>Restaurar todo</Button>
            <Button type="button" variant="danger" onClick={emptyTrash}>Vaciar papelera</Button>
          </div>
        </div>
        {trashOpen && (
          <div className="overflow-auto">
            {trashSummaryByCustomer.length > 0 && (
              <div className="mb-3 text-sm text-slate-700">
                <span className="mr-2">Resumen por cliente:</span>
                {trashSummaryByCustomer.slice(0, 6).map(s => (
                  <span key={s.customerId} className="mr-3">
                    <span className="font-semibold">{customerNameById(s.customerId)}</span> ({s.count})
                  </span>
                ))}
              </div>
            )}
            <table className="min-w-full border border-slate-200 rounded">
              <thead>
                <tr className="bg-slate-50 text-slate-700">
                  <th className="text-left px-3 py-2 border border-slate-200">Referencia</th>
                  <th className="text-left px-3 py-2 border border-slate-200">Cliente</th>
                  <th className="text-left px-3 py-2 border border-slate-200">Eliminado</th>
                  <th className="text-left px-3 py-2 border border-slate-200">Expira</th>
                  <th className="text-left px-3 py-2 border border-slate-200">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {trash.length === 0 && (
                  <tr>
                    <td colSpan="5" className="px-3 py-3 text-slate-600 text-center"><Badge variant="default">No hay elementos en papelera</Badge></td>
                  </tr>
                )}
                {trash.map(t => (
                  <tr key={t.id} className="hover:bg-slate-50">
                    <td className="px-3 py-2 border border-slate-200">{t.reference}</td>
                    <td className="px-3 py-2 border border-slate-200">{customerNameById(t?.data?.invoice?.customerId)}</td>
                    <td className="px-3 py-2 border border-slate-200">{new Date(t.deletedAt).toLocaleDateString()}</td>
                    <td className="px-3 py-2 border border-slate-200">
                      <div>{new Date(t.purgeAt).toLocaleDateString()}</div>
                      <div className="text-xs mt-1">
                        {(() => {
                          const days = Math.max(0, Math.ceil((new Date(t.purgeAt).getTime() - Date.now()) / (1000*60*60*24)))
                          return <Badge variant="default">Expira en {days} días</Badge>
                        })()}
                      </div>
                    </td>
                    <td className="px-3 py-2 border border-slate-200">
                      <div className="flex gap-2">
                        <Button type="button" variant="success" onClick={() => restoreFromTrash(t)}>Restaurar</Button>
                        <Button type="button" variant="danger" onClick={() => deletePermanently(t)}>Borrar definitivamente</Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Modal isOpen={confirmOpen} title="Confirmar guardado" onClose={() => setConfirmOpen(false)}
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="secondary" type="button" onClick={() => setConfirmOpen(false)}>Cancelar</Button>
            <Button variant="primary" type="button" onClick={async () => { await doSaveInvoice(); setConfirmOpen(false) }}>Confirmar</Button>
          </div>
        }
      >
        <p>¿Deseas guardar la factura por un total de <span className="font-semibold">{formatMoney(total)}</span>?</p>
      </Modal>

      <Modal isOpen={deleteOpen} title="Eliminar ítem" onClose={() => setDeleteOpen(false)}
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="secondary" type="button" onClick={() => setDeleteOpen(false)}>Cancelar</Button>
            <Button variant="danger" type="button" onClick={() => {
              setItems(prev => prev.filter((_, i) => i !== deleteIdx))
              setItemQueries(prev => prev.filter((_, i) => i !== deleteIdx))
              setItemQtyText(prev => prev.filter((_, i) => i !== deleteIdx))
              setItemPriceText(prev => prev.filter((_, i) => i !== deleteIdx))
              setItemActive(prev => { const { [deleteIdx]: _, ...rest } = prev; return rest })
              setDeleteOpen(false)
              setDeleteIdx(null)
              show('Ítem eliminado', 'info')
            }}>Eliminar</Button>
          </div>
        }
      >
        <p>¿Confirmás eliminar el ítem seleccionado?</p>
      </Modal>

      <Modal isOpen={detailOpen} title={detailInvoice ? `Factura ${detailInvoice.number}` : 'Factura'} onClose={() => setDetailOpen(false)}
        footer={
          <div className="flex justify-between gap-2 w-full">
            <div className="text-sm text-slate-600">Total: <span className="font-semibold">{detailInvoice ? formatMoney(detailInvoice.total) : formatMoney(0)}</span></div>
            <div className="flex gap-2">
              {detailInvoice && (
                <Button type="button" variant="primary" onClick={() => navigate(`/facturas/reporte?invoiceId=${detailInvoice.id}&auto=1`)}>Imprimir</Button>
              )}
              <Button type="button" variant="secondary" onClick={() => setDetailOpen(false)}>Cerrar</Button>
            </div>
          </div>
        }
      >
        {detailInvoice && (
          <div className="space-y-3">
<div className="text-sm text-slate-700">Cliente: <span className="font-semibold">{customerNameById(detailInvoice.customerId)}</span></div>
<div className="text-sm text-slate-700">Fecha: {new Date(detailInvoice.date).toLocaleDateString()}</div>
<div className="text-sm text-slate-700">Condición de venta: <span className="font-semibold">{detailInvoice.condition || '—'}</span></div>
          </div>
        )}
        <div className="mt-3">
          {loadingDetail ? (
<div className="text-slate-600"><Badge variant="default">⏳ Cargando…</Badge></div>
          ) : (
            <table className="min-w-full border border-slate-200 rounded">
              <thead>
                <tr className="bg-slate-50 text-slate-700">
                  <th className="text-left px-3 py-2 border border-slate-200">Producto</th>
                  <th className="text-right px-3 py-2 border border-slate-200">Cantidad</th>
                  <th className="text-right px-3 py-2 border border-slate-200">Precio unitario</th>
                  <th className="text-right px-3 py-2 border border-slate-200">Total</th>
                </tr>
              </thead>
              <tbody>
                {detailItems.length === 0 && (
                  <tr>
<td colSpan="4" className="px-3 py-3 text-slate-600 text-center"><Badge variant="default">Sin ítems</Badge></td>
                  </tr>
                )}
                {detailItems.map((it, idx) => (
                  <tr key={idx}>
                    <td className="px-3 py-2 border border-slate-200">{it.productName}</td>
                    <td className="px-3 py-2 border border-slate-200 text-right">{String(it.qty)}</td>
                    <td className="px-3 py-2 border border-slate-200 text-right">{formatMoney(it.unitPrice)}</td>
                    <td className="px-3 py-2 border border-slate-200 text-right">{formatMoney(it.total)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </Modal>

      {/* Modal de eliminación de factura */}
      <Modal isOpen={deleteInvoiceOpen} title={invoiceToDelete ? `Enviar a papelera: factura ${invoiceToDelete.number}` : 'Enviar a papelera'} onClose={() => setDeleteInvoiceOpen(false)}
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="secondary" type="button" onClick={() => setDeleteInvoiceOpen(false)}>Cancelar</Button>
            <Button variant="danger" type="button" onClick={async () => { await doDeleteInvoice(); setDeleteInvoiceOpen(false) }}>Eliminar</Button>
          </div>
        }
      >
        <p>Esta acción enviará la factura y sus ítems a la <span className="font-semibold">papelera de reciclaje por 30 días</span>, y removerá los movimientos de cuenta vinculados a <span className="font-semibold">Factura {invoiceToDelete?.number}</span>. Podrás restaurar o borrar definitivamente desde la sección Papelera. ¿Confirmás?</p>
      </Modal>

      {/* Modal de edición de comprobante */}
      <Modal isOpen={editOpen} title={editInvoice ? `Editar comprobante #${editInvoice.number}` : 'Editar comprobante'} onClose={() => setEditOpen(false)} className="sm:max-w-[1024px] w-full px-4"
        footer={
          <div className="flex justify-end gap-2">
            <Button type="button" variant="secondary" onClick={() => setEditOpen(false)}>Cancelar</Button>
            <Button type="button" variant="success" onClick={saveEditChanges}>Guardar cambios</Button>
          </div>
        }
      >
        {!editInvoice ? (
<p className="text-slate-600"><Badge variant="default">ℹ️ Selecciona un comprobante</Badge></p>
        ) : (
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-3 items-end">
              <div className="p-3 bg-slate-50 rounded border border-slate-200 text-slate-700">Cliente
                <div className="font-semibold">{customerNameById(editInvoice.customerId)}</div>
              </div>
              <Input label="Fecha" type="date" value={editForm.date} onChange={e => setEditForm({ ...editForm, date: e.target.value })} />
              <Select label="Condición de venta" value={editForm.saleCondition} onChange={e => setEditForm({ ...editForm, saleCondition: e.target.value })}>
                <option value="Contado">Contado</option>
                <option value="Cuenta corriente">Cuenta corriente</option>
                <option value="Tarjeta">Tarjeta</option>
                <option value="Transferencia">Transferencia</option>
              </Select>
              <div className="p-3 bg-slate-50 rounded border border-slate-200 text-slate-700">Total: <span className="font-semibold">{formatMoney(editTotal)}</span></div>
            </div>

            <div className="flex justify-between items-center">
              <h3 className="font-semibold">Ítems</h3>
              <Button type="button" variant="success" onClick={editAddItem}>Agregar ítem</Button>
            </div>
            <div className="space-y-2">
              {editItems.map((it, idx) => {
                const q = (editItemQueries[idx] || '').trim().toLowerCase()
                const selected = products.find(p => p.id === Number(it.productId))
                const suggestions = (!selected && q.length >= 1) ? products.filter(p => [p.name, p.sku, p.barcode, p.category].some(v => (v || '').toLowerCase().includes(q))).slice(0, 8) : []
                return (
                <div key={idx} className="grid grid-cols-1 md:grid-cols-5 gap-3 items-end">
                  <div className="md:col-span-3 relative">
                    <Input label="Buscar producto" value={editItemQueries[idx] || ''} onChange={e => {
                      const val = e.target.value
                      setEditItemQueries(prev => prev.map((x, i) => i === idx ? val : x))
                      setEditItemActive(prev => ({ ...prev, [idx]: 0 }))
                    }} onKeyDown={e => {
                      if (e.key === 'ArrowDown' && suggestions.length > 0) {
                        e.preventDefault()
                        e.stopPropagation()
                        setEditItemActive(prev => {
                          const cur = prev[idx] ?? 0
                          const next = Math.min(cur + 1, suggestions.length - 1)
                          return { ...prev, [idx]: next }
                        })
                      } else if (e.key === 'ArrowUp' && suggestions.length > 0) {
                        e.preventDefault()
                        e.stopPropagation()
                        setEditItemActive(prev => {
                          const cur = prev[idx] ?? 0
                          const next = Math.max(cur - 1, 0)
                          return { ...prev, [idx]: next }
                        })
                      } else if (e.key === 'Home' && suggestions.length > 0) {
                        e.preventDefault()
                        e.stopPropagation()
                        setEditItemActive(prev => ({ ...prev, [idx]: 0 }))
                      } else if (e.key === 'End' && suggestions.length > 0) {
                        e.preventDefault()
                        e.stopPropagation()
                        setEditItemActive(prev => ({ ...prev, [idx]: Math.max(0, suggestions.length - 1) }))
                      } else if ((e.key === 'Enter' || e.key === 'NumpadEnter') && suggestions.length > 0) {
                        e.preventDefault()
                        e.stopPropagation()
                        const ai = Math.min(Math.max((editItemActive[idx] ?? 0), 0), suggestions.length - 1)
                        const s = suggestions[ai]
                        const qty = editItems[idx]?.qty ?? 0
                        const variant = editItems[idx]?.variant || 'unidad'
                        const price = computeUnitPrice(s.id, qty, variant)
                        editUpdateItem(idx, { productId: String(s.id), unitPrice: price })
                        setEditItemQueries(prev => prev.map((x, i) => i === idx ? '' : x))
                        setEditItemActive(prev => { const { [idx]: _, ...rest } = prev; return rest })
                      } else if (e.key === 'Escape') {
                        setEditItemActive(prev => {
                          const { [idx]: _, ...rest } = prev
                          return rest
                        })
                      }
                    }} placeholder="Nombre, código, categoría…" />
                    {selected && (
                      <div className="absolute right-0 top-0 flex items-center gap-2 text-xs text-slate-700">
                        <span className="px-2 py-0.5 rounded border bg-gray-50">{selected.name}</span>
                        <span className="text-slate-600">{selected.barcode || selected.sku || selected.category || ''}</span>
                        <Button type="button" variant="secondary" size="sm" className="px-2 py-0 text-xs" onClick={() => {
                          editUpdateItem(idx, { productId: '', unitPrice: 0 })
                          setEditItemPriceText(prev => prev.map((x, i) => i === idx ? '0' : x))
                        }}>Quitar</Button>
                      </div>
                    )}
                    {suggestions.length > 0 && (
                      <div className="mt-1 border rounded bg-white shadow text-sm max-h-60 overflow-auto z-10">
                        <div className="px-2 py-1 text-xs text-slate-600">Coincidencias</div>
                        {suggestions.map((s, i) => {
                          const isActive = i === Math.min(Math.max((editItemActive[idx] ?? 0), 0), suggestions.length - 1)
                          return (
                            <Button type="button" key={s.id} variant="outline" size="sm" className={`w-full text-left px-2 py-1 flex items-center justify-between ${isActive ? 'bg-indigo-200 ring-2 ring-indigo-400' : 'hover:bg-gray-50'}`} onMouseDown={() => {
                              const qty = editItems[idx]?.qty ?? 0
                              const variant = editItems[idx]?.variant || 'unidad'
                              const price = computeUnitPrice(s.id, qty, variant)
                              editUpdateItem(idx, { productId: String(s.id), unitPrice: price })
                              setEditItemQueries(prev => prev.map((x, i2) => i2 === idx ? '' : x))
                              setEditItemActive(prev => { const { [idx]: _, ...rest } = prev; return rest })
                            }} onClick={() => {
                              const qty = editItems[idx]?.qty ?? 0
                              const variant = editItems[idx]?.variant || 'unidad'
                              const price = computeUnitPrice(s.id, qty, variant)
                              editUpdateItem(idx, { productId: String(s.id), unitPrice: price })
                              setEditItemQueries(prev => prev.map((x, i2) => i2 === idx ? '' : x))
                              setEditItemActive(prev => { const { [idx]: _, ...rest } = prev; return rest })
                            }}>
                              <span className="whitespace-normal break-words">{s.name}</span>
                              <div className="flex items-center gap-2 ml-2">
                                <span className="text-xs text-slate-600">{s.barcode || s.sku || s.category || ''}</span>
                              </div>
                            </Button>
                          )
                        })}
                      </div>
                    )}
                  </div>
                  <Input label="Cantidad" type="text" value={editItemQtyText[idx] ?? String(it.qty)} onChange={e => {
                    let val = e.target.value
                    val = val.replace(/\./g, ',')
                    val = val.replace(/[^0-9,]/g, '')
                    const parts = val.split(',')
                    if (parts.length > 2) {
                      val = parts[0] + ',' + parts.slice(1).join('').replace(/,/g, '')
                    }
                    setEditItemQtyText(prev => prev.map((x, i) => i === idx ? val : x))
                    const num = parseFloat(val.replace(',', '.'))
                    const newQty = isNaN(num) ? 0 : num
                    const variant = editItems[idx]?.variant || 'unidad'
                    const productId = editItems[idx]?.productId
                    const autoPrice = productId ? computeUnitPrice(productId, newQty, variant) : editItems[idx]?.unitPrice
                    editUpdateItem(idx, { qty: newQty, unitPrice: autoPrice })
                    setEditItemPriceText(prev => prev.map((x, i) => i === idx ? formatMoney(autoPrice ?? 0) : x))
                  }} placeholder="Ej: 1,25" />
                  <Select label="Variante" value={it.variant || 'unidad'} disabled={!!selected?.weighable} onChange={e => {
                    const v = e.target.value
                    const productId = editItems[idx]?.productId
                    const qty = editItems[idx]?.qty ?? 0
                    const autoPrice = productId ? computeUnitPrice(productId, qty, v) : editItems[idx]?.unitPrice
                    editUpdateItem(idx, { variant: v, unitPrice: autoPrice })
                    setEditItemPriceText(prev => prev.map((x, i) => i === idx ? formatMoney(autoPrice ?? 0) : x))
                  }}>
                    <option value="unidad">Unidad</option>
                    <option value="caja">Caja</option>
                  </Select>
                  {selected && (it.variant || 'unidad') === 'caja' && !selected.weighable && (() => {
                    const pv = pricesByKey.get(Number(selected.id)) || {}
                    const units = parseInt(selected.unitsPerBox || 0, 10)
                    const totalUnits = (editItems[idx]?.qty ?? 0) * (units || 0)
                    if (pv.caja == null && units > 0) {
                      const usedMayor = (pv.mayor != null) && (totalUnits >= 5)
                      return <div className="text-xs text-slate-600">Usando {usedMayor ? 'mayorista' : 'unidad'} × {units} u/caja</div>
                    }
                    return null
                  })()}
                  <Input label="Precio unitario" type="text" value={editItemPriceText[idx] ?? String(it.unitPrice)} onChange={e => {
                    let val = e.target.value
                    val = val.replace(/\./g, ',')
                    val = val.replace(/[^0-9,]/g, '')
                    const parts = val.split(',')
                    if (parts.length > 2) {
                      val = parts[0] + ',' + parts.slice(1).join('').replace(/,/g, '')
                    }
                    setEditItemPriceText(prev => prev.map((x, i) => i === idx ? val : x))
                    const num = parseFloat(val.replace(',', '.'))
                    editUpdateItem(idx, { unitPrice: isNaN(num) ? 0 : num })
                  }} placeholder="Ej: 10,50" />
                  <div className="p-2 border rounded bg-gray-50">{formatMoney(it.qty * it.unitPrice)}</div>
                  <div>
                    <Button type="button" variant="danger" onClick={() => { setEditDeleteIdx(idx); setEditDeleteOpen(true) }}>Eliminar</Button>
                  </div>
                </div>
              )})}
            </div>
          </div>
        )}
      </Modal>

      {/* Confirmación eliminar ítem en edición */}
      <Modal isOpen={editDeleteOpen} title="Eliminar ítem" onClose={() => setEditDeleteOpen(false)}
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="secondary" type="button" onClick={() => setEditDeleteOpen(false)}>Cancelar</Button>
            <Button variant="danger" type="button" onClick={() => {
              setEditItems(prev => prev.filter((_, i) => i !== editDeleteIdx))
              setEditItemQueries(prev => prev.filter((_, i) => i !== editDeleteIdx))
              setEditItemQtyText(prev => prev.filter((_, i) => i !== editDeleteIdx))
              setEditItemPriceText(prev => prev.filter((_, i) => i !== editDeleteIdx))
              setEditItemActive(prev => { const { [editDeleteIdx]: _, ...rest } = prev; return rest })
              setEditDeleteOpen(false)
              setEditDeleteIdx(null)
              show('Ítem eliminado', 'info')
            }}>Eliminar</Button>
          </div>
        }
      >
        <p>¿Confirmás eliminar el ítem seleccionado?</p>
      </Modal>

      {/* Barra de cambios sin guardar */}
      <UnsavedChangesBar 
        isDirty={isDirtyForm}
        onSave={() => saveInvoice({ preventDefault: () => {} })}
        onDiscard={() => {
          setForm(initialForm)
          setItems([])
          setErrors({ customerId: false, items: false })
        }}
      />
    </div>
  )
}
