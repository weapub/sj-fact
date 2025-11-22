import { useEffect, useState } from 'react'
import { exportData, importData, syncWithRemote } from '../data/sync'
import { db } from '../data/db'
import { getUser, supabase, isSupabaseConfigured, pushAll, pullAll } from '../data/cloud/supabase'
import Button from './Button'

export default function SyncStatus() {
  const [status, setStatus] = useState('idle')
  const [message, setMessage] = useState('')
  const [user, setUser] = useState(null)
  const [counts, setCounts] = useState(null)
  const [summary, setSummary] = useState(null)
  const [uploading, setUploading] = useState(false)
  const [downloading, setDownloading] = useState(false)

  useEffect(() => {
    getUser().then(setUser)
    if (supabase?.auth) {
      const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
        setUser(session?.user ?? null)
      })
      return () => sub.subscription.unsubscribe()
    }
  }, [])

  async function refreshCounts() {
    const cts = {
      customers: await db.customers.count(),
      products: await db.products.count(),
      priceLists: await db.priceLists.count(),
      prices: await db.prices.count(),
      invoices: await db.invoices.count(),
      invoiceItems: await db.invoiceItems.count(),
      ledger: await db.ledger.count(),
    }
    setCounts(cts)
  }

  useEffect(() => {
    refreshCounts()
  }, [])

  async function handleExport() {
    const json = await exportData()
    const blob = new Blob([json], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'sj-facturacion-backup.json'
    a.click()
    URL.revokeObjectURL(url)
    setStatus('exported')
    setMessage('Datos exportados en JSON')
    refreshCounts()
  }

  async function handleImport(e) {
    const file = e.target.files?.[0]
    if (!file) return
    const text = await file.text()
    await importData(text)
    setStatus('imported')
    setMessage('Datos importados desde JSON')
    refreshCounts()
  }

  async function handleSyncRemote() {
    if (!isSupabaseConfigured() || !supabase) {
      setStatus('error')
      setMessage('Configure VITE_SUPABASE_URL y VITE_SUPABASE_ANON_KEY')
      return
    }
    if (!user) {
      setStatus('error')
      setMessage('Inicie sesión para sincronizar')
      return
    }
    setStatus('syncing')
    const res = await syncWithRemote()
    setStatus(res.status)
    setMessage(res.message)
    setSummary(res.summary || null)
    refreshCounts()
  }

  async function handleUploadOnly() {
    if (!isSupabaseConfigured() || !supabase) {
      setStatus('error')
      setMessage('Configure VITE_SUPABASE_URL y VITE_SUPABASE_ANON_KEY')
      return
    }
    if (!user) {
      setStatus('error')
      setMessage('Inicie sesión para subir')
      return
    }
    setUploading(true)
    try {
      const localJson = await exportData()
      const local = JSON.parse(localJson)
      await pushAll(local)
      setStatus('uploaded')
      setMessage('Subida a la nube completada')
      refreshCounts()
    } catch (err) {
      setStatus('error')
      setMessage(`Error al subir: ${err.message}`)
    } finally {
      setUploading(false)
    }
  }

  async function handleDownloadOnly() {
    if (!isSupabaseConfigured() || !supabase) {
      setStatus('error')
      setMessage('Configure VITE_SUPABASE_URL y VITE_SUPABASE_ANON_KEY')
      return
    }
    if (!user) {
      setStatus('error')
      setMessage('Inicie sesión para descargar')
      return
    }
    setDownloading(true)
    try {
      const remote = await pullAll()
      await importData(JSON.stringify(remote))
      setStatus('downloaded')
      setMessage('Descarga desde la nube aplicada a la base local')
      refreshCounts()
    } catch (err) {
      setStatus('error')
      setMessage(`Error al descargar: ${err.message}`)
    } finally {
      setDownloading(false)
    }
  }

  async function handleResetLocal() {
    const ok = window.confirm('Esto borrará la base local (IndexedDB). ¿Continuar?')
    if (!ok) return
    await db.delete()
    setStatus('reset')
    setMessage('Base local borrada. Recargando...')
    // Recargar para re-inicializar Dexie y el seed
    setTimeout(() => {
      window.location.reload()
    }, 400)
  }

  return (
    <div className="flex gap-2 items-center">
      <Button variant="neutral" size="sm" onClick={handleExport}>Exportar JSON</Button>
      <Button as="label" variant="neutral" size="sm" className="cursor-pointer">
        Importar JSON
        <input type="file" accept="application/json" className="hidden" onChange={handleImport} />
      </Button>
      <Button variant="primary" size="sm" onClick={handleUploadOnly} disabled={!user || uploading}>{uploading ? 'Subiendo…' : 'Subir a la nube'}</Button>
      <Button variant="primary" size="sm" onClick={handleSyncRemote} disabled={!user}>Sync nube</Button>
      <Button variant="outline" size="sm" onClick={handleDownloadOnly} disabled={!user || downloading}>{downloading ? 'Descargando…' : 'Descargar'}</Button>
      <Button variant="danger" size="sm" onClick={handleResetLocal}>Reset local</Button>
      <span className="text-[13px] text-slate-600">{status !== 'idle' ? message : 'Sincronización local/nube'}</span>
      {summary && (summary.filtered?.invoiceItems > 0 || summary.filtered?.prices > 0 || summary.remapped?.invoiceItems > 0 || summary.remapped?.prices > 0) && (
        <span className="text-[12px] text-amber-700 bg-amber-100 px-2 py-0.5 rounded-md">
          Omisiones: {summary.filtered?.invoiceItems ?? 0} items, {summary.filtered?.prices ?? 0} precios. Remapeos: {summary.remapped?.invoiceItems ?? 0} items, {summary.remapped?.prices ?? 0} precios.
        </span>
      )}
      {counts && (
        <span className="text-[12px] text-slate-500">
          [{counts.customers} clientes, {counts.products} productos, {counts.priceLists} listas, {counts.prices} precios, {counts.invoices} facturas, {counts.invoiceItems} items, {counts.ledger} asientos]
        </span>
      )}
    </div>
  )
}