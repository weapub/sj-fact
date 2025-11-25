import { useEffect, useRef, useState } from 'react'
import { db } from '../data/db'
import Card from '../components/Card'
import Button from '../components/Button'
import Table from '../components/Table'
import Input from '../components/Input'
import Modal from '../components/Modal'
import Badge from '../components/Badge'
import { useToast } from '../components/ToastContext'
import { formatMoney } from '../utils/format'

export default function Suppliers() {
  const [suppliers, setSuppliers] = useState([])
  const [form, setForm] = useState({ name: '', taxId: '', email: '', taxPct: 0 })
  const [formErrors, setFormErrors] = useState({ name: '', email: '' })
  const addNameRef = useRef(null)
  const toast = useToast()
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [toDelete, setToDelete] = useState(null)
  const [editOpen, setEditOpen] = useState(false)
  const [editData, setEditData] = useState({ id: null, name: '', taxId: '', email: '', taxPct: 0 })
  const [editErrors, setEditErrors] = useState({ name: '', email: '' })
  const nameRef = useRef(null)

  const [detailOpen, setDetailOpen] = useState(false)
  const [detailData, setDetailData] = useState(null)
  const [detailLoading, setDetailLoading] = useState(false)
  const [detailStats, setDetailStats] = useState({ purchasesCount: 0, totalSpent: 0, lastPurchaseDate: null, lastTaxes: 0 })

  async function load() {
    const list = await db.suppliers.orderBy('name').toArray()
    setSuppliers(list)
  }

  useEffect(() => { load(); setTimeout(() => { addNameRef.current?.focus() }, 0) }, [])

  async function addSupplier(e) {
    e.preventDefault()
    const name = (form.name || '').trim()
    const email = (form.email || '').trim()
    const errors = { name: '', email: '' }
    if (!name) errors.name = 'El nombre es obligatorio.'
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) errors.email = 'Formato de email inválido.'
    setFormErrors(errors)
    if (errors.name || errors.email) return
    const taxNum = Number(form.taxPct || 0)
    await db.suppliers.add({ name, taxId: form.taxId || '', email: email || '', taxPct: isNaN(taxNum) ? 0 : taxNum })
    setForm({ name: '', taxId: '', email: '', taxPct: 0 })
    setFormErrors({ name: '', email: '' })
    load()
  }

  function confirmDelete(id) { setToDelete(id); setDeleteOpen(true) }

  async function performDelete() {
    if (toDelete == null) return
    const purchases = await db.purchases.where('supplierId').equals(toDelete).toArray()
    const purIds = purchases.map(p => p.id)
    if (purIds.length) await db.purchaseItems.where('purchaseId').anyOf(purIds).delete()
    await db.purchases.where('supplierId').equals(toDelete).delete()
    await db.suppliers.delete(toDelete)
    setDeleteOpen(false)
    setToDelete(null)
    toast.show('Proveedor y compras relacionadas eliminados')
    load()
  }

  function openEdit(s) {
    setEditData({ id: s.id, name: s.name || '', taxId: s.taxId || '', email: s.email || '', taxPct: Number(s.taxPct || 0) })
    setEditOpen(true)
    setTimeout(() => { nameRef.current?.focus() }, 0)
  }

  async function openDetails(s) {
    setDetailData(s)
    setDetailLoading(true)
    try {
      const arr = await db.purchases.where('supplierId').equals(s.id).toArray()
      const purchasesCount = arr.length
      const totalSpent = arr.reduce((acc, p) => acc + (p.total || 0), 0)
      let lastPurchaseDate = null
      let lastTaxes = 0
      if (arr.length) {
        const latest = arr.reduce((acc, p) => new Date(p.date) > new Date(acc.date) ? p : acc, arr[0])
        lastPurchaseDate = latest.date
        lastTaxes = Number(latest.taxPct || 0)
      }
      setDetailStats({ purchasesCount, totalSpent, lastPurchaseDate, lastTaxes })
    } finally {
      setDetailLoading(false)
      setDetailOpen(true)
    }
  }

  async function performEdit() {
    const name = (editData.name || '').trim()
    const email = (editData.email || '').trim()
    const errors = { name: '', email: '' }
    if (!name) errors.name = 'El nombre es obligatorio.'
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) errors.email = 'Formato de email inválido.'
    setEditErrors(errors)
    if (errors.name || errors.email) return
    if (!editData.id) return
    const taxNum = Number(editData.taxPct || 0)
    await db.suppliers.put({ id: editData.id, name, taxId: editData.taxId || '', email: email || '', taxPct: isNaN(taxNum) ? 0 : taxNum })
    setEditOpen(false)
    toast.show('Proveedor actualizado')
    load()
  }

  return (
    <div className="max-w-7xl mx-auto space-y-6 p-4">
      <h2 className="text-2xl font-bold tracking-tight text-slate-800">Proveedores</h2>
      <Card>
        <form onSubmit={addSupplier} className="grid grid-cols-1 md:grid-cols-3 gap-3 items-end">
          <Input label="Nombre" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="Ej.: ACME S.A." helper={formErrors.name} className={formErrors.name ? 'border-red-500 focus:ring-red-500 focus:border-red-500' : ''} ref={addNameRef} />
          <Input label="CUIT/CUIL" value={form.taxId} onChange={e => setForm({ ...form, taxId: e.target.value })} placeholder="Ej.: 30-12345678-9" />
          <Input label="Email" type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} placeholder="Ej.: contacto@acme.com" helper={formErrors.email} className={formErrors.email ? 'border-red-500 focus:ring-red-500 focus:border-red-500' : ''} />
          <Input label="Impuestos (%)" type="text" value={String(form.taxPct)} onChange={e => {
            let val = e.target.value || ''
            val = val.replace(/\./g, ',').replace(/[^\d,]/g, '')
            const num = parseFloat(val.replace(',', '.'))
            setForm({ ...form, taxPct: isNaN(num) ? 0 : num })
          }} />
          <Button variant="primary" type="submit" className="md:col-span-3">Agregar proveedor</Button>
        </form>
      </Card>

      <Card>
        <Table>
          <thead>
            <tr className="bg-slate-50 text-slate-700 text-left">
              <th className="p-2 border border-slate-200">Nombre</th>
              <th className="p-2 border border-slate-200">CUIT/CUIL</th>
              <th className="p-2 border border-slate-200">Email</th>
              <th className="p-2 border border-slate-200">Impuestos</th>
              <th className="p-2 border border-slate-200">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {suppliers.length === 0 ? (
              <tr>
                <td colSpan={5} className="p-3 text-center text-slate-600"><Badge variant="default">No hay proveedores cargados</Badge></td>
              </tr>
            ) : (
              suppliers.map(s => (
                <tr key={s.id} className="border-t border-slate-200 hover:bg-slate-50">
                  <td className="p-2 border border-slate-200">{s.name}</td>
                  <td className="p-2 border border-slate-200">{s.taxId}</td>
                  <td className="p-2 border border-slate-200">{s.email}</td>
                  <td className="p-2 border border-slate-200">{String(s.taxPct || 0)}%</td>
                  <td className="p-2 border border-slate-200">
                    <div className="flex gap-2">
                      <Button variant="secondary" onClick={() => openDetails(s)}>Ver</Button>
                      <Button variant="primary" onClick={() => openEdit(s)}>Editar</Button>
                      <Button variant="danger" onClick={() => confirmDelete(s.id)}>Eliminar</Button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </Table>
      </Card>

      <Modal isOpen={editOpen} title="Editar proveedor" onClose={() => setEditOpen(false)}
        footer={(
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setEditOpen(false)}>Cancelar</Button>
            <Button variant="success" onClick={performEdit}>Guardar</Button>
          </div>
        )}
      >
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <Input label="Nombre" value={editData.name} onChange={e => setEditData({ ...editData, name: e.target.value })} helper={editErrors.name} className={editErrors.name ? 'border-red-500 focus:ring-red-500 focus:border-red-500' : ''} ref={nameRef} />
          <Input label="Impuestos (%)" type="text" value={String(editData.taxPct)} onChange={e => {
            let val = e.target.value || ''
            val = val.replace(/\./g, ',').replace(/[^\d,]/g, '')
            const num = parseFloat(val.replace(',', '.'))
            setEditData(prev => ({ ...prev, taxPct: isNaN(num) ? 0 : num }))
          }} />
          <Input label="CUIT/CUIL" value={editData.taxId} onChange={e => setEditData({ ...editData, taxId: e.target.value })} />
          <Input label="Email" type="email" value={editData.email} onChange={e => setEditData({ ...editData, email: e.target.value })} helper={editErrors.email} className={editErrors.email ? 'border-red-500 focus:ring-red-500 focus:border-red-500' : ''} />
        </div>
      </Modal>

      <Modal isOpen={detailOpen} title="Detalles del proveedor" onClose={() => setDetailOpen(false)}
        footer={(
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setDetailOpen(false)}>Cerrar</Button>
            {detailData && (
              <Button variant="primary" onClick={() => { setDetailOpen(false); openEdit(detailData) }}>Editar</Button>
            )}
          </div>
        )}
      >
        {detailLoading ? (
          <p className="text-slate-600"><Badge variant="default">⏳ Cargando…</Badge></p>
        ) : detailData ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <h3 className="font-semibold">Datos básicos</h3>
              <div className="p-3 bg-slate-50 rounded border border-slate-200 text-slate-700">
                <div><span className="text-slate-600">Nombre:</span> <span className="font-medium">{detailData.name || '—'}</span></div>
                <div><span className="text-slate-600">CUIT/CUIL:</span> <span className="font-medium">{detailData.taxId || '—'}</span></div>
                <div><span className="text-slate-600">Email:</span> <span className="font-medium">{detailData.email || '—'}</span></div>
                <div><span className="text-slate-600">Impuestos (%):</span> <span className="font-medium">{String(detailData.taxPct || 0)}%</span></div>
              </div>
            </div>
            <div className="space-y-2">
              <h3 className="font-semibold">Resumen</h3>
              <div className="p-3 bg-slate-50 rounded border border-slate-200 text-slate-700 space-y-1">
                <div className="flex justify-between"><span className="text-slate-600">Compras:</span> <span className="font-medium">{detailStats.purchasesCount}</span></div>
                <div className="flex justify-between"><span className="text-slate-600">Total comprado:</span> <span className="font-medium">{formatMoney(detailStats.totalSpent)}</span></div>
                <div className="flex justify-between"><span className="text-slate-600">Última compra:</span> <span className="font-medium">{detailStats.lastPurchaseDate ? new Date(detailStats.lastPurchaseDate).toLocaleDateString() : '—'}</span></div>
                <div className="flex justify-between"><span className="text-slate-600">Impuestos últimos:</span> <span className="font-medium">{String(detailStats.lastTaxes || 0)}%</span></div>
              </div>
            </div>
          </div>
        ) : (
          <p className="text-slate-600"><Badge variant="default">ℹ️ Selecciona un proveedor</Badge></p>
        )}
      </Modal>

      <Modal isOpen={deleteOpen} title="Eliminar proveedor" onClose={() => setDeleteOpen(false)}
        footer={(
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setDeleteOpen(false)}>Cancelar</Button>
            <Button variant="danger" onClick={performDelete}>Eliminar</Button>
          </div>
        )}
      >
        <p className="text-slate-700">¿Deseas eliminar este proveedor? Se eliminarán también sus compras e ítems asociados.</p>
      </Modal>
    </div>
  )
}
