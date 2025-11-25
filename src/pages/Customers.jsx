import { useEffect, useRef, useState } from 'react'
import { db } from '../data/db'
import Card from '../components/Card'
import Button from '../components/Button'
import Table from '../components/Table'
import Input from '../components/Input'
import Modal from '../components/Modal'
import { useToast } from '../components/ToastContext'
import { formatMoney } from '../utils/format'
import Badge from '../components/Badge'

export default function Customers() {
  const [customers, setCustomers] = useState([])
  const [form, setForm] = useState({ name: '', taxId: '', email: '', phone: '', address: '', notes: '' })
  const [formErrors, setFormErrors] = useState({ name: '', email: '' })
  const addNameRef = useRef(null)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [toDelete, setToDelete] = useState(null)
  const toast = useToast()
  const [editOpen, setEditOpen] = useState(false)
  const [editData, setEditData] = useState({ id: null, name: '', taxId: '', email: '', phone: '', address: '', notes: '' })
  const [editErrors, setEditErrors] = useState({ name: '', email: '' })
  const nameRef = useRef(null)

  // Detalles
  const [detailOpen, setDetailOpen] = useState(false)
  const [detailData, setDetailData] = useState(null)
  const [detailLoading, setDetailLoading] = useState(false)
  const [detailStats, setDetailStats] = useState({
    invoicesCount: 0,
    totalBilled: 0,
    lastInvoiceDate: null,
    lastInvoiceNumber: null,
    paymentsCount: 0,
    lastPaymentDate: null,
    balance: 0
  })

  async function load() {
    const list = await db.customers.orderBy('name').toArray()
    setCustomers(list)
  }

  useEffect(() => {
    load()
    setTimeout(() => { addNameRef.current?.focus() }, 0)
  }, [])

  async function addCustomer(e) {
    e.preventDefault()
    const name = (form.name || '').trim()
    const email = (form.email || '').trim()
    const errors = { name: '', email: '' }
    if (!name) errors.name = 'El nombre es obligatorio.'
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) errors.email = 'Formato de email inválido.'
    setFormErrors(errors)
    if (errors.name || errors.email) return
    await db.customers.add({ ...form })
    setForm({ name: '', taxId: '', email: '', phone: '', address: '', notes: '' })
    setFormErrors({ name: '', email: '' })
    load()
  }

  function confirmDelete(id) {
    setToDelete(id)
    setDeleteOpen(true)
  }

  async function performDelete() {
    if (toDelete == null) return
    // Eliminar en cascada: facturas, items y movimientos del cliente
    const invoices = await db.invoices.where('customerId').equals(toDelete).toArray()
    const invoiceIds = invoices.map(i => i.id)
    if (invoiceIds.length > 0) {
      await db.invoiceItems.where('invoiceId').anyOf(invoiceIds).delete()
      await db.invoices.where('customerId').equals(toDelete).delete()
    } else {
      await db.invoices.where('customerId').equals(toDelete).delete()
    }
    await db.ledger.where('customerId').equals(toDelete).delete()
    await db.customers.delete(toDelete)
    setDeleteOpen(false)
    setToDelete(null)
    toast.show('Cliente y datos asociados eliminados')
    load()
  }

  function openEdit(c) {
    setEditData({ id: c.id, name: c.name || '', taxId: c.taxId || '', email: c.email || '', phone: c.phone || '', address: c.address || '', notes: c.notes || '' })
    setEditOpen(true)
    setTimeout(() => { nameRef.current?.focus() }, 0)
  }

  async function openDetails(c) {
    setDetailData(c)
    setDetailLoading(true)
    try {
      const invs = await db.invoices.where('customerId').equals(c.id).toArray()
      const invoicesCount = invs.length
      const totalBilled = invs.reduce((acc, i) => acc + (i.total || 0), 0)
      let lastInvoiceDate = null
      let lastInvoiceNumber = null
      if (invs.length > 0) {
        const latest = invs.reduce((acc, i) => new Date(i.date) > new Date(acc.date) ? i : acc, invs[0])
        lastInvoiceDate = latest.date
        lastInvoiceNumber = latest.number
      }
      const moves = await db.ledger.where('customerId').equals(c.id).toArray()
      const payments = moves.filter(m => m.type === 'haber')
      const paymentsCount = payments.length
      const lastPaymentDate = payments.reduce((acc, m) => (!acc || new Date(m.date) > new Date(acc)) ? m.date : acc, null)
      const balance = moves.reduce((acc, m) => acc + (m.type === 'debe' ? m.amount : -m.amount), 0)
      setDetailStats({ invoicesCount, totalBilled, lastInvoiceDate, lastInvoiceNumber, paymentsCount, lastPaymentDate, balance })
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
    await db.customers.put({ id: editData.id, name, taxId: editData.taxId || '', email: editData.email || '', phone: editData.phone || '', address: editData.address || '', notes: editData.notes || '' })
    setEditOpen(false)
    toast.show('Cliente actualizado')
    load()
  }

  return (
    <div className="max-w-7xl mx-auto space-y-6 p-4">
<h2 className="text-2xl font-bold tracking-tight text-slate-800">Clientes</h2>
      <Card>
        <form onSubmit={addCustomer} className="grid grid-cols-1 md:grid-cols-3 gap-3 items-end">
          <Input label="Nombre" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="Ej.: Juan Pérez" helper={formErrors.name} className={formErrors.name ? 'border-red-500 focus:ring-red-500 focus:border-red-500' : ''} ref={addNameRef} />
          <Input label="CUIT/CUIL" value={form.taxId} onChange={e => setForm({ ...form, taxId: e.target.value })} placeholder="Ej.: 20-12345678-3" />
          <Input label="Email" type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} placeholder="Ej.: juan@mail.com" helper={formErrors.email} className={formErrors.email ? 'border-red-500 focus:ring-red-500 focus:border-red-500' : ''} />
          <Input label="Teléfono" value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} placeholder="Ej.: +54 9 11 1234-5678" />
          <Input label="Dirección" value={form.address} onChange={e => setForm({ ...form, address: e.target.value })} placeholder="Ej.: Av. Siempre Viva 123" />
          <Input label="Observaciones" value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} placeholder="Notas internas, condiciones, etc." className="md:col-span-3" />
          <Button variant="primary" type="submit" className="md:col-span-3">Agregar cliente</Button>
        </form>
      </Card>

      <Card>
        <Table>
          <thead>
            <tr className="bg-slate-50 text-slate-700 text-left">
              <th className="p-2 border border-slate-200">Nombre</th>
              <th className="p-2 border border-slate-200">CUIT/CUIL</th>
              <th className="p-2 border border-slate-200">Email</th>
              <th className="p-2 border border-slate-200">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {customers.length === 0 ? (
              <tr>
<td colSpan={4} className="p-3 text-center text-slate-600"><Badge variant="default">No hay clientes cargados</Badge></td>
              </tr>
            ) : (
              customers.map(c => (
                <tr key={c.id} className="border-t border-slate-200 hover:bg-slate-50">
                  <td className="p-2 border border-slate-200">{c.name}</td>
                  <td className="p-2 border border-slate-200">{c.taxId}</td>
                  <td className="p-2 border border-slate-200">{c.email}</td>
                  <td className="p-2 border border-slate-200">
                    <div className="flex gap-2">
                      <Button variant="secondary" onClick={() => openDetails(c)}>Ver</Button>
                      <Button variant="primary" onClick={() => openEdit(c)}>Editar</Button>
                      <Button variant="danger" onClick={() => confirmDelete(c.id)}>Eliminar</Button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </Table>
      </Card>
      <Modal
        isOpen={editOpen}
        title="Editar cliente"
        onClose={() => setEditOpen(false)}
        footer={(
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setEditOpen(false)}>Cancelar</Button>
            <Button variant="success" onClick={performEdit}>Guardar</Button>
          </div>
        )}
      >
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <Input label="Nombre" value={editData.name} onChange={e => setEditData({ ...editData, name: e.target.value })} helper={editErrors.name} className={editErrors.name ? 'border-red-500 focus:ring-red-500 focus:border-red-500' : ''} containerClassName="" ref={nameRef} />
          <Input label="CUIT/CUIL" value={editData.taxId} onChange={e => setEditData({ ...editData, taxId: e.target.value })} />
          <Input label="Email" type="email" value={editData.email} onChange={e => setEditData({ ...editData, email: e.target.value })} helper={editErrors.email} className={editErrors.email ? 'border-red-500 focus:ring-red-500 focus:border-red-500' : ''} />
          <Input label="Teléfono" value={editData.phone} onChange={e => setEditData({ ...editData, phone: e.target.value })} />
          <Input label="Dirección" value={editData.address} onChange={e => setEditData({ ...editData, address: e.target.value })} />
          <Input label="Observaciones" value={editData.notes} onChange={e => setEditData({ ...editData, notes: e.target.value })} className="md:col-span-2" />
        </div>
      </Modal>
      <Modal
        isOpen={detailOpen}
        title="Detalles del cliente"
        onClose={() => setDetailOpen(false)}
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
<div><span className="text-slate-600">Teléfono:</span> <span className="font-medium">{detailData.phone || '—'}</span></div>
<div><span className="text-slate-600">Dirección:</span> <span className="font-medium">{detailData.address || '—'}</span></div>
              </div>
            </div>
            <div className="space-y-2">
              <h3 className="font-semibold">Resumen</h3>
              <div className="p-3 bg-slate-50 rounded border border-slate-200 text-slate-700 space-y-1">
<div className="flex justify-between"><span className="text-slate-600">Facturas:</span> <span className="font-medium">{detailStats.invoicesCount}</span></div>
<div className="flex justify-between"><span className="text-slate-600">Total facturado:</span> <span className="font-medium">{formatMoney(detailStats.totalBilled)}</span></div>
<div className="flex justify-between"><span className="text-slate-600">Saldo actual:</span> <span className="font-medium">{formatMoney(detailStats.balance)}</span></div>
<div className="flex justify-between"><span className="text-slate-600">Última factura:</span> <span className="font-medium">{detailStats.lastInvoiceNumber ? `#${detailStats.lastInvoiceNumber} (${new Date(detailStats.lastInvoiceDate).toLocaleDateString()})` : '—'}</span></div>
<div className="flex justify-between"><span className="text-slate-600">Último pago:</span> <span className="font-medium">{detailStats.lastPaymentDate ? new Date(detailStats.lastPaymentDate).toLocaleDateString() : '—'}</span></div>
              </div>
            </div>
            <div className="md:col-span-2 space-y-2">
              <h3 className="font-semibold">Observaciones</h3>
              <div className="p-3 bg-slate-50 rounded border border-slate-200 text-slate-700">
<p className="whitespace-pre-wrap text-slate-800">{detailData.notes || '—'}</p>
              </div>
            </div>
          </div>
        ) : (
<p className="text-slate-600"><Badge variant="default">ℹ️ Selecciona un cliente</Badge></p>
        )}
      </Modal>
      <Modal
        isOpen={deleteOpen}
        title="Eliminar cliente"
        onClose={() => setDeleteOpen(false)}
        footer={(
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setDeleteOpen(false)}>Cancelar</Button>
            <Button variant="danger" onClick={performDelete}>Eliminar</Button>
          </div>
        )}
      >
<p className="text-slate-700">¿Deseas eliminar este cliente? Se eliminarán también sus facturas, ítems y movimientos de cuenta corriente.</p>
      </Modal>
    </div>
  )
}
