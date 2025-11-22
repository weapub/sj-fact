export default function Modal({ isOpen, title, onClose, children, footer, className = '' }) {
  if (!isOpen) return null
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" onClick={onClose} />
      <div className={`relative bg-white rounded-2xl shadow-xl border border-gray-200 w-full max-w-lg mx-4 ${className}`}>
        {title && <div className="px-4 py-3 border-b"><h3 className="font-semibold text-gray-900">{title}</h3></div>}
        <div className="p-4">
          {children}
        </div>
        {footer && <div className="px-4 py-3 border-t bg-gray-50">{footer}</div>}
      </div>
    </div>
  )
}