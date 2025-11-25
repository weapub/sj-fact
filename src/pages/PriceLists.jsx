import { useEffect, useRef, useState } from 'react'
import { db } from '../data/db'
import Card from '../components/Card'
import Button from '../components/Button'
import Table from '../components/Table'
import Input from '../components/Input'
import Select from '../components/Select'
import Badge from '../components/Badge'
import Modal from '../components/Modal'
import { useToast } from '../components/Toast'

export default function PriceLists() {
  const [lists, setLists] = useState([])
  const [form, setForm] = useState({ name: '', currency: 'ARS' })
  const [formErrors, setFormErrors] = useState({ name: '' })
  const addNameRef = useRef(null)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [toDelete, setToDelete] = useState(null)
  const toast = useToast()
  const [editOpen, setEditOpen] = useState(false)
  const [editData, setEditData] = useState({ id: null, name: '', currency: 'ARS' })
  const [editErrors, setEditErrors] = useState({ name: '' })
  const nameRef = useRef(null)
  // Ajuste global de precios
  const [adjustOpen, setAdjustOpen] = useState(false)
  const [adjustList, setAdjustList] = useState(null)
  const [adjustPctText, setAdjustPctText] = useState('')
  const [adjustRoundMode, setAdjustRoundMode] = useState('int') // 'none' | 'two' | 'int'
  const adjustPctRef = useRef(null)
  // Derivar Mayorista desde General
  async function deriveWholesaleFromGeneral() {
    const l = await db.priceLists.orderBy('name').toArray()
    const general = l.find(ll => /general/i.test(ll.name))
    if (!general) { toast.show('No se encontró la lista "General"'); return }
    let target = l.find(ll => /mayorista/i.test(ll.name))
    if (!target) {
      const newId = await db.priceLists.add({ name: 'Mayorista', currency: general.currency || 'ARS' })
      target = { id: newId, name: 'Mayorista', currency: general.currency || 'ARS' }
    }
    const generalPrices = await db.prices.where('listId').equals(general.id).toArray()
    const targetPrices = await db.prices.where('listId').equals(target.id).toArray()
    const targetMap = {}
    for (const pr of targetPrices) targetMap[pr.productId] = pr
    const toAdd = []
    const toUpdate = []
    let added = 0, updated = 0
    for (const gp of generalPrices) {
      const np = Math.round(((gp.price || 0) / 1.35) * 1.25)
      const existing = targetMap[gp.productId]
      if (existing) { toUpdate.push({ id: existing.id, listId: target.id, productId: gp.productId, price: np }); updated++ }
      else { toAdd.push({ listId: target.id, productId: gp.productId, price: np }); added++ }
    }
    if (toUpdate.length) await db.prices.bulkPut(toUpdate)
    if (toAdd.length) await db.prices.bulkAdd(toAdd)
    toast.show(`Mayorista generado: ${added} agregados, ${updated} actualizados`)
    load()
  }

  // Derivar PY desde General
  async function derivePyFromGeneral() {
    const l = await db.priceLists.orderBy('name').toArray()
    const general = l.find(ll => /general/i.test(ll.name))
    if (!general) { toast.show('No se encontró la lista "General"'); return }
    let target = l.find(ll => /^py$/i.test((ll.name || '').trim()))
    if (!target) {
      const newId = await db.priceLists.add({ name: 'PY', currency: general.currency || 'ARS' })
      target = { id: newId, name: 'PY', currency: general.currency || 'ARS' }
    }
    const generalPrices = await db.prices.where('listId').equals(general.id).toArray()
    const targetPrices = await db.prices.where('listId').equals(target.id).toArray()
    const targetMap = {}
    for (const pr of targetPrices) targetMap[pr.productId] = pr
    const toAdd = []
    const toUpdate = []
    let added = 0, updated = 0
    for (const gp of generalPrices) {
      // Fórmula: (General / 1.35) * 1.10, redondeo a entero para consistencia
      const np = Math.round(((gp.price || 0) / 1.35) * 1.10)
      const existing = targetMap[gp.productId]
      if (existing) { toUpdate.push({ id: existing.id, listId: target.id, productId: gp.productId, price: np }); updated++ }
      else { toAdd.push({ listId: target.id, productId: gp.productId, price: np }); added++ }
    }
    if (toUpdate.length) await db.prices.bulkPut(toUpdate)
    if (toAdd.length) await db.prices.bulkAdd(toAdd)
    toast.show(`PY generado: ${added} agregados, ${updated} actualizados`)
    load()
  }

  async function load() {
    const l = await db.priceLists.orderBy('name').toArray()
    setLists(l)
  }

  useEffect(() => { load(); setTimeout(() => { addNameRef.current?.focus() }, 0) }, [])

  async function addList(e) {
    e.preventDefault()
    const name = (form.name || '').trim()
    const errors = { name: '' }
    if (!name) errors.name = 'El nombre es obligatorio.'
    setFormErrors(errors)
    if (errors.name) return
    await db.priceLists.add(form)
    setForm({ name: '', currency: 'ARS' })
    setFormErrors({ name: '' })
    load()
  }

  function confirmDelete(id) {
    setToDelete(id)
    setDeleteOpen(true)
  }

  async function performDelete() {
    if (toDelete == null) return
    // Eliminar lista y sus precios asociados
    await db.priceLists.delete(toDelete)
    await db.prices.where('listId').equals(toDelete).delete()
    setDeleteOpen(false)
    setToDelete(null)
    toast.show('Lista de precios eliminada')
    load()
  }

  function openEdit(l) {
    setEditData({ id: l.id, name: l.name || '', currency: l.currency || 'ARS' })
    setEditOpen(true)
    setTimeout(() => { nameRef.current?.focus() }, 0)
  }

  async function performEdit() {
    const name = (editData.name || '').trim()
    const errors = { name: '' }
    if (!name) errors.name = 'El nombre es obligatorio.'
    setEditErrors(errors)
    if (errors.name) return
    if (!editData.id) return
    await db.priceLists.put({ id: editData.id, name, currency: editData.currency || 'ARS' })
    setEditOpen(false)
    toast.show('Lista actualizada')
    load()
  }

  // Duplicar lista con copia de precios
  async function duplicateList(l) {
    if (!l || !l.id) return
    const baseName = (l.name || 'Lista')
    const newName = `${baseName} (copia)`
    const newId = await db.priceLists.add({ name: newName, currency: l.currency || 'ARS' })
    const prices = await db.prices.where('listId').equals(l.id).toArray()
    if (prices.length) {
      const cloned = prices.map(pr => ({ listId: newId, productId: pr.productId, price: pr.price }))
      await db.prices.bulkAdd(cloned)
    }
    toast.show('Lista duplicada')
    load()
  }

  function openAdjust(l) {
    setAdjustList(l)
    setAdjustPctText('')
    setAdjustRoundMode('two')
    setAdjustOpen(true)
    setTimeout(() => { adjustPctRef.current?.focus() }, 0)
  }

  async function performAdjust() {
    if (!adjustList?.id) { setAdjustOpen(false); return }
    const pct = parseFloat((adjustPctText || '').replace(',', '.'))
    if (isNaN(pct)) { toast.show('Ingresá un porcentaje válido (ej.: 10 o -5)'); return }
    const prices = await db.prices.where('listId').equals(adjustList.id).toArray()
    if (!prices.length) { toast.show('Esta lista no tiene precios'); setAdjustOpen(false); return }
    const factor = 1 + (pct / 100)
    const updated = prices.map(pr => {
      let np = pr.price * factor
      if (adjustRoundMode === 'two') np = Math.round(np * 100) / 100
      else if (adjustRoundMode === 'int') np = Math.round(np)
      return { id: pr.id, listId: pr.listId, productId: pr.productId, price: np }
    })
    await db.prices.bulkPut(updated)
    setAdjustOpen(false)
    toast.show(`Ajuste aplicado (${pct}% sobre ${prices.length} precios)`) 
    load()
  }

  return (
    <div className="max-w-7xl mx-auto space-y-6 p-4">
<h2 className="text-2xl font-bold tracking-tight text-slate-800">Listas de precios</h2>
      <Card>
        <form onSubmit={addList} className="grid grid-cols-1 md:grid-cols-3 gap-3 items-end">
          <Input label="Nombre" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="Ej.: General" helper={formErrors.name} className={formErrors.name ? 'border-red-500 focus:ring-red-500 focus:border-red-500' : ''} ref={addNameRef} />
          <Select label="Moneda" value={form.currency} onChange={e => setForm({ ...form, currency: e.target.value })}>
            <option value="ARS">ARS</option>
            <option value="USD">USD</option>
            <option value="EUR">EUR</option>
          </Select>
          <Button variant="primary" type="submit" className="md:col-span-3">Crear lista</Button>
        </form>
      </Card>

      <Card>
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
          <p className="text-slate-700">Generar/actualizar "Mayorista" desde "General" usando fórmula: (General / 1.35) + 25%</p>
          <Button variant="success" onClick={deriveWholesaleFromGeneral}>Crear/Actualizar Mayorista</Button>
        </div>
      </Card>

      <Card>
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
          <p className="text-slate-700">Generar/actualizar "PY" desde "General" usando fórmula: (General / 1.35) * 1.10</p>
          <Button variant="success" onClick={derivePyFromGeneral}>Crear/Actualizar PY</Button>
        </div>
      </Card>

      <Card>
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
          <p className="text-slate-700">Recalcular listas derivadas en un paso (Mayorista + PY)</p>
          <Button variant="primary" onClick={async () => { await deriveWholesaleFromGeneral(); await derivePyFromGeneral(); toast.show('Mayorista y PY recalculadas'); }}>Recalcular Mayorista y PY</Button>
        </div>
      </Card>

      <Card>
        <div className="relative overflow-x-auto">
          <div className="pointer-events-none absolute left-0 top-0 h-full w-6 bg-gradient-to-r from-white to-transparent" />
          <div className="pointer-events-none absolute right-0 top-0 h-full w-6 bg-gradient-to-l from-white to-transparent" />
        <Table className="min-w-[640px] border border-slate-200 rounded">
          <thead>
            <tr className="text-slate-700 text-left">
              <th className="p-2 border border-slate-200 sticky top-0 bg-slate-50">Nombre</th>
              <th className="p-2 border border-slate-200 sticky top-0 bg-slate-50">Moneda</th>
              <th className="p-2 border border-slate-200 sticky top-0 bg-slate-50">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {lists.length === 0 ? (
              <tr>
                <td colSpan={3} className="p-3 text-center text-slate-600"><Badge variant="default">No hay listas de precios aún</Badge></td>
              </tr>
            ) : (
              lists.map(l => (
                <tr key={l.id} className="border-t border-slate-200 hover:bg-slate-50">
                  <td className="p-1 md:p-2 text-sm md:text-base border border-slate-200">{l.name}</td>
                  <td className="p-1 md:p-2 text-sm md:text-base border border-slate-200"><Badge variant="info">{l.currency}</Badge></td>
                  <td className="p-1 md:p-2 text-sm md:text-base border border-slate-200">
                    <div className="flex gap-2 flex-wrap">
                      <Button variant="primary" onClick={() => openEdit(l)}>Editar</Button>
                      <Button variant="secondary" onClick={() => duplicateList(l)}>Duplicar</Button>
                      <Button variant="warning" onClick={() => openAdjust(l)}>Ajustar %</Button>
                      <Button variant="danger" onClick={() => confirmDelete(l.id)}>Eliminar</Button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </Table>
        </div>
      </Card>
      <Modal
        isOpen={editOpen}
        title="Editar lista de precios"
        onClose={() => setEditOpen(false)}
        footer={(
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setEditOpen(false)}>Cancelar</Button>
            <Button variant="success" onClick={performEdit}>Guardar</Button>
          </div>
        )}
      >
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <Input label="Nombre" value={editData.name} onChange={e => setEditData({ ...editData, name: e.target.value })} helper={editErrors.name} className={editErrors.name ? 'border-red-500 focus:ring-red-500 focus:border-red-500' : ''} ref={nameRef} />
          <Select label="Moneda" value={editData.currency} onChange={e => setEditData({ ...editData, currency: e.target.value })}>
            <option value="ARS">ARS</option>
            <option value="USD">USD</option>
            <option value="EUR">EUR</option>
          </Select>
        </div>
      </Modal>
      <Modal
        isOpen={deleteOpen}
        title="Eliminar lista de precios"
        onClose={() => setDeleteOpen(false)}
        footer={(
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setDeleteOpen(false)}>Cancelar</Button>
            <Button variant="danger" onClick={performDelete}>Eliminar</Button>
          </div>
        )}
      >
        <p className="text-slate-700">¿Deseas eliminar esta lista? Se eliminarán también los precios asociados.</p>
      </Modal>
      <Modal
        isOpen={adjustOpen}
        title={adjustList ? `Ajustar precios: ${adjustList.name}` : 'Ajustar precios'}
        onClose={() => setAdjustOpen(false)}
        footer={(
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setAdjustOpen(false)}>Cancelar</Button>
            <Button variant="success" onClick={performAdjust}>Aplicar ajuste</Button>
          </div>
        )}
      >
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <Input label="Porcentaje de ajuste" value={adjustPctText} onChange={e => setAdjustPctText(e.target.value)} placeholder="Ej.: 10 o -5" ref={adjustPctRef} />
          <Select label="Redondeo" value={adjustRoundMode} onChange={e => setAdjustRoundMode(e.target.value)}>
            <option value="two">2 decimales</option>
            <option value="int">Entero</option>
            <option value="none">Sin redondeo</option>
          </Select>
          <div className="md:col-span-2">
            <p className="text-xs text-slate-600">Se aplicará el porcentaje sobre todos los precios de la lista seleccionada.</p>
          </div>
        </div>
      </Modal>
    </div>
  )
}