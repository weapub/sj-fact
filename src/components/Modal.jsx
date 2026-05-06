import { useEffect, useRef } from 'react'

/**
 * Modal component con focus management y accesibilidad.
 * Atrapa el foco dentro del modal cuando está abierto.
 * 
 * @param {boolean} isOpen - Si el modal está abierto
 * @param {string} title - Título del modal
 * @param {function} onClose - Callback cuando se cierra
 * @param {React.ReactNode} children - Contenido
 * @param {React.ReactNode} footer - Footer del modal
 * @param {string} className - Clases adicionales
 */
export default function Modal({ 
  isOpen, 
  title, 
  onClose, 
  children, 
  footer, 
  className = '',
  ariaLabel
}) {
  const dialogRef = useRef(null)

  useEffect(() => {
    if (!isOpen) return

    // Focus en el modal cuando abre
    setTimeout(() => dialogRef.current?.focus(), 0)

    // Cerrar con ESC
    const handleEscape = (e) => {
      if (e.key === 'Escape') onClose()
    }
    
    // Trap focus dentro del modal
    const handleKeyDown = (e) => {
      if (e.key !== 'Tab') return
      
      const modal = dialogRef.current
      if (!modal) return
      
      const focusableElements = modal.querySelectorAll(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      )
      
      const firstElement = focusableElements[0]
      const lastElement = focusableElements[focusableElements.length - 1]
      
      if (e.shiftKey && document.activeElement === firstElement) {
        e.preventDefault()
        lastElement.focus()
      } else if (!e.shiftKey && document.activeElement === lastElement) {
        e.preventDefault()
        firstElement.focus()
      }
    }

    document.addEventListener('keydown', handleEscape)
    document.addEventListener('keydown', handleKeyDown)
    
    return () => {
      document.removeEventListener('keydown', handleEscape)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [isOpen, onClose])

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/40 backdrop-blur-sm" 
        onClick={onClose}
        aria-hidden="true"
      />
      
      {/* Modal */}
      <dialog
        ref={dialogRef}
        open
        className={`relative bg-white rounded-2xl shadow-2xl border border-gray-200 w-full max-w-lg ${className}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby={title ? 'modal-title' : undefined}
        aria-label={ariaLabel}
      >
        {title && (
          <div className="px-6 py-4 border-b border-gray-200">
            <h2 
              id="modal-title"
              className="text-lg font-semibold text-gray-900"
            >
              {title}
            </h2>
          </div>
        )}
        
        <div className="p-6">
          {children}
        </div>
        
        {footer && (
          <div className="px-6 py-4 border-t border-gray-200 bg-gray-50 rounded-b-xl">
            {footer}
          </div>
        )}
      </dialog>
    </div>
  )
}