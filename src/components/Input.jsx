import { forwardRef } from 'react'

export default forwardRef(function Input({ label, helper, className = '', containerClassName = '', ...props }, ref) {
  return (
    <div className={containerClassName}>
{label && <label className="block text-sm font-medium text-slate-700">{label}</label>}
      <input ref={ref} {...props} className={`mt-1 w-full border border-gray-300 rounded-xl px-3 py-2 bg-white shadow-sm placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 ${className}`} />
{helper && <p className="text-xs text-slate-600 mt-1">{helper}</p>}
    </div>
  )
})