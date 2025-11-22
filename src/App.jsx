import { Routes, Route, NavLink } from 'react-router-dom'
import Customers from './pages/Customers.jsx'
import Products from './pages/Products.jsx'
import Invoices from './pages/Invoices.jsx'
import InvoiceReport from './pages/InvoiceReport.jsx'
import PriceLists from './pages/PriceLists.jsx'
import Ledger from './pages/Ledger.jsx'
import LedgerReport from './pages/LedgerReport.jsx'
import Reports from './pages/Reports.jsx'
import PriceCalculator from './pages/PriceCalculator.jsx'
import Purchases from './pages/Purchases.tsx'
import SyncStatus from './components/SyncStatus.jsx'
import AuthStatus from './components/AuthStatus.jsx'
import ConfigNotice from './components/ConfigNotice.jsx'
import { ToastProvider } from './components/Toast.jsx'

function AppLayout({ children }) {
  return (
    <div className="h-full grid grid-cols-[260px_1fr]">
      <aside className="bg-gray-100 border-r border-gray-200 p-4 print:hidden">
        <h1 className="text-xl font-semibold mb-4">SJ-Facturación</h1>
        <nav className="space-y-2">
          <NavLink to="/facturas" className={({ isActive }) => `block px-3 py-2 rounded ${isActive ? 'bg-blue-600 text-white' : 'hover:bg-gray-200'}`}>Facturas</NavLink>
          <NavLink to="/clientes" className={({ isActive }) => `block px-3 py-2 rounded ${isActive ? 'bg-blue-600 text-white' : 'hover:bg-gray-200'}`}>Clientes</NavLink>
          <NavLink to="/productos" className={({ isActive }) => `block px-3 py-2 rounded ${isActive ? 'bg-blue-600 text-white' : 'hover:bg-gray-200'}`}>Productos</NavLink>
          <NavLink to="/listas" className={({ isActive }) => `block px-3 py-2 rounded ${isActive ? 'bg-blue-600 text-white' : 'hover:bg-gray-200'}`}>Listas de precios</NavLink>
          <NavLink to="/cuenta" className={({ isActive }) => `block px-3 py-2 rounded ${isActive ? 'bg-blue-600 text-white' : 'hover:bg-gray-200'}`}>Cuenta corriente</NavLink>
          <NavLink to="/reportes" className={({ isActive }) => `block px-3 py-2 rounded ${isActive ? 'bg-blue-600 text-white' : 'hover:bg-gray-200'}`}>Reportes</NavLink>
          <NavLink to="/calculadora" className={({ isActive }) => `block px-3 py-2 rounded ${isActive ? 'bg-blue-600 text-white' : 'hover:bg-gray-200'}`}>Calculadora de precios</NavLink>
          <NavLink to="/compras" className={({ isActive }) => `block px-3 py-2 rounded ${isActive ? 'bg-blue-600 text-white' : 'hover:bg-gray-200'}`}>Compras</NavLink>
        </nav>
      </aside>
      <main className="p-6 overflow-y-auto bg-white">
        <ConfigNotice />
        <div className="flex justify-between mb-4 mt-2 print:hidden">
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
        </Routes>
      </AppLayout>
    </ToastProvider>
  )
}
