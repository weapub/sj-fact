import { useEffect, useMemo, useState } from 'react'
import Card from '../components/Card'
import Table from '../components/Table'
import Input from '../components/Input'
import Button from '../components/Button'
import { db } from '../data/db'
import { formatMoney } from '../utils/format'
import { useToast } from '../components/Toast'

export default function Reports() {
  const [customers, setCustomers] = useState([])
  const [ledger, setLedger] = useState([])
  const [query, setQuery] = useState('')
  const toast = useToast()

  useEffect(() => {
    db.customers.orderBy('name').toArray().then(setCustomers)
    db.ledger.toArray().then(setLedger)
  }, [])

  const balances = useMemo(() => {
    const map = new Map()
    ledger.forEach(m => {
      const cur = map.get(m.customerId) || 0
      const next = cur + (m.type === 'debe' ? m.amount : -m.amount)
      map.set(m.customerId, next)
    })
    return map
  }, [ledger])

  const filtered = useMemo(() => {
    const q = (query || '').trim().toLowerCase()
    if (!q) return customers
    return customers.filter(c => [c.name, c.taxId, c.email, c.phone, c.address].some(v => (v || '').toLowerCase().includes(q)))
  }, [customers, query])

  const exportCsv = () => {
    if (filtered.length === 0) { toast.show('No hay datos para exportar', 'warning'); return }
    const sep = ';'
    const now = new Date()
    const headerBlock = [
      ['Listado de clientes'],
      ['Generado', now.toLocaleString()],
      ['Total clientes', String(filtered.length)],
      [''],
    ].map(row => row.join(sep)).join('\n')
    const headers = ['Nombre','CUIT/CUIL','Email','Teléfono','Dirección','Saldo','Observaciones'].join(sep)
    const rows = filtered.map(c => [
      c.name || '',
      c.taxId || '',
      c.email || '',
      c.phone || '',
      c.address || '',
      formatMoney(balances.get(c.id) || 0),
      (c.notes || '').replace(/\n/g, ' ')
    ].map(v => String(v)).join(sep)).join('\n')
    const content = `${headerBlock}\n${headers}\n${rows}\n`
    const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `clientes_${now.toISOString().slice(0,10)}.csv`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
    toast.show('Listado exportado (CSV)', 'success')
  }

  return (
    <div className="max-w-7xl mx-auto space-y-6 p-4">
  <h2 className="text-2xl font-bold tracking-tight text-slate-800">Reportes</h2>

      <Card title="Listado de clientes">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3 items-end">
          <Input label="Buscar" value={query} onChange={e => setQuery(e.target.value)} placeholder="Nombre, CUIT, email, teléfono, dirección…" />
          <div className="md:col-span-3 flex gap-2">
            <Button variant="primary" onClick={exportCsv} disabled={filtered.length === 0}>Exportar CSV</Button>
            <Button variant="secondary" onClick={() => window.print()} disabled={filtered.length === 0}>Imprimir listado</Button>
          </div>
        </div>
        <div className="mt-4">
          <Table>
            <thead>
              <tr className="bg-slate-50 text-slate-700 text-left">
                <th className="p-2 border border-slate-200">Nombre</th>
                <th className="p-2 border border-slate-200">CUIT/CUIL</th>
                <th className="p-2 border border-slate-200">Email</th>
                <th className="p-2 border border-slate-200">Teléfono</th>
                <th className="p-2 border border-slate-200">Dirección</th>
                <th className="p-2 border border-slate-200">Saldo</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
  <td colSpan={6} className="p-3 text-center text-slate-600">No hay clientes para el criterio</td>
                </tr>
              ) : (
                filtered.map(c => (
                  <tr key={c.id} className="border-t border-slate-200 hover:bg-slate-50">
                    <td className="p-2 border border-slate-200">{c.name}</td>
                    <td className="p-2 border border-slate-200">{c.taxId || '—'}</td>
                    <td className="p-2 border border-slate-200">{c.email || '—'}</td>
                    <td className="p-2 border border-slate-200">{c.phone || '—'}</td>
                    <td className="p-2 border border-slate-200">{c.address || '—'}</td>
                    <td className="p-2 border border-slate-200">{formatMoney(balances.get(c.id) || 0)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </Table>
        </div>
      </Card>
    </div>
  )
}