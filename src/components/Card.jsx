export default function Card({ title, subtitle, children, className = '' }) {
  return (
    <div className={`bg-white rounded-2xl shadow-md border border-slate-200 p-5 space-y-3 ${className}`}>
      {(title || subtitle) && (
        <div className="flex items-center justify-between">
          {title && <h3 className="text-lg font-semibold text-slate-800">{title}</h3>}
          {subtitle && <div className="text-sm text-slate-600">{subtitle}</div>}
        </div>
      )}
      {children}
    </div>
  )
}