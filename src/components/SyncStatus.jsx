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
      <button type="button" title={uploading ? 'Subiendo…' : 'Subir a la nube'} aria-label="Subir a la nube" onClick={handleUploadOnly} disabled={!user || uploading} className="px-2 py-2 rounded-md border bg-white hover:bg-gray-50 disabled:opacity-50">
        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M16 16v2a4 4 0 0 1-4 4h-5a4 4 0 0 1-4-4v-3a4 4 0 0 1 4-4h1"/><path d="M12 12v9"/><path d="M8 16l4-4 4 4"/><path d="M20 16a4 4 0 0 0 0-8 5 5 0 0 0-9-3"/></svg>
      </button>
      <button type="button" title="Sincronizar con nube" aria-label="Sincronizar" onClick={handleSyncRemote} disabled={!user} className="px-2 py-2 rounded-md border bg-white hover:bg-gray-50 disabled:opacity-50">
        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 12a9 9 0 1 1-6.219-8.56"/><path d="M21 3v9h-9"/></svg>
      </button>
      <button type="button" title={downloading ? 'Descargando…' : 'Descargar de la nube'} aria-label="Descargar" onClick={handleDownloadOnly} disabled={!user || downloading} className="px-2 py-2 rounded-md border bg-white hover:bg-gray-50 disabled:opacity-50">
        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M7 20h10a4 4 0 0 0 4-4v-3a4 4 0 0 0-4-4h-1"/><path d="M12 2v12"/><path d="M16 10l-4 4-4-4"/></svg>
      </button>
      <button type="button" title="Borrar base local" aria-label="Reset local" onClick={handleResetLocal} className="px-2 py-2 rounded-md border bg-white hover:bg-gray-50">
        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 6h18"/><path d="M8 6v14a2 2 0 0 0 2 2h4a2 2 0 0 0 2-2V6"/><path d="M10 10v8M14 10v8"/><path d="M9 6l1-3h4l1 3"/></svg>
      </button>
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