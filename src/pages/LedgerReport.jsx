import { useEffect, useMemo, useState } from 'react'
import { useSearchParams, useNavigate } from 'react-router-dom'
import { db } from '../data/db'
import Card from '../components/Card'
import Button from '../components/Button'
import Table from '../components/Table'
import Badge from '../components/Badge'
import { formatMoney } from '../utils/format'

export default function LedgerReport() {
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const customerId = Number(params.get('customerId'))
  const from = params.get('from') || ''
  const to = params.get('to') || ''
  const method = params.get('method') || ''
  const auto = params.get('auto') === '1'

  const [customer, setCustomer] = useState(null)
  const [moves, setMoves] = useState([])

  useEffect(() => {
    if (!customerId) return
    db.customers.get(customerId).then(setCustomer)
    db.ledger.where('customerId').equals(customerId).toArray().then(setMoves)
  }, [customerId])

  const filteredMoves = useMemo(() => {
    const fromD = from ? new Date(from) : null
    const toD = to ? new Date(to) : null
    return moves.filter(m => {
      const d = new Date(m.date)
      if (fromD && d < fromD) return false
      if (toD) {
        const end = new Date(to)
        end.setHours(23,59,59,999)
        if (d > end) return false
      }
      if (method && m.type === 'haber') {
        return (m.method || '') === method
      }
      return true
    })
  }, [moves, from, to, method])

  const totDebe = useMemo(() => filteredMoves.filter(m => m.type === 'debe').reduce((a, m) => a + m.amount, 0), [filteredMoves])
  const totHaber = useMemo(() => filteredMoves.filter(m => m.type === 'haber').reduce((a, m) => a + m.amount, 0), [filteredMoves])
  const saldo = useMemo(() => totDebe - totHaber, [totDebe, totHaber])

  useEffect(() => {
    if (auto) {
      const t = setTimeout(() => window.print(), 300)
      return () => clearTimeout(t)
    }
  }, [auto])

  return (
    <div className="max-w-5xl mx-auto p-6">
      <div className="print:hidden flex justify-between items-center mb-4">
        <Button variant="secondary" onClick={() => navigate(-1)}>Volver</Button>
        <div className="flex gap-2">
          <Button variant="primary" onClick={() => window.print()}>Imprimir</Button>
        </div>
      </div>

      <div className="space-y-4">
        <div className="text-center">
          <h1 className="text-2xl font-bold">Informe de cuenta corriente</h1>
<p className="text-slate-600">Generado: {new Date().toLocaleString()}</p>
        </div>
        <Card>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <div><span className="font-semibold">Cliente:</span> {customer ? customer.name : customerId}</div>
              {customer?.taxId && <div><span className="font-semibold">CUIT/CUIL:</span> {customer.taxId}</div>}
              {customer?.email && <div><span className="font-semibold">Email:</span> {customer.email}</div>}
            </div>
            <div>
              <div><span className="font-semibold">Período:</span> {(from ? new Date(from).toLocaleDateString() : '-') + ' a ' + (to ? new Date(to).toLocaleDateString() : '-')}</div>
              <div><span className="font-semibold">Medio:</span> {method || 'Todos'}</div>
              <div><span className="font-semibold">Saldo del período:</span> {formatMoney(saldo)}</div>
            </div>
          </div>
        </Card>

        <Card>
          <div className="mb-3 font-semibold">Resumen</div>
          <div className="grid grid-cols-3 gap-3">
            <div className="p-3 bg-slate-50 rounded border border-slate-200 text-slate-700">Debe: <span className="font-semibold">{formatMoney(totDebe)}</span></div>
            <div className="p-3 bg-slate-50 rounded border border-slate-200 text-slate-700">Haber: <span className="font-semibold">{formatMoney(totHaber)}</span></div>
            <div className="p-3 bg-slate-50 rounded border border-slate-200 text-slate-700">Saldo: <span className="font-semibold">{formatMoney(saldo)}</span></div>
          </div>
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
              </tr>
            </thead>
            <tbody>
              {filteredMoves.length === 0 ? (
                <tr>
<td colSpan={5} className="p-3 text-center text-slate-600"><Badge variant="default">Sin movimientos en el período</Badge></td>
                </tr>
              ) : (
                filteredMoves.map(m => (
                  <tr key={m.id} className="border-t border-slate-200 hover:bg-slate-50">
                    <td className="p-2 border border-slate-200">{new Date(m.date).toLocaleDateString()}</td>
                    <td className="p-2 border border-slate-200">{m.type}</td>
                    <td className="p-2 border border-slate-200">{formatMoney(m.amount)}</td>
                    <td className="p-2 border border-slate-200">{m.reference || ''}</td>
                    <td className="p-2 border border-slate-200">{m.type === 'haber' ? (m.method || '') : ''}</td>
                  </tr>
                ))
              )}
            </tbody>
          </Table>
        </Card>
      </div>
    </div>
  )
}