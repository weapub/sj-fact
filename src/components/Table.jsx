export default function Table({ children, className = '' }) {
  // Estilos base suaves para tablas: tipografía pequeña, borde sutil, cabezal claro y hover ligero
  const base = 'w-full text-sm border border-slate-200 rounded'
  return (
    <table className={`${base} ${className}`}>
      {children}
    </table>
  )
}