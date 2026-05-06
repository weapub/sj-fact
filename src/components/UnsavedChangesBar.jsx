import { useEffect } from 'react'
import Button from './Button'

/**
 * Componente que muestra una advertencia cuando se intenta salir de la página con cambios sin guardar.
 * Se muestra en la parte inferior de la ventana.
 * 
 * @param {boolean} isDirty - Si el formulario tiene cambios sin guardar
 * @param {function} onSave - Callback cuando se hace clic en "Guardar"
 * @param {function} onDiscard - Callback cuando se hace clic en "Descartar"
 */
export default function UnsavedChangesBar({ isDirty, onSave, onDiscard }) {
  // Prevenir que el usuario cierre la navegador sin guardar
  useEffect(() => {
    const handleBeforeUnload = (event) => {
      if (isDirty) {
        event.preventDefault()
        event.returnValue = 'Tienes cambios sin guardar.'
      }
    }

    window.addEventListener('beforeunload', handleBeforeUnload)
    return () => window.removeEventListener('beforeunload', handleBeforeUnload)
  }, [isDirty])

  if (!isDirty) return null

  return (
    <div className="fixed bottom-0 left-0 right-0 bg-amber-50 border-t-2 border-amber-500 shadow-lg p-4 flex items-center justify-between gap-4">
      <div className="flex items-center gap-2 flex-1">
        <span className="text-lg" aria-hidden="true">⚠️</span>
        <div>
          <p className="font-semibold text-amber-900">Cambios sin guardar</p>
          <p className="text-sm text-amber-700">Tienes cambios pendientes que se perderán si sales sin guardar.</p>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <Button 
          variant="outline" 
          size="sm"
          onClick={onDiscard}
          ariaLabel="Descartar cambios"
        >
          Descartar
        </Button>
        <Button 
          variant="success" 
          size="sm"
          onClick={onSave}
          ariaLabel="Guardar cambios"
        >
          Guardar
        </Button>
      </div>
    </div>
  )
}
