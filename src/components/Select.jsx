export default function Select({ label, helper, className = '', containerClassName = '', children, ...props }) {
  return (
    <div className={containerClassName}>
      {label && <label className="block text-sm font-medium">{label}</label>}
      <select {...props} className={`mt-1 w-full border rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${className}`}>
        {children}
      </select>
{helper && <p className="text-xs text-slate-600 mt-1">{helper}</p>}
    </div>
  )
}