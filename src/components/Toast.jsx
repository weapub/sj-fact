import { useState, useCallback } from 'react'
import { ToastContext } from './ToastContext'

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([])

  const show = useCallback((message, variant = 'success', duration = 3000) => {
    const id = Math.random().toString(36).slice(2)
    setToasts(prev => [...prev, { id, message, variant }])
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id))
    }, duration)
  }, [])

  return (
    <ToastContext.Provider value={{
      show,
      success: (m, d = 3000) => show(m, 'success', d),
      info: (m, d = 3000) => show(m, 'info', d),
      warning: (m, d = 3000) => show(m, 'warning', d),
      error: (m, d = 3000) => show(m, 'error', d),
    }}>
      {children}
      <ToastViewport toasts={toasts} />
    </ToastContext.Provider>
  )
}

/**
 * Toast Viewport con soporte de accesibilidad.
 * Usa aria-live="polite" para anunciar notificaciones a lectores de pantalla.
 */
export function ToastViewport({ toasts = [] }) {
  const getIcon = (variant) => {
    switch (variant) {
      case 'success': return '✓'
      case 'error': return '✕'
      case 'warning': return '⚠'
      case 'info': return 'ℹ'
      default: return '•'
    }
  }

  const getAriaLabel = (variant) => {
    switch (variant) {
      case 'success': return 'Éxito'
      case 'error': return 'Error'
      case 'warning': return 'Advertencia'
      case 'info': return 'Información'
      default: return 'Notificación'
    }
  }

  return (
    <div 
      className="fixed top-4 right-4 z-50 space-y-2"
      role="region"
      aria-live="polite"
      aria-label="Notificaciones"
    >
      {toasts.map(t => (
        <div 
          key={t.id} 
          className={`px-4 py-3 rounded-lg shadow-lg border-l-4 text-sm font-medium animate-in fade-in slide-in-from-right-4 ${
            t.variant === 'success' ? 'bg-green-50 border-green-500 text-green-900' :
            t.variant === 'info' ? 'bg-blue-50 border-blue-500 text-blue-900' :
            t.variant === 'warning' ? 'bg-amber-50 border-amber-500 text-amber-900' :
            'bg-red-50 border-red-500 text-red-900'
          }`}
          role="alert"
          aria-label={`${getAriaLabel(t.variant)}: ${t.message}`}
        >
          <div className="flex items-center gap-2">
            <span className="font-bold text-lg" aria-hidden="true">
              {getIcon(t.variant)}
            </span>
            <span>{t.message}</span>
          </div>
        </div>
      ))}
    </div>
  )
}
