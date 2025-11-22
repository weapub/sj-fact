export default function Button({ children, variant = 'primary', size = 'sm', as, className = '', ...props }) {
  const Component = as || 'button'
  const base = 'inline-flex items-center gap-2 rounded-md shadow-sm transition-colors duration-150 focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-slate-300 hover:opacity-95 active:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed'
  const sizes = {
    sm: 'px-3 py-1 text-sm',
    md: 'px-4 py-2 text-base',
  }
  const variants = {
    primary: 'bg-indigo-500 hover:bg-indigo-400 text-indigo-50',
    neutral: 'bg-slate-600 hover:bg-slate-500 text-slate-50',
    danger: 'bg-rose-500 hover:bg-rose-400 text-rose-50',
    success: 'bg-emerald-500 hover:bg-emerald-400 text-emerald-50',
    outline: 'bg-transparent border border-slate-300 hover:bg-slate-50 text-slate-700',
  }
  const cls = `${base} ${sizes[size] || sizes.sm} ${variants[variant] || variants.primary} ${className}`
  return (
    <Component {...props} className={cls}>
      {children}
    </Component>
  )
}