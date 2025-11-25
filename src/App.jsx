import { Routes, Route, NavLink } from 'react-router-dom'
import { useState } from 'react'
import Customers from './pages/Customers.jsx'
import Products from './pages/Products.jsx'
import Invoices from './pages/Invoices.jsx'
import InvoiceReport from './pages/InvoiceReport.jsx'
import PriceLists from './pages/PriceLists.jsx'
import Ledger from './pages/Ledger.jsx'
import LedgerReport from './pages/LedgerReport.jsx'
import Reports from './pages/Reports.jsx'
import PriceCalculator from './pages/PriceCalculator.jsx'
import Settings from './pages/Settings.jsx'
import Purchases from './pages/Purchases.tsx'
import SyncStatus from './components/SyncStatus.jsx'
import AuthStatus from './components/AuthStatus.jsx'
import ConfigNotice from './components/ConfigNotice.jsx'
import { ToastProvider } from './components/Toast.jsx'

function AppLayout({ children }) {
  const [menuOpen, setMenuOpen] = useState(false)
  const Icon = ({ name }) => {
    const cls = "w-4 h-4"
    if (name === 'facturas') return (<svg className={cls} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M8 6h8M8 10h8M8 14h5"/><path d="M6 2h12a2 2 0 0 1 2 2v18l-4-3-4 3-4-3-4 3V4a2 2 0 0 1 2-2z"/></svg>)
    if (name === 'clientes') return (<svg className={cls} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="8" cy="7" r="4"/><path d="M2 22a6 6 0 0 1 12 0"/><circle cx="17" cy="7" r="3"/><path d="M14 22a5 5 0 0 1 10 0"/></svg>)
    if (name === 'productos') return (<svg className={cls} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 16V8l-9-5-9 5v8l9 5 9-5z"/><path d="M12 3v18"/></svg>)
    if (name === 'listas') return (<svg className={cls} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 6h11M9 12h11M9 18h11"/><path d="M4 6h.01M4 12h.01M4 18h.01"/></svg>)
    if (name === 'cuenta') return (<svg className={cls} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 10l9-7 9 7"/><path d="M5 22h14V12H5z"/></svg>)
    if (name === 'reportes') return (<svg className={cls} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 3v18h18"/><path d="M7 15l4-4 3 3 5-7"/></svg>)
    if (name === 'calculadora') return (<svg className={cls} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="2" width="18" height="20" rx="2"/><path d="M7 6h10M7 10h4M7 14h4M13 14h4M7 18h4M13 18h4"/></svg>)
    if (name === 'compras') return (<svg className={cls} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/><path d="M1 1h4l2 13h13l3-8H6"/></svg>)
    if (name === 'config') return (<svg className={cls} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09a1.65 1.65 0 0 0-1-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09a1.65 1.65 0 0 0 1.51-1 1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33h0A1.65 1.65 0 0 0 9 3.09V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51h0a1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82h0A1.65 1.65 0 0 0 21 11h.09a2 2 0 1 1 0 4H21a1.65 1.65 0 0 0-1.51 1z"/></svg>)
    return null
  }
  return (
    <div className="h-full grid md:grid-cols-[260px_1fr] grid-cols-1">
      <aside className="hidden md:block bg-gray-100 border-r border-gray-200 p-4 print:hidden">
        <h1 className="text-xl font-semibold mb-4">SJ-Facturación</h1>
        <nav className="space-y-2">
          <NavLink to="/facturas" className={({ isActive }) => `block px-3 py-2 rounded ${isActive ? 'bg-blue-600 text-white' : 'hover:bg-gray-200'}`}><span className="inline-flex items-center gap-2"><Icon name="facturas"/>Facturas</span></NavLink>
          <NavLink to="/clientes" className={({ isActive }) => `block px-3 py-2 rounded ${isActive ? 'bg-blue-600 text-white' : 'hover:bg-gray-200'}`}><span className="inline-flex items-center gap-2"><Icon name="clientes"/>Clientes</span></NavLink>
          <NavLink to="/productos" className={({ isActive }) => `block px-3 py-2 rounded ${isActive ? 'bg-blue-600 text-white' : 'hover:bg-gray-200'}`}><span className="inline-flex items-center gap-2"><Icon name="productos"/>Productos</span></NavLink>
          <NavLink to="/listas" className={({ isActive }) => `block px-3 py-2 rounded ${isActive ? 'bg-blue-600 text-white' : 'hover:bg-gray-200'}`}><span className="inline-flex items-center gap-2"><Icon name="listas"/>Listas de precios</span></NavLink>
          <NavLink to="/cuenta" className={({ isActive }) => `block px-3 py-2 rounded ${isActive ? 'bg-blue-600 text-white' : 'hover:bg-gray-200'}`}><span className="inline-flex items-center gap-2"><Icon name="cuenta"/>Cuenta corriente</span></NavLink>
          <NavLink to="/reportes" className={({ isActive }) => `block px-3 py-2 rounded ${isActive ? 'bg-blue-600 text-white' : 'hover:bg-gray-200'}`}><span className="inline-flex items-center gap-2"><Icon name="reportes"/>Reportes</span></NavLink>
          <NavLink to="/calculadora" className={({ isActive }) => `block px-3 py-2 rounded ${isActive ? 'bg-blue-600 text-white' : 'hover:bg-gray-200'}`}><span className="inline-flex items-center gap-2"><Icon name="calculadora"/>Calculadora de precios</span></NavLink>
          <NavLink to="/compras" className={({ isActive }) => `block px-3 py-2 rounded ${isActive ? 'bg-blue-600 text-white' : 'hover:bg-gray-200'}`}><span className="inline-flex items-center gap-2"><Icon name="compras"/>Compras</span></NavLink>
          <NavLink to="/config" className={({ isActive }) => `block px-3 py-2 rounded ${isActive ? 'bg-blue-600 text-white' : 'hover:bg-gray-200'}`}><span className="inline-flex items-center gap-2"><Icon name="config"/>Configuración</span></NavLink>
        </nav>
      </aside>
      {menuOpen && (
        <div className="fixed inset-0 z-50 bg-black/40 md:hidden" onClick={() => setMenuOpen(false)}>
          <div className="absolute left-0 top-0 h-full w-64 bg-gray-100 border-r border-gray-200 p-4" onClick={e => e.stopPropagation()}>
            <h1 className="text-xl font-semibold mb-4">SJ-Facturación</h1>
            <nav className="space-y-2">
              <NavLink to="/facturas" onClick={() => setMenuOpen(false)} className={({ isActive }) => `block px-3 py-2 rounded ${isActive ? 'bg-blue-600 text-white' : 'hover:bg-gray-200'}`}><span className="inline-flex items-center gap-2"><Icon name="facturas"/>Facturas</span></NavLink>
              <NavLink to="/clientes" onClick={() => setMenuOpen(false)} className={({ isActive }) => `block px-3 py-2 rounded ${isActive ? 'bg-blue-600 text-white' : 'hover:bg-gray-200'}`}><span className="inline-flex items-center gap-2"><Icon name="clientes"/>Clientes</span></NavLink>
              <NavLink to="/productos" onClick={() => setMenuOpen(false)} className={({ isActive }) => `block px-3 py-2 rounded ${isActive ? 'bg-blue-600 text-white' : 'hover:bg-gray-200'}`}><span className="inline-flex items-center gap-2"><Icon name="productos"/>Productos</span></NavLink>
              <NavLink to="/listas" onClick={() => setMenuOpen(false)} className={({ isActive }) => `block px-3 py-2 rounded ${isActive ? 'bg-blue-600 text-white' : 'hover:bg-gray-200'}`}><span className="inline-flex items-center gap-2"><Icon name="listas"/>Listas de precios</span></NavLink>
              <NavLink to="/cuenta" onClick={() => setMenuOpen(false)} className={({ isActive }) => `block px-3 py-2 rounded ${isActive ? 'bg-blue-600 text-white' : 'hover:bg-gray-200'}`}><span className="inline-flex items-center gap-2"><Icon name="cuenta"/>Cuenta corriente</span></NavLink>
              <NavLink to="/reportes" onClick={() => setMenuOpen(false)} className={({ isActive }) => `block px-3 py-2 rounded ${isActive ? 'bg-blue-600 text-white' : 'hover:bg-gray-200'}`}><span className="inline-flex items-center gap-2"><Icon name="reportes"/>Reportes</span></NavLink>
              <NavLink to="/calculadora" onClick={() => setMenuOpen(false)} className={({ isActive }) => `block px-3 py-2 rounded ${isActive ? 'bg-blue-600 text-white' : 'hover:bg-gray-200'}`}><span className="inline-flex items-center gap-2"><Icon name="calculadora"/>Calculadora de precios</span></NavLink>
              <NavLink to="/compras" onClick={() => setMenuOpen(false)} className={({ isActive }) => `block px-3 py-2 rounded ${isActive ? 'bg-blue-600 text-white' : 'hover:bg-gray-200'}`}><span className="inline-flex items-center gap-2"><Icon name="compras"/>Compras</span></NavLink>
              <NavLink to="/config" onClick={() => setMenuOpen(false)} className={({ isActive }) => `block px-3 py-2 rounded ${isActive ? 'bg-blue-600 text-white' : 'hover:bg-gray-200'}`}><span className="inline-flex items-center gap-2"><Icon name="config"/>Configuración</span></NavLink>
            </nav>
          </div>
        </div>
      )}
      <main className="p-4 md:p-6 overflow-y-auto bg-white">
        <div className="flex items-center justify-between mb-3 mt-1 print:hidden md:hidden">
          <button className="px-3 py-2 rounded-md border" onClick={() => setMenuOpen(true)}>Menú</button>
          <div className="flex items-center gap-2"><AuthStatus /><SyncStatus /></div>
        </div>
        <ConfigNotice />
        <div className="hidden md:flex justify-between mb-4 mt-2 print:hidden">
          <AuthStatus />
          <SyncStatus />
        </div>
        {children}
      </main>
    </div>
  )
}

export default function App() {
  return (
    <ToastProvider>
      <AppLayout>
        <Routes>
          <Route path="/" element={<Invoices />} />
          <Route path="/facturas" element={<Invoices />} />
          <Route path="/clientes" element={<Customers />} />
          <Route path="/productos" element={<Products />} />
          <Route path="/listas" element={<PriceLists />} />
          <Route path="/cuenta" element={<Ledger />} />
          <Route path="/cuenta/reporte" element={<LedgerReport />} />
          <Route path="/facturas/reporte" element={<InvoiceReport />} />
          <Route path="/reportes" element={<Reports />} />
          <Route path="/calculadora" element={<PriceCalculator />} />
          <Route path="/compras" element={<Purchases />} />
          <Route path="/config" element={<Settings />} />
        </Routes>
      </AppLayout>
    </ToastProvider>
  )
}
