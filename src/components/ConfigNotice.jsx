import { useEffect, useState } from 'react'
import Button from './Button'
import { isSupabaseConfigured } from '../data/cloud/supabase'

const STORAGE_KEY = 'supabaseConfigNoticeDismissed'

export default function ConfigNotice() {
  const [dismissed, setDismissed] = useState(false)

  useEffect(() => {
    const v = window.localStorage.getItem(STORAGE_KEY)
    setDismissed(v === 'true')
  }, [])

  function handleDismiss() {
    setDismissed(true)
    window.localStorage.setItem(STORAGE_KEY, 'true')
  }

  if (isSupabaseConfigured() || dismissed) return null

  return (
    <div className="bg-amber-50 border border-amber-200 text-amber-900 px-4 py-2 flex justify-between items-center">
      <div className="text-sm">
        Supabase no está configurado. Añade `VITE_SUPABASE_URL` y `VITE_SUPABASE_ANON_KEY` en `.env.local` para habilitar autenticación y sincronización.
        Consulta el README o crea tu proyecto en Supabase.
      </div>
      <div className="flex items-center gap-2">
        <a href="https://supabase.com/docs" target="_blank" rel="noreferrer" className="text-sm text-indigo-700 underline">Docs</a>
        <Button onClick={handleDismiss} variant="neutral" size="sm">Cerrar</Button>
      </div>
    </div>
  )
}