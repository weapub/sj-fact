import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import Card from '../components/Card'
import Button from '../components/Button'
import Badge from '../components/Badge'
import { db } from '../data/db'
import { formatMoney } from '../utils/format'

export default function InvoiceReport() {
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const invoiceId = Number(params.get('invoiceId'))
  const auto = params.get('auto') === '1'
  const minimal = params.get('minimal') === '1'
  const docParam = params.get('doc') || ''

  const [invoice, setInvoice] = useState(null)
  const [customer, setCustomer] = useState(null)
  const [items, setItems] = useState([])
  const [products, setProducts] = useState([])
  const businessName = import.meta.env.VITE_BUSINESS_NAME || 'Mi Negocio'
  const businessAddress = import.meta.env.VITE_BUSINESS_ADDRESS || ''
  const businessCuit = import.meta.env.VITE_BUSINESS_CUIT || ''
  const invoiceType = (import.meta.env.VITE_INVOICE_TYPE || 'C').toUpperCase()
  const posNumber = import.meta.env.VITE_INVOICE_PTO_VTA || ''
  const cae = import.meta.env.VITE_INVOICE_CAE || ''
  const caeDue = import.meta.env.VITE_INVOICE_CAE_DUE || ''

  useEffect(() => { db.products.toArray().then(setProducts) }, [])
  useEffect(() => {
    if (!invoiceId) return
    db.invoices.get(invoiceId).then(inv => {
      setInvoice(inv || null)
      if (inv) {
        db.customers.get(inv.customerId).then(setCustomer)
        db.invoiceItems.where('invoiceId').equals(inv.id).toArray().then(rows => {
          const detailed = rows.map(r => {
            const p = products.find(x => x.id === Number(r.productId))
            return {
              productName: p ? p.name : `#${r.productId}`,
              qty: r.qty,
              unitPrice: r.unitPrice,
              total: r.total
            }
          })
          setItems(detailed)
        })
      }
    })
  }, [invoiceId, products])

  useEffect(() => {
    if (auto && invoice) {
      setTimeout(() => window.print(), 150)
    }
  }, [auto, invoice])

  const total = useMemo(() => items.reduce((acc, it) => acc + it.total, 0), [items])

  const formattedPv = String(posNumber || '').padStart(4, '0')
  const formattedNumber = String(invoice?.number || '').padStart(8, '0')
  const qrData = useMemo(() => {
    if (!invoice) return ''
    const payload = {
      name: businessName,
      cuit: businessCuit,
      type: invoiceType,
      pv: formattedPv,
      number: formattedNumber,
      date: new Date(invoice.date).toISOString().slice(0,10),
      total: Number(total.toFixed(2)),
      cae: cae || undefined,
      cae_due: caeDue || undefined,
      customer: customer?.name || undefined,
    }
    return JSON.stringify(payload)
  }, [invoice, businessName, businessCuit, invoiceType, formattedPv, formattedNumber, total, cae, caeDue, customer])

  return (
    <div className="max-w-5xl mx-auto space-y-4 p-4 print:max-w-none print:mx-0 print:p-0">
      <div className="flex items-center justify-between">
<h2 className="text-2xl font-bold tracking-tight text-slate-800">
          {minimal ? `Comprobante ${invoice ? invoice.number : ''}` : `Factura ${invoice ? invoice.number : ''}`}
        </h2>
        <div className="print:hidden flex gap-2">
          <Button type="button" variant="primary" onClick={() => window.print()}>Imprimir</Button>
          <Button type="button" variant="secondary" onClick={() => navigate('/facturas')}>Volver</Button>
        </div>
      </div>

      {!invoice ? (
        <Card className="print:shadow-none print:border-0 print:p-0">
<div className="text-slate-600">No se encontró la factura solicitada.</div>
        </Card>
      ) : (
        minimal ? (
          <Card className="print:shadow-none print:border-0 print:p-0">
            <div className="space-y-4">
              <div>
<div className="text-sm text-slate-600">Cliente</div>
                <div className="font-semibold">{customer ? customer.name : '—'}</div>
              </div>
              <div>
<div className="text-sm text-slate-600">Dirección</div>
                <div className="font-semibold">{customer ? (customer.address || '—') : '—'}</div>
              </div>
              <div>
<div className="text-sm text-slate-600">Fecha</div>
                <div className="font-semibold">{new Date(invoice.date).toLocaleDateString()}</div>
              </div>
              <div>
<div className="text-sm text-slate-600">Número de comprobante</div>
                <div className="font-semibold">{invoice.number}</div>
              </div>
            </div>
          </Card>
        ) : (
          <Card className="print:shadow-none print:border-0 print:p-0">
            <div className="mb-4">
              <div className="flex items-start justify-between">
                <div>
                  <div className="text-xl font-semibold">{businessName}</div>
{businessAddress && <div className="text-sm text-slate-700">{businessAddress}</div>}
{businessCuit && <div className="text-sm text-slate-700">CUIT: {businessCuit}</div>}
                </div>
                <div className="text-right">
<div className="text-sm text-slate-600">Factura {invoiceType}</div>
                  <div className="text-lg font-semibold">PV {formattedPv} · {formattedNumber}</div>
<div className="text-sm text-slate-700">Condición de venta: {invoice.condition || '—'}</div>
                  {cae && (
<div className="mt-1 text-sm text-slate-700">CAE: {cae}{caeDue ? ` · Vto: ${caeDue}` : ''}</div>
                  )}
                  {qrData && (
                    <div className="mt-2 inline-block border p-1">
                      <img
                        src={`https://api.qrserver.com/v1/create-qr-code/?size=128x128&data=${encodeURIComponent(qrData)}`}
                        alt="QR comprobante"
                        className="w-24 h-24"
                      />
                    </div>
                  )}
                </div>
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
              <div>
<div className="text-sm text-slate-600">Cliente</div>
                <div className="font-semibold">{customer ? customer.name : '—'}</div>
              </div>
              <div>
<div className="text-sm text-slate-600">Fecha</div>
                <div className="font-semibold">{new Date(invoice.date).toLocaleDateString()}</div>
              </div>
            </div>

            <div className="overflow-auto print:overflow-visible">
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
                  {items.length === 0 && (
                    <tr>
<td colSpan="4" className="px-3 py-3 text-slate-600 text-center"><Badge variant="default">Sin ítems</Badge></td>
                    </tr>
                  )}
                  {items.map((it, idx) => (
                    <tr key={idx}>
                      <td className="px-3 py-2 border border-slate-200">{it.productName}</td>
                      <td className="px-3 py-2 border border-slate-200 text-right">{String(it.qty)}</td>
                      <td className="px-3 py-2 border border-slate-200 text-right">{formatMoney(it.unitPrice)}</td>
                      <td className="px-3 py-2 border border-slate-200 text-right">{formatMoney(it.total)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="mt-4 text-right">
<div className="text-sm text-slate-700">Total factura</div>
              <div className="text-xl font-semibold">{formatMoney(total)}</div>
            </div>
          </Card>
        )
      )}
    </div>
  )
}