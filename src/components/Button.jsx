/**
 * Button component con soporte de accesibilidad mejorado.
 * 
 * @param {string} variant - 'primary' | 'neutral' | 'danger' | 'success' | 'outline'
 * @param {string} size - 'sm' | 'md'
 * @param {string} ariaLabel - Etiqueta aria para VO/Narrator (recomendado)
 * @param {boolean} disabled - Deshabilitar botón
 * @param {React.ElementType} as - Componente a usar (default: 'button')
 */
export default function Button({ 
  children, 
  variant = 'primary', 
  size = 'sm', 
  as, 
  ariaLabel,
  className = '', 
  ...props 
}) {
  const Component = as || 'button'
  const base = 'inline-flex items-center gap-2 rounded-md shadow-sm transition-colors duration-150 focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-blue-500 font-medium hover:opacity-95 active:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed'
  const sizes = {
    sm: 'px-3 py-1 text-sm',
    md: 'px-4 py-2 text-base',
  }
  const variants = {
    primary: 'bg-blue-600 hover:bg-blue-700 text-white',
    neutral: 'bg-gray-600 hover:bg-gray-700 text-white',
    danger: 'bg-red-600 hover:bg-red-700 text-white',
    success: 'bg-green-600 hover:bg-green-700 text-white',
    outline: 'bg-transparent border-2 border-gray-300 hover:bg-gray-50 text-gray-700',
  }
  const cls = `${base} ${sizes[size] || sizes.sm} ${variants[variant] || variants.primary} ${className}`
  return (
    <Component 
      {...props} 
      className={cls}
      aria-label={ariaLabel}
    >
      {children}
    </Component>
  )
}