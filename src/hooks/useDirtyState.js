import { useEffect, useRef, useCallback } from 'react'

/**
 * Hook para detectar cambios en un formulario.
 * Muestra una confirmación si el usuario intenta salir con cambios sin guardar.
 * 
 * @param {boolean} isDirty - Si el formulario tiene cambios
 * @param {string} message - Mensaje de confirmación (default: "¿Descartar cambios sin guardar?")
 * @returns {void}
 */
export function useDirtyState(isDirty, message = '¿Descartar cambios sin guardar?') {
  const handleBeforeUnload = useCallback((event) => {
    if (isDirty) {
      event.preventDefault()
      event.returnValue = message
      return message
    }
  }, [isDirty, message])

  useEffect(() => {
    window.addEventListener('beforeunload', handleBeforeUnload)
    return () => window.removeEventListener('beforeunload', handleBeforeUnload)
  }, [handleBeforeUnload])
}

/**
 * Hook para comparar dos objetos y detectar si son diferentes.
 * Útil para detectar cambios en formularios.
 * 
 * @param {object} original - Objeto original
 * @param {object} current - Objeto actual
 * @returns {boolean} true si son diferentes
 */
export function useFormDirty(original, current) {
  const isEqual = JSON.stringify(original) === JSON.stringify(current)
  return !isEqual
}
