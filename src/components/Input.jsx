import { forwardRef } from 'react'

/**
 * Input component con soporte de accesibilidad mejorado.
 * API CONSISTENTE: usa 'className' para personalizar clases
 * 
 * @param {string} label - Etiqueta del input
 * @param {string} helper - Texto de ayuda bajo el input
 * @param {boolean} error - Si el input tiene error
 * @param {string} errorMessage - Mensaje de error
 * @param {string} ariaDescribedBy - ID del elemento que describe el input
 * @param {string} className - Clases adicionales del input (no del contenedor)
 */
export default forwardRef(function Input({ 
  label, 
  helper, 
  error = false,
  errorMessage,
  className = '', 
  id,
  ...props 
}, ref) {
  const inputId = id || `input-${Math.random().toString(36).substr(2, 9)}`
  const helperId = `${inputId}-helper`
  const errorId = `${inputId}-error`
  const describedByIds = [
    helper && helperId,
    error && errorMessage && errorId,
  ].filter(Boolean).join(' ')

  return (
    <div className="space-y-1">
      {label && (
        <label 
          htmlFor={inputId}
          className="block text-sm font-medium text-gray-700"
        >
          {label}
        </label>
      )}
      <input 
        ref={ref} 
        id={inputId}
        {...props} 
        aria-invalid={error}
        aria-describedby={describedByIds || undefined}
        className={`w-full border-2 rounded-lg px-3 py-2 bg-white transition-colors
          ${error 
            ? 'border-red-500 focus:border-red-500 focus:ring-red-500' 
            : 'border-gray-300 focus:border-blue-500 focus:ring-blue-500'
          }
          placeholder:text-gray-400 
          focus:outline-none focus:ring-2 focus:ring-offset-0
          disabled:bg-gray-100 disabled:text-gray-500 disabled:cursor-not-allowed
          ${className}`}
      />
      {helper && (
        <p id={helperId} className="text-xs text-gray-600">
          {helper}
        </p>
      )}
      {error && errorMessage && (
        <p id={errorId} className="text-xs text-red-600 font-medium" role="alert">
          ⚠️ {errorMessage}
        </p>
      )}
    </div>
  )
})