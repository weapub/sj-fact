import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { db } from '../data/db'
import { formatMoney, parseMoney } from '../utils/format'
import Card from '../components/Card'
import Table from '../components/Table'
import Select from '../components/Select'
import Badge from '../components/Badge'
import Button from '../components/Button'
import Input from '../components/Input'
import { useToast } from '../components/Toast'
import Modal from '../components/Modal'

export default function Ledger() {
  const navigate = useNavigate()
  const [customers, setCustomers] = useState([])
  const [selected, setSelected] = useState(null)
  const [moves, setMoves] = useState([])
  const [paymentForm, setPaymentForm] = useState({ amount: '', date: new Date().toISOString().slice(0,10), reference: 'Pago', method: 'efectivo' })
  const [paymentErrors, setPaymentErrors] = useState({ amount: '' })
  const toast = useToast()
  const [editMove, setEditMove] = useState(null)
  const [editForm, setEditForm] = useState({ amount: '', date: '', reference: '', method: '' })
  const [deleteMove, setDeleteMove] = useState(null)
  const [filters, setFilters] = useState({ from: '', to: '', method: '' })
  const [products, setProducts] = useState([])
  const [invDetailOpen, setInvDetailOpen] = useState(false)
  const [invDetail, setInvDetail] = useState(null)
  const [invItems, setInvItems] = useState([])
  const [invLoading, setInvLoading] = useState(false)
  const [invDocType, setInvDocType] = useState('Factura')
  const [showOrphans, setShowOrphans] = useState(false)
  const [invoices, setInvoices] = useState([])

  useEffect(() => { db.customers.toArray().then(setCustomers) }, [])
  useEffect(() => { db.products.toArray().then(setProducts) }, [])
  useEffect(() => { db.invoices.toArray().then(setInvoices) }, [])

  useEffect(() => {
    if (!selected) return
    db.ledger.where('customerId').equals(Number(selected)).toArray().then(setMoves)
  }, [selected])

  const balance = useMemo(() => moves.reduce((acc, m) => acc + (m.type === 'debe' ? m.amount : -m.amount), 0), [moves])
  const filteredMoves = useMemo(() => {
    const from = filters.from ? new Date(filters.from) : null
    const to = filters.to ? new Date(filters.to) : null
    const method = filters.method || ''
    const invNumbers = new Set(invoices.map(i => Number(i.number)))
    const isOrphan = (m) => {
      if (m.type !== 'debe') return false
      const ref = String(m.reference || '')
      const match = ref.match(/(Factura|Remito)\s+(\d+)/i)
      if (!match) return false
      const num = Number(match[2])
      return !invNumbers.has(num)
    }
    return moves.filter(m => {
      const d = new Date(m.date)
      if (from && d < from) return false
      if (to) {
        const end = new Date(filters.to)
        end.setHours(23,59,59,999)
        if (d > end) return false
      }
      if (method && m.type === 'haber') {
        return (m.method || '') === method
      }
      if (showOrphans) {
        return isOrphan(m)
      }
      return true
    }).map(m => ({ ...m, _isOrphan: isOrphan(m) }))
  }, [moves, filters, showOrphans, invoices])

  const exportCsv = () => {
    if (!selected) { toast.show('Selecciona un cliente', 'warning'); return }
    if (filteredMoves.length === 0) { toast.show('No hay movimientos para exportar', 'warning'); return }
    const client = customers.find(c => c.id === Number(selected))
    const sep = ';'
    const now = new Date()
    const fromStr = filters.from ? new Date(filters.from).toLocaleDateString() : ''
    const toStr = filters.to ? new Date(filters.to).toLocaleDateString() : ''
    const totDebe = filteredMoves.filter(m => m.type === 'debe').reduce((a, m) => a + m.amount, 0)
    const totHaber = filteredMoves.filter(m => m.type === 'haber').reduce((a, m) => a + m.amount, 0)
    const saldo = totDebe - totHaber
    const headerBlock = [
      ['Informe de cuenta corriente'],
      ['Cliente', client ? client.name : String(selected)],
      ['Generado', now.toLocaleString()],
      ['Periodo', `${fromStr || '-'} a ${toStr || '-'}`],
      ['Medio', filters.method || 'Todos'],
      [''],
      ['Resumen', 'Debe', 'Haber', 'Saldo'],
      ['Resumen', formatMoney(totDebe), formatMoney(totHaber), formatMoney(saldo)],
      [''],
    ].map(row => row.join(sep)).join('\n')
    const headers = ['Fecha','Tipo','Importe','Referencia','Medio'].join(sep)
    const rows = filteredMoves.map(m => [
      new Date(m.date).toLocaleDateString(),
      m.type,
      formatMoney(m.amount),
      m.reference || '',
      m.type === 'haber' ? (m.method || '') : ''
    ].map(v => String(v).replace(/\n/g, ' ')).join(sep)).join('\n')
    const content = `${headerBlock}\n${headers}\n${rows}\n`
    const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const nameSafe = (client ? client.name : `cliente_${selected}`).replace(/\s+/g, '_').replace(/[^a-zA-Z0-9_-]/g, '')
    const a = document.createElement('a')
    a.href = url
    a.download = `informe_${nameSafe}_${now.toISOString().slice(0,10)}.csv`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
    toast.show('Informe exportado (CSV)', 'success')
  }

  async function openInvoiceFromMove(m) {
    const ref = String(m.reference || '')
    const match = ref.match(/(Factura|Remito)\s+(\d+)/i)
    if (!match) { toast.show('Movimiento no vinculado a comprobante', 'warning'); return }
    const docType = match[1]
    const number = Number(match[2])
    setInvDocType(docType)
    setInvItems([])
    setInvDetail(null)
    setInvLoading(true)
    try {
      const inv = await db.invoices.where('number').equals(number).first()
      if (!inv) { toast.show('Comprobante no encontrado', 'danger'); return }
      const items = await db.invoiceItems.where('invoiceId').equals(inv.id).toArray()
      const mapped = items.map(r => {
        const p = products.find(x => x.id === Number(r.productId))
        return {
          productName: p ? p.name : `#${r.productId}`,
          qty: r.qty,
          unitPrice: r.unitPrice,
          total: r.total
        }
      })
      setInvDetail(inv)
      setInvItems(mapped)
    } finally {
      setInvLoading(false)
      setInvDetailOpen(true)
    }
  }

  return (
    <div className="max-w-7xl mx-auto space-y-6 p-4">
<h2 className="text-2xl font-bold tracking-tight text-slate-800">Cuenta corriente</h2>
      <Card>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 items-end">
          <Select label="Cliente" value={selected ?? ''} onChange={e => setSelected(e.target.value)}>
            <option value="">Seleccione…</option>
            {customers.map(c => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </Select>
          <div className="md:col-span-2">
            <div className="p-3 bg-slate-50 rounded border border-slate-200 text-slate-700">Saldo: <span className="font-semibold">{formatMoney(balance)}</span></div>
          </div>
        </div>
      </Card>

      <Card title="Filtros">
        <div className="grid grid-cols-1 md:grid-cols-5 gap-3 items-end">
          <Input label="Desde" type="date" value={filters.from} onChange={e => setFilters(prev => ({ ...prev, from: e.target.value }))} />
          <Input label="Hasta" type="date" value={filters.to} onChange={e => setFilters(prev => ({ ...prev, to: e.target.value }))} />
          <Select label="Medio (pagos)" value={filters.method} onChange={e => setFilters(prev => ({ ...prev, method: e.target.value }))}>
            <option value="">Todos</option>
            <option value="efectivo">Efectivo</option>
            <option value="transferencia">Transferencia</option>
            <option value="tarjeta">Tarjeta</option>
          </Select>
          <div className="md:col-span-2 flex gap-2 items-center">
            <label className="inline-flex items-center gap-2 text-sm">
              <input type="checkbox" className="rounded" checked={showOrphans} onChange={e => setShowOrphans(e.target.checked)} />
              <span>Mostrar solo huérfanos (referencia a comprobante inexistente)</span>
            </label>
            <Button variant="secondary" onClick={() => setFilters({ from: '', to: '', method: '' })}>Limpiar filtros</Button>
            <Button variant="primary" onClick={exportCsv} disabled={!selected || filteredMoves.length === 0}>Exportar informe (CSV)</Button>
            <Button variant="primary" onClick={() => {
              if (!selected) { toast.show('Selecciona un cliente', 'warning'); return }
              const qs = new URLSearchParams({
                customerId: String(selected),
                from: filters.from || '',
                to: filters.to || '',
                method: filters.method || '',
                auto: '1'
              }).toString()
              navigate(`/cuenta/reporte?${qs}`)
            }} disabled={!selected}>Imprimir informe</Button>
          </div>
        </div>
      </Card>

      <Card title="Registrar pago">
        <form onSubmit={async (e) => {
          e.preventDefault()
          if (!selected) { toast.show('Selecciona un cliente', 'warning'); return }
          const errs = { amount: '' }
          const val = parseMoney(paymentForm.amount)
          if (isNaN(val) || val <= 0) {
            errs.amount = 'Importe inválido. Usá números (ej.: 1234,56)'
            setPaymentErrors(errs)
            return
          }
          setPaymentErrors(errs)
          await db.ledger.add({
            customerId: Number(selected),
            date: new Date(paymentForm.date).toISOString(),
            type: 'haber',
            amount: val,
            reference: paymentForm.reference || 'Pago',
            method: paymentForm.method
          })
          const list = await db.ledger.where('customerId').equals(Number(selected)).toArray()
          setMoves(list)
          setPaymentForm(prev => ({ ...prev, amount: '' }))
          toast.show('Pago registrado', 'success')
        }} className="grid grid-cols-1 md:grid-cols-4 gap-3 items-end">
          <Input label="Importe del pago" type="text" value={paymentForm.amount} onChange={e => {
            let val = e.target.value || ''
            val = val.replace(/\./g, ',')
            val = val.replace(/[^\d,]/g, '')
            val = val.replace(/(,.*),/, '$1')
            setPaymentForm(prev => ({ ...prev, amount: val }))
          }} helper={paymentErrors.amount} className={paymentErrors.amount ? 'border-red-500 focus:ring-red-500 focus:border-red-500' : ''} />
          <Input label="Fecha" type="date" value={paymentForm.date} onChange={e => setPaymentForm(prev => ({ ...prev, date: e.target.value }))} />
          <Input label="Referencia" value={paymentForm.reference} onChange={e => setPaymentForm(prev => ({ ...prev, reference: e.target.value }))} />
          <Select label="Medio" value={paymentForm.method} onChange={e => setPaymentForm(prev => ({ ...prev, method: e.target.value }))}>
            <option value="efectivo">Efectivo</option>
            <option value="transferencia">Transferencia</option>
            <option value="tarjeta">Tarjeta</option>
          </Select>
          <Button variant="success" type="submit" className="md:col-span-1">Registrar pago</Button>
        </form>
      </Card>

      <Card>
        <Table>
          <thead>
            <tr className="bg-slate-50 text-slate-700 text-left">
              <th className="p-2 border border-slate-200">Fecha</th>
              <th className="p-2 border border-slate-200">Tipo</th>
              <th className="p-2 border border-slate-200">Importe</th>
              <th className="p-2 border border-slate-200">Referencia</th>
              <th className="p-2 border border-slate-200">Medio</th>
              <th className="p-2 border border-slate-200">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {moves.length === 0 ? (
              <tr>
<td colSpan={6} className="p-3 text-center text-slate-600">
                  {selected ? 'Sin movimientos para el cliente seleccionado' : 'Selecciona un cliente para ver los movimientos'}
                </td>
              </tr>
            ) : (
              moves.map(m => (
                <tr key={m.id} className="border-t border-slate-200 hover:bg-slate-50">
                  <td className="p-2 border border-slate-200">{new Date(m.date).toLocaleDateString()}</td>
                  <td className="p-2 border border-slate-200"><Badge variant={m.type === 'debe' ? 'danger' : 'success'}>{m.type}</Badge></td>
                  <td className="p-2 border border-slate-200">{formatMoney(m.amount)}</td>
                  <td className="p-2 border border-slate-200">
                    {m.reference}
                    {m._isOrphan && (
                      <Badge variant="warning" className="ml-2">Huérfano</Badge>
                    )}
                  </td>
                  <td className="p-2 border border-slate-200">{m.type === 'haber' ? (m.method || '—') : '—'}</td>
                  <td className="p-2 border border-slate-200">
                    {m.type === 'haber' ? (
                      <div className="flex gap-2">
                        <Button variant="secondary" onClick={() => {
                          setEditMove(m)
                          setEditForm({
                            amount: formatMoney(m.amount),
                            date: new Date(m.date).toISOString().slice(0,10),
                            reference: m.reference || '',
                            method: m.method || 'efectivo'
                          })
                        }}>Editar</Button>
                        <Button variant="danger" onClick={() => setDeleteMove(m)}>Eliminar</Button>
                      </div>
                    ) : (
                      <div className="flex gap-2">
                        {m._isOrphan ? (
                          <>
                            <Button variant="danger" onClick={async () => {
                              await db.ledger.delete(m.id)
                              const list = await db.ledger.where('customerId').equals(Number(selected)).toArray()
                              setMoves(list)
                              toast.show('Movimiento huérfano eliminado', 'info')
                            }}>Eliminar</Button>
                            <Button variant="secondary" onClick={async () => {
                              await db.ledger.add({
                                customerId: Number(selected),
                                date: new Date().toISOString(),
                                type: 'haber',
                                amount: m.amount,
                                reference: `Reverso ${m.reference}`,
                              })
                              const list = await db.ledger.where('customerId').equals(Number(selected)).toArray()
                              setMoves(list)
                              toast.show('Reverso generado', 'success')
                            }}>Generar reverso</Button>
                          </>
                        ) : (
                          <Button variant="secondary" onClick={() => openInvoiceFromMove(m)}>Ver comprobante</Button>
                        )}
                      </div>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </Table>
      </Card>

      {/* Modal editar pago */}
      <Modal isOpen={!!editMove} title="Editar pago" onClose={() => setEditMove(null)}
        footer={(
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setEditMove(null)}>Cancelar</Button>
            <Button variant="primary" onClick={async () => {
              if (!editMove) return
              const val = parseMoney(editForm.amount)
              if (isNaN(val) || val <= 0) { toast.show('Importe inválido', 'danger'); return }
              await db.ledger.update(editMove.id, {
                amount: val,
                date: new Date(editForm.date).toISOString(),
                reference: editForm.reference || 'Pago',
                method: editForm.method || 'efectivo'
              })
              const list = await db.ledger.where('customerId').equals(Number(selected)).toArray()
              setMoves(list)
              setEditMove(null)
              toast.show('Pago actualizado', 'success')
            }}>Guardar cambios</Button>
          </div>
        )}
      >
        <div className="space-y-3">
          <Input label="Importe" type="text" value={editForm.amount} onChange={e => {
            let val = e.target.value || ''
            val = val.replace(/\./g, ',')
            val = val.replace(/[^\d,]/g, '')
            val = val.replace(/(,.*),/, '$1')
            setEditForm(prev => ({ ...prev, amount: val }))
          }} />
          <Input label="Fecha" type="date" value={editForm.date} onChange={e => setEditForm(prev => ({ ...prev, date: e.target.value }))} />
          <Input label="Referencia" value={editForm.reference} onChange={e => setEditForm(prev => ({ ...prev, reference: e.target.value }))} />
          <Select label="Medio" value={editForm.method} onChange={e => setEditForm(prev => ({ ...prev, method: e.target.value }))}>
            <option value="efectivo">Efectivo</option>
            <option value="transferencia">Transferencia</option>
            <option value="tarjeta">Tarjeta</option>
          </Select>
        </div>
      </Modal>

      {/* Modal eliminar pago */}
      <Modal isOpen={!!deleteMove} title="Eliminar pago" onClose={() => setDeleteMove(null)}
        footer={(
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setDeleteMove(null)}>Cancelar</Button>
            <Button variant="danger" onClick={async () => {
              if (!deleteMove) return
              await db.ledger.delete(deleteMove.id)
              const list = await db.ledger.where('customerId').equals(Number(selected)).toArray()
              setMoves(list)
              setDeleteMove(null)
              toast.show('Pago eliminado', 'success')
            }}>Eliminar</Button>
          </div>
        )}
      >
        <p>¿Confirmás eliminar el pago de {deleteMove ? formatMoney(deleteMove.amount) : ''}?</p>
      </Modal>

      {/* Modal detalle de factura */}
      <Modal isOpen={invDetailOpen} title={invDetail ? `Comprobante #${invDetail.number}` : 'Comprobante'} onClose={() => setInvDetailOpen(false)}
        footer={(
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setInvDetailOpen(false)}>Cerrar</Button>
            {invDetail && (
              <Button variant="primary" onClick={() => {
                const qs = new URLSearchParams({ invoiceId: String(invDetail.id), minimal: '1', doc: invDocType }).toString()
                navigate(`/facturas/reporte?${qs}`)
              }}>Imprimir</Button>
            )}
          </div>
        )}
      >
        {invLoading ? (
<p className="text-slate-600"><Badge variant="default">⏳ Cargando…</Badge></p>
        ) : invDetail ? (
          <div className="space-y-3">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div className="p-3 bg-slate-50 rounded border border-slate-200 text-slate-700">
<div><span className="text-slate-600">Fecha:</span> <span className="font-medium">{new Date(invDetail.date).toLocaleDateString()}</span></div>
<div><span className="text-slate-600">Condición:</span> <span className="font-medium">{invDetail.condition || '—'}</span></div>
              </div>
              <div className="p-3 bg-slate-50 rounded border border-slate-200 text-slate-700 md:col-span-2">
<div><span className="text-slate-600">Total:</span> <span className="font-semibold">{formatMoney(invDetail.total || 0)}</span></div>
              </div>
            </div>
            <div>
              <h3 className="font-semibold mb-2">Ítems</h3>
              <Table>
                <thead>
                  <tr className="bg-slate-50 text-slate-700 text-left">
                    <th className="p-2 border border-slate-200">Producto</th>
                    <th className="p-2 border border-slate-200">Cantidad</th>
                    <th className="p-2 border border-slate-200">Precio unitario</th>
                    <th className="p-2 border border-slate-200">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {invItems.length === 0 ? (
<tr><td colSpan={4} className="p-3 text-center text-slate-600"><Badge variant="default">Sin ítems</Badge></td></tr>
                  ) : invItems.map((it, idx) => (
                    <tr key={idx} className="border-t border-slate-200">
                      <td className="p-2 border border-slate-200">{it.productName}</td>
                      <td className="p-2 border border-slate-200">{it.qty}</td>
                      <td className="p-2 border border-slate-200">{formatMoney(it.unitPrice)}</td>
                      <td className="p-2 border border-slate-200">{formatMoney(it.total)}</td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            </div>
          </div>
        ) : (
<p className="text-slate-600"><Badge variant="default">ℹ️ Selecciona un comprobante</Badge></p>
        )}
      </Modal>
    </div>
  )
}