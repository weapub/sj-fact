export default function Textarea({ label, helper, className = '', containerClassName = '', ...props }) {
  return (
    <div className={containerClassName}>
      {label && <label className="block text-sm font-medium">{label}</label>}
      <textarea
        className={`mt-1 w-full border rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${className}`}
        {...props}
      />
{helper && <p className="mt-1 text-xs text-slate-600">{helper}</p>}
    </div>
  )
}