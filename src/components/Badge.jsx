export default function Badge({ children, variant = 'default', className = '' }) {
  const base = 'inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium border'
  const variants = {
    default: 'bg-slate-50 text-slate-700 border-slate-200',
    info: 'bg-indigo-50 text-indigo-700 border-indigo-200',
    success: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    warning: 'bg-amber-50 text-amber-800 border-amber-200',
    danger: 'bg-rose-50 text-rose-700 border-rose-200',
  }
  return <span className={`${base} ${variants[variant] || variants.default} ${className}`}>{children}</span>
}