import { useEffect, useState } from 'react'
import { db } from '../data/db'
import Card from '../components/Card'
import Button from '../components/Button'
import Badge from '../components/Badge'
import Modal from '../components/Modal'
import { useToast } from '../components/Toast'

export default function Settings() {
  const toast = useToast()
  const [cloudConfigured, setCloudConfigured] = useState(false)
  const [cloudUserEmail, setCloudUserEmail] = useState('')
  const [deleteAllOpen, setDeleteAllOpen] = useState(false)
  const [resetAllOpen, setResetAllOpen] = useState(false)
  const [confirmDeleteAllText, setConfirmDeleteAllText] = useState('')
  const [confirmResetAllText, setConfirmResetAllText] = useState('')

  useEffect(() => {
    import('../data/cloud/supabase').then(mod => {
      const cfg = mod.isSupabaseConfigured?.() || false
      setCloudConfigured(cfg)
      if (cfg && mod.getUser) {
        mod.getUser().then(u => setCloudUserEmail(u?.email || ''))
      }
    }).catch(() => setCloudConfigured(false))
  }, [])

  async function performDeleteAll() {
    const all = await db.products.toArray()
    if (!all.length) { setDeleteAllOpen(false); toast.show('No hay productos'); return }
    const ids = all.map(p => p.id).filter(Boolean)
    await db.products.bulkDelete(ids)
    await db.prices.where('productId').anyOf(ids).delete()
    try {
      const { deleteProductsAndPricesByKeys, isSupabaseConfigured } = await import('../data/cloud/supabase')
      if (isSupabaseConfigured()) {
        const skus = all.map(p => p.sku).filter(Boolean)
        const names = all.map(p => p.name).filter(Boolean)
        await deleteProductsAndPricesByKeys({ skus, names })
      }
    } catch {}
    setDeleteAllOpen(false)
    setConfirmDeleteAllText('')
    toast.show('Todos los productos fueron eliminados')
  }

  async function performResetAll() {
    await db.customers.clear()
    await db.products.clear()
    await db.priceLists.clear()
    await db.prices.clear()
    await db.invoices.clear()
    await db.invoiceItems.clear()
    await db.ledger.clear()
    try {
      const { deleteAllOwnerData, isSupabaseConfigured } = await import('../data/cloud/supabase')
      if (isSupabaseConfigured()) {
        await deleteAllOwnerData()
      }
    } catch {}
    setResetAllOpen(false)
    setConfirmResetAllText('')
    toast.show('Datos reiniciados')
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6 p-4">
      <h2 className="text-2xl font-bold tracking-tight text-slate-800">Configuración</h2>

      <Card title="Estado de la nube">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2">
            <span className="text-slate-700">Supabase</span>
            {cloudConfigured ? <Badge variant="success">Configurado</Badge> : <Badge variant="danger">No configurado</Badge>}
          </div>
          <div className="flex items-center gap-2">
            <span className="text-slate-700">Sesión</span>
            {cloudUserEmail ? <Badge variant="info">{cloudUserEmail}</Badge> : <Badge variant="default">No iniciada</Badge>}
          </div>
        </div>
      </Card>

      <Card title="Zona peligrosa">
        <div className="space-y-2">
          <Button variant="danger" onClick={() => setDeleteAllOpen(true)}>Borrar todos los productos</Button>
          <Button variant="warning" onClick={() => setResetAllOpen(true)}>Borrar todo y reiniciar</Button>
        </div>
      </Card>

      <Modal
        isOpen={deleteAllOpen}
        title="Borrar todos los productos"
        onClose={() => setDeleteAllOpen(false)}
        footer={(
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setDeleteAllOpen(false)}>Cancelar</Button>
            <Button variant="danger" disabled={confirmDeleteAllText !== 'BORRAR'} onClick={performDeleteAll}>Borrar todos</Button>
          </div>
        )}
      >
        <p className="text-slate-700">Esta acción elimina todos los productos y sus precios asociados, local y en la nube si hay sesión.</p>
        <div className="mt-3">
          <label className="block text-sm">Escribí BORRAR para confirmar</label>
          <input type="text" className="mt-1 w-full border rounded px-3 py-2" value={confirmDeleteAllText} onChange={e => setConfirmDeleteAllText(e.target.value)} />
        </div>
      </Modal>

      <Modal
        isOpen={resetAllOpen}
        title="Borrar todo y empezar de nuevo"
        onClose={() => setResetAllOpen(false)}
        footer={(
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setResetAllOpen(false)}>Cancelar</Button>
            <Button variant="warning" disabled={confirmResetAllText !== 'BORRAR'} onClick={performResetAll}>Borrar todo</Button>
          </div>
        )}
      >
        <p className="text-slate-700">Esto eliminará clientes, productos, listas, precios, facturas, ítems y movimientos locales; y si hay sesión en la nube, también los datos del propietario.</p>
        <div className="mt-3">
          <label className="block text-sm">Escribí BORRAR para confirmar</label>
          <input type="text" className="mt-1 w-full border rounded px-3 py-2" value={confirmResetAllText} onChange={e => setConfirmResetAllText(e.target.value)} />
        </div>
      </Modal>
    </div>
  )
}