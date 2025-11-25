import { useEffect, useMemo, useRef, useState } from 'react'
import './App.css'

type Product = {
  id: number;
  sku: string;
  name: string;
  price: number;
  stock: number;
}

type CartItem = {
  id: number;
  name: string;
  price: number;
  qty: number;
}

function Icon({ name, className }: { name: string; className?: string }) {
  const common = {
    xmlns: 'http://www.w3.org/2000/svg',
    width: 18,
    height: 18,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 2,
    strokeLinecap: 'round',
    strokeLinejoin: 'round',
  } as any;
  switch (name) {
    case 'search':
      return (
        <svg {...common} className={className}>
          <circle cx="11" cy="11" r="7" />
          <line x1="21" y1="21" x2="16.65" y2="16.65" />
        </svg>
      );
    case 'printer':
      return (
        <svg {...common} className={className}>
          <rect x="6" y="8" width="12" height="8" rx="2" />
          <rect x="8" y="4" width="8" height="4" rx="1" />
          <line x1="8" y1="12" x2="16" y2="12" />
        </svg>
      );
    case 'cart':
      return (
        <svg {...common} className={className}>
          <path d="M6 6h13l-2 8H8z" />
          <circle cx="9" cy="18" r="1.5" />
          <circle cx="17" cy="18" r="1.5" />
        </svg>
      );
    case 'bag':
      return (
        <svg {...common} className={className}>
          <path d="M6 8h12v10H6z" />
          <path d="M9 8c0-2 1.5-3 3-3s3 1 3 3" />
        </svg>
      );
    case 'user':
      return (
        <svg {...common} className={className}>
          <circle cx="12" cy="8" r="4" />
          <path d="M4 20c2-4 12-4 16 0" />
        </svg>
      );
    case 'tag':
      return (
        <svg {...common} className={className}>
          <path d="M3 12l9-9h6l3 3v6l-9 9z" />
          <circle cx="17" cy="7" r="1.5" />
        </svg>
      );
    case 'box':
      return (
        <svg {...common} className={className}>
          <rect x="4" y="8" width="16" height="12" rx="2" />
          <path d="M4 12h16" />
          <path d="M12 8V4" />
        </svg>
      );
    case 'chart':
      return (
        <svg {...common} className={className}>
          <path d="M4 20h16" />
          <rect x="6" y="12" width="3" height="6" />
          <rect x="11" y="10" width="3" height="8" />
          <rect x="16" y="8" width="3" height="10" />
        </svg>
      );
    case 'cash':
      return (
        <svg {...common} className={className}>
          <rect x="4" y="6" width="16" height="12" rx="2" />
          <circle cx="12" cy="12" r="3" />
        </svg>
      );
    case 'card':
      return (
        <svg {...common} className={className}>
          <rect x="4" y="6" width="16" height="12" rx="2" />
          <rect x="4" y="9" width="16" height="3" />
        </svg>
      );
    case 'qr':
      return (
        <svg {...common} className={className}>
          <rect x="4" y="4" width="6" height="6" />
          <rect x="14" y="4" width="6" height="6" />
          <rect x="4" y="14" width="6" height="6" />
          <rect x="14" y="14" width="6" height="6" />
        </svg>
      );
    default:
      return (
        <svg {...common} className={className}>
          <circle cx="12" cy="12" r="8" />
        </svg>
      );
  }
}

function App() {
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [query, setQuery] = useState('')
  const [cart, setCart] = useState<CartItem[]>([])
  const [token, setToken] = useState<string | null>(() => localStorage.getItem('token'))
  const [user, setUser] = useState<{ id: number; username: string; role: string } | null>(() => {
    const raw = localStorage.getItem('user')
    return raw ? JSON.parse(raw) : null
  })
  const [currentShift, setCurrentShift] = useState<any>(null)
  const [openingAmount, setOpeningAmount] = useState<string>('')
  const [closingAmount, setClosingAmount] = useState<string>('')
  const [showSearch, setShowSearch] = useState(false)
  const [searchSelected, setSearchSelected] = useState<number>(0)
  const [quickCode, setQuickCode] = useState('')
  const [quickQty, setQuickQty] = useState('1')
  const quickCodeRef = useRef<HTMLInputElement|null>(null)
  const quickQtyRef = useRef<HTMLInputElement|null>(null)
  const [lastQuickCode, setLastQuickCode] = useState<string|null>(null)

  useEffect(() => {
    const fetchProducts = async () => {
      setLoading(true)
      setError(null)
      try {
        const res = await fetch('/api/products')
        const data = await res.json()
        setProducts(data)
      } catch (e: any) {
        setError('No se pudieron cargar los productos')
      } finally {
        setLoading(false)
      }
    }
    fetchProducts()
  }, [token])

  // Atajo de teclado: abrir búsqueda con tecla A (si no se escribe en un input)
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const key = e.key.toLowerCase()
      const target = e.target as HTMLElement
      const isTyping = target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)
      if (!isTyping && key === 'a') setShowSearch(true)
      if (key === 'escape') setShowSearch(false)
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])

  // Resetear selección al abrir búsqueda o cambiar la consulta
  useEffect(() => {
    if (showSearch) setSearchSelected(0)
  }, [query, showSearch])

  // Autofoco en el campo de código para escaneo directo
  useEffect(() => {
    quickCodeRef.current?.focus()
  }, [])

  // Cargar turno actual cuando hay autenticación
  useEffect(() => {
    const fetchShift = async () => {
      if (!token) { setCurrentShift(null); return }
      try {
        const res = await fetch('/api/shifts/current', { headers: { Authorization: `Bearer ${token}` } })
        const data = await res.json()
        setCurrentShift(data)
      } catch {}
    }
    fetchShift()
  }, [token])

  const login = async (username: string, password: string) => {
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password })
    })
    if (!res.ok) throw new Error('Credenciales inválidas')
    const data = await res.json()
    setToken(data.token)
    setUser(data.user)
    localStorage.setItem('token', data.token)
    localStorage.setItem('user', JSON.stringify(data.user))
  }

  const logout = () => {
    setToken(null)
    setUser(null)
    setCurrentShift(null)
    localStorage.removeItem('token')
    localStorage.removeItem('user')
  }

  const openShift = async () => {
    if (!token) return alert('Requiere login')
    const opening_amount = parseFloat(openingAmount || '0')
    if (!isFinite(opening_amount)) return alert('Importe de apertura inválido')
    const res = await fetch('/api/shifts/open', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ opening_amount })
    })
    if (!res.ok) {
      const err = await res.json();
      return alert('No se pudo abrir turno: ' + (err.error || res.status))
    }
    alert('Turno abierto')
    setOpeningAmount('')
    const cur = await fetch('/api/shifts/current', { headers: { Authorization: `Bearer ${token}` } })
    setCurrentShift(await cur.json())
  }

  const closeShift = async () => {
    if (!token) return alert('Requiere login')
    const closing_amount = parseFloat(closingAmount || '0')
    if (!isFinite(closing_amount)) return alert('Importe de cierre inválido')
    const res = await fetch('/api/shifts/close', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ closing_amount })
    })
    if (!res.ok) {
      const err = await res.json();
      return alert('No se pudo cerrar turno: ' + (err.error || res.status))
    }
    alert('Turno cerrado')
    setClosingAmount('')
    const cur = await fetch('/api/shifts/current', { headers: { Authorization: `Bearer ${token}` } })
    setCurrentShift(await cur.json())
  }

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return products
    return products.filter(
      (p) => p.name.toLowerCase().includes(q) || p.sku.toLowerCase().includes(q)
    )
  }, [products, query])

  const addToCart = (p: Product) => {
    setCart((curr) => {
      const idx = curr.findIndex((c) => c.id === p.id)
      if (idx >= 0) {
        const next = [...curr]
        next[idx] = { ...next[idx], qty: next[idx].qty + 1 }
        return next
      }
      return [...curr, { id: p.id, name: p.name, price: p.price, qty: 1 }]
    })
  }

  const addToCartQty = (p: Product, qty: number) => {
    const q = Math.max(1, Math.floor(qty || 1))
    setCart((curr) => {
      const idx = curr.findIndex((c) => c.id === p.id)
      if (idx >= 0) {
        const next = [...curr]
        next[idx] = { ...next[idx], qty: next[idx].qty + q }
        return next
      }
      return [...curr, { id: p.id, name: p.name, price: p.price, qty: q }]
    })
  }

  const addByCodeAndQty = (focusCode: boolean = true) => {
    const raw = quickCode.trim()
    let code = raw
    let qty = Math.max(1, parseInt(quickQty || '1', 10))
    const starIndex = raw.indexOf('*')
    const plusIndex = raw.indexOf('+')
    const sepIndex = starIndex >= 0 ? starIndex : (plusIndex >= 0 ? plusIndex : -1)
    if (sepIndex >= 0) {
      code = raw.slice(0, sepIndex).trim()
      const qtyStr = raw.slice(sepIndex + 1).trim()
      const qParsed = parseInt(qtyStr, 10)
      if (!isNaN(qParsed) && qParsed > 0) qty = qParsed
    }
    const p = products.find(pr => pr.sku.toLowerCase() === code.toLowerCase() || String(pr.id) === code)
    if (!p) { alert('Código no encontrado'); return }
    addToCartQty(p, qty)
    setLastQuickCode(code)
    setQuickCode('')
    setQuickQty('1')
    if (focusCode) quickCodeRef.current?.focus()
  }

  const incQty = (id: number) => {
    setCart((curr) => curr.map((c) => (c.id === id ? { ...c, qty: c.qty + 1 } : c)))
  }

  const decQty = (id: number) => {
    setCart((curr) =>
      curr
        .map((c) => (c.id === id ? { ...c, qty: Math.max(0, c.qty - 1) } : c))
        .filter((c) => c.qty > 0)
    )
  }

  const removeItem = (id: number) => {
    setCart((curr) => curr.filter((c) => c.id !== id))
  }

  const subtotal = useMemo(() => cart.reduce((sum, c) => sum + c.price * c.qty, 0), [cart])

  const clearCart = () => setCart([])

  const [showPayment, setShowPayment] = useState(false)
  const [paymentMethod, setPaymentMethod] = useState<'cash'|'transfer_qr'|'card'|'account'|null>(null)
  const [paymentRef, setPaymentRef] = useState('')
  const [paymentAmountStr, setPaymentAmountStr] = useState('')
  type PaymentLine = { method: 'cash'|'transfer_qr'|'card'|'account', amount: number, ref?: string }
  const [payments, setPayments] = useState<PaymentLine[]>([])
  const cartTotal = cart.reduce((s, i) => s + i.price * i.qty, 0)
  const paidSoFar = payments.reduce((s,p)=> s + p.amount, 0)
  const remaining = Math.max(0, Number((cartTotal - paidSoFar).toFixed(2)))
  const [activeSection, setActiveSection] = useState<'ventas'|'consultar'|'cuentas'|'etiquetas'|'inventario'|'informe'|'compras'>('ventas')
  const sectionLabel = (s: typeof activeSection) => (
    s==='ventas' ? 'Ventas' :
    s==='consultar' ? 'Consultar ventas' :
    s==='cuentas' ? 'Cuentas corrientes' :
    s==='etiquetas' ? 'Impresión de etiquetas' :
    s==='inventario' ? 'Inventario' :
    s==='informe' ? 'Informe de ventas' :
    'Compras'
  )

  const startCheckout = () => {
    if (!user || !token) return alert('Requiere login')
    if (cart.length === 0) return
    // preseleccionar monto restante
    setPaymentAmountStr(remaining.toFixed(2))
    setShowPayment(true)
  }

  const addPayment = () => {
    if (!paymentMethod) { alert('Seleccioná un medio de pago'); return }
    let amount = parseFloat(paymentAmountStr.replace(',', '.'))
    if (isNaN(amount) || amount <= 0) { alert('Monto inválido'); return }
    if (amount > remaining + 0.01) { alert('El monto supera el restante'); return }
    const line: PaymentLine = { method: paymentMethod, amount: Number(amount.toFixed(2)), ref: paymentRef || undefined }
    setPayments(prev => [...prev, line])
    setPaymentRef('')
    // mantener método seleccionado, actualizar monto sugerido
    const newRemaining = Math.max(0, Number((remaining - line.amount).toFixed(2)))
    setPaymentAmountStr(newRemaining > 0 ? newRemaining.toFixed(2) : '')
  }

  useEffect(() => {
    if (!showPayment) return
    const onKey = (e: KeyboardEvent) => {
      if (e.code === 'NumpadAdd' || e.key === '+') {
        e.preventDefault();
        addPayment();
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [showPayment, paymentMethod, paymentAmountStr, paymentRef, remaining])

  const checkout = async () => {
    if (!user || !token) return alert('Requiere login')
    if (cart.length === 0) return
    if (payments.length > 0) {
      const diff = Math.abs(remaining)
      if (diff > 0.01) { alert('Los pagos no igualan el total'); return }
    } else {
      if (!paymentMethod) return alert('Seleccioná un medio de pago')
    }
    // backend espera items con {id, qty, price}
    const items = cart.map((c) => ({ id: c.id, qty: c.qty, price: c.price }))
    const res = await fetch('/api/sales', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify(
        payments.length > 0
          ? { items, payments: payments.map(p => ({ method: p.method, amount: p.amount, ref: p.ref })) }
          : { items, payment_method: paymentMethod, payment_ref: paymentRef || undefined }
      )
    })
    if (!res.ok) {
      try {
        const err = await res.json();
        alert('No se pudo cobrar: ' + (err.error || res.status))
      } catch {
        alert('No se pudo cobrar')
      }
      return
    }
    const data = await res.json()
    alert('Venta registrada. N° ' + data.id)
    clearCart()
    setShowPayment(false)
    setPaymentMethod(null)
    setPaymentRef('')
    setPaymentAmountStr('')
    setPayments([])
    // refrescar productos para ver nuevo stock
    try {
      const pr = await fetch('/api/products')
      setProducts(await pr.json())
    } catch {}
  }

  return (
    <div className="container">
      <header className="header">
        <h1>SJPOS - Caja</h1>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          {user ? (
            <>
              <span>{user.username} ({user.role})</span>
              {currentShift ? (
                <>
                  <span>Turno abierto</span>
                  <input
                    type="number"
                    placeholder="Monto cierre"
                    step="0.01"
                    value={closingAmount}
                    onChange={(e) => setClosingAmount(e.target.value)}
                    style={{ width: 140, padding: 8, borderRadius: 8, border: '1px solid var(--color-border)' }}
                  />
                  <button className="secondary" onClick={closeShift}>Cerrar turno</button>
                </>
              ) : (
                <>
                  <input
                    type="number"
                    placeholder="Monto apertura"
                    step="0.01"
                    value={openingAmount}
                    onChange={(e) => setOpeningAmount(e.target.value)}
                    style={{ width: 140, padding: 8, borderRadius: 8, border: '1px solid var(--color-border)' }}
                  />
                  <button className="secondary" onClick={openShift}>Abrir turno</button>
                </>
              )}
              <button className="secondary" onClick={logout}>Salir</button>
            </>
          ) : (
            <LoginForm onLogin={login} />
          )}
          <button className="secondary" onClick={async () => {
            try {
              const res = await fetch('/api/print/test', { method: 'POST' })
              if (!res.ok) throw new Error('Fallo la impresión')
              alert('Impresión de prueba enviada')
            } catch (e: any) {
              alert('No se pudo imprimir: ' + e.message)
            }
          }}><Icon name="printer" className="icon" />Prueba impresora</button>
        </div>
      </header>
      <div className="layout">
        <aside className="sidebar">
          <div className="sidebar-group">
            <div className="sidebar-title">VENTAS</div>
            <button className={activeSection==='ventas'?'sidebar-item active':'sidebar-item'} onClick={()=>setActiveSection('ventas')}><Icon name="cart" className="icon" />Ventas</button>
            <button className={activeSection==='consultar'?'sidebar-item active':'sidebar-item'} onClick={()=>setActiveSection('consultar')}><Icon name="search" className="icon" />Consultar ventas</button>
            <button className={activeSection==='cuentas'?'sidebar-item active':'sidebar-item'} onClick={()=>setActiveSection('cuentas')}><Icon name="user" className="icon" />Cuentas corrientes</button>
            <button className={activeSection==='etiquetas'?'sidebar-item active':'sidebar-item'} onClick={()=>setActiveSection('etiquetas')}><Icon name="tag" className="icon" />Impresión de etiquetas</button>
          </div>
          <div className="sidebar-group">
            <div className="sidebar-title">INVENTARIO</div>
            <button className={activeSection==='inventario'?'sidebar-item active':'sidebar-item'} onClick={()=>setActiveSection('inventario')}><Icon name="box" className="icon" />Inventario</button>
            <button className={activeSection==='informe'?'sidebar-item active':'sidebar-item'} onClick={()=>setActiveSection('informe')}><Icon name="chart" className="icon" />Informe de ventas</button>
            <button className={activeSection==='compras'?'sidebar-item active':'sidebar-item'} onClick={()=>setActiveSection('compras')}><Icon name="bag" className="icon" />Compras</button>
          </div>
        </aside>
        {activeSection==='ventas' ? (
        <main className="main">
          <section className="right">
            <h2><Icon name="cart" className="icon" /> Carrito</h2>
            <div className="quick-add">
              <input
                ref={quickCodeRef}
                className="code"
                type="text"
                placeholder="Código / SKU"
                value={quickCode}
                onChange={(e)=>setQuickCode(e.target.value)}
                onKeyDown={(e)=>{
                  if (e.code === 'NumpadMultiply' || e.key === '*') {
                    e.preventDefault()
                    quickQtyRef.current?.focus()
                    setTimeout(()=> quickQtyRef.current?.select && quickQtyRef.current.select(), 0)
                  } else if (e.code === 'NumpadAdd' || e.key === '+') {
                    e.preventDefault()
                    quickQtyRef.current?.focus()
                    setTimeout(()=> quickQtyRef.current?.select && quickQtyRef.current.select(), 0)
                  } else if (e.key === 'Enter') {
                    addByCodeAndQty(true)
                  }
                }}
              />
              <input
                ref={quickQtyRef}
                className="qty"
                type="number"
                min={1}
                step={1}
                placeholder="Cant."
                value={quickQty}
                onChange={(e)=>setQuickQty(e.target.value)}
                onKeyDown={(e)=>{
                  if (e.key === 'ArrowUp') {
                    e.preventDefault()
                    const curr = Math.max(1, parseInt((quickQty || '1'), 10))
                    setQuickQty(String(curr + 1))
                  } else if (e.key === 'ArrowDown') {
                    e.preventDefault()
                    const curr = Math.max(1, parseInt((quickQty || '1'), 10))
                    setQuickQty(String(Math.max(1, curr - 1)))
                  } else if (e.key === 'Enter') {
                    const val = (quickQty || '').trim()
                    if (val.startsWith('+')) {
                      const inc = parseInt(val.slice(1), 10)
                      if (!lastQuickCode || isNaN(inc) || inc <= 0) { addByCodeAndQty(false); return }
                      const p = products.find(pr => pr.sku.toLowerCase() === lastQuickCode!.toLowerCase() || String(pr.id) === lastQuickCode)
                      if (!p) { addByCodeAndQty(false); return }
                      addToCartQty(p, inc)
                      setQuickQty('1')
                      // mantener el foco en cantidad
                    } else {
                      addByCodeAndQty(false)
                    }
                  }
                }}
              />
              <button className="primary" onClick={() => addByCodeAndQty()}>Agregar</button>
            </div>
            <table className="cart-table">
              <thead>
                <tr>
                  <th>Producto</th>
                  <th>Precio</th>
                  <th>Cant.</th>
                  <th>Total</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {cart.map((c) => (
                  <tr key={c.id}>
                    <td>{c.name}</td>
                    <td>${c.price.toFixed(2)}</td>
                    <td className="qty">
                      <button onClick={() => decQty(c.id)}>-</button>
                      <span>{c.qty}</span>
                      <button onClick={() => incQty(c.id)}>+</button>
                    </td>
                    <td>${(c.price * c.qty).toFixed(2)}</td>
                    <td>
                      <button className="remove" onClick={() => removeItem(c.id)}>x</button>
                    </td>
                  </tr>
                ))}
                {cart.length === 0 && (
                  <tr>
                    <td colSpan={5} style={{ textAlign: 'center' }}>Carrito vacío</td>
                  </tr>
                )}
              </tbody>
            </table>

            <div className="totals">
              <div>
                <span>Subtotal</span>
                <strong>${subtotal.toFixed(2)}</strong>
              </div>
            </div>
            <div className="actions">
              <button className="secondary" onClick={clearCart}>Vaciar</button>
              <button className="primary" disabled={cart.length === 0} onClick={startCheckout}>Cobrar</button>
            </div>
          </section>

          {showSearch && (
            <div className="modal-overlay" onClick={()=>setShowSearch(false)}>
              <div className="modal search-modal" onClick={(e)=>e.stopPropagation()}>
                <h3>Buscar productos (A abre, Esc cierra)</h3>
                <div className="search">
                  <span className="search-icon"><Icon name="search" /></span>
                  <input
                    type="text"
                    placeholder="Buscar por nombre o SKU..."
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    autoFocus
                    onKeyDown={(e)=>{
                      if (e.key === 'ArrowDown') {
                        e.preventDefault()
                        setSearchSelected(prev => Math.min(prev + 1, filtered.length - 1))
                      } else if (e.key === 'ArrowUp') {
                        e.preventDefault()
                        setSearchSelected(prev => Math.max(prev - 1, 0))
                      } else if (e.key === 'Enter') {
                        if (filtered.length > 0) {
                          const item = filtered[Math.max(0, Math.min(searchSelected, filtered.length - 1))]
                          addToCart(item)
                          setShowSearch(false)
                          setQuery('')
                          setSearchSelected(0)
                          quickCodeRef.current?.focus()
                        }
                      }
                    }}
                  />
                </div>
                <div style={{ color:'var(--color-muted)', fontSize:12, marginTop:6 }}>
                  Enter agrega el seleccionado; Shift+Enter agrega y cierra. Usa flechas ↑↓.
                </div>
                {loading && <p>Cargando productos...</p>}
                {error && <p className="error">{error}</p>}
                {!loading && !error && (
                  <ul className="product-list">
                    {filtered.map((p, idx) => (
                      <li
                        key={p.id}
                        className={idx === searchSelected ? "product selected" : "product"}
                        onMouseEnter={() => setSearchSelected(idx)}
                        onClick={() => { addToCart(p); setShowSearch(false); quickCodeRef.current?.focus() }}
                      >
                        <div>
                          <strong>{p.name}</strong>
                          <span className="sku">SKU: {p.sku}</span>
                        </div>
                        <div className="price">${p.price.toFixed(2)}</div>
                        <button className="add" onClick={() => { addToCart(p); setShowSearch(false); quickCodeRef.current?.focus() }}>Agregar</button>
                      </li>
                    ))}
                    {filtered.length === 0 && <li style={{ padding: 12, color: 'var(--color-muted)' }}>No hay productos coincidentes</li>}
                  </ul>
                )}
                <div className="modal-actions">
                  <button className="secondary" onClick={()=>setShowSearch(false)}>Cerrar</button>
                </div>
              </div>
            </div>
          )}
          {showPayment && (
            <div className="modal-overlay">
                <div className="modal">
                  <h3>Medio de cobro</h3>
                  <div className="modal-summary">
                    <div className="summary-row muted">
                      <span>Subtotal</span>
                      <strong>$ {subtotal.toFixed(2)}</strong>
                    </div>
                    <div className="summary-row accent">
                      <span>Total</span>
                      <strong>$ {cartTotal.toFixed(2)}</strong>
                    </div>
                    <div className="summary-row accent">
                      <span>Restante</span>
                      <strong>$ {remaining.toFixed(2)}</strong>
                    </div>
                  </div>
                  <div className="pay-grid">
                  <button className={paymentMethod==='cash'?'primary':'secondary'} onClick={()=>setPaymentMethod('cash')}><Icon name="cash" className="icon" />Efectivo</button>
                  <button className={paymentMethod==='transfer_qr'?'primary':'secondary'} onClick={()=>setPaymentMethod('transfer_qr')}><Icon name="qr" className="icon" />Transferencia/QR</button>
                  <button className={paymentMethod==='card'?'primary':'secondary'} onClick={()=>setPaymentMethod('card')}><Icon name="card" className="icon" />Tarjetas</button>
                  <button className={paymentMethod==='account'?'primary':'secondary'} onClick={()=>setPaymentMethod('account')}><Icon name="user" className="icon" />Cuenta Corriente</button>
                  </div>
                <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8, marginTop:12 }}>
                  <input
                    placeholder={'Monto'}
                    inputMode="decimal"
                    value={paymentAmountStr}
                    onChange={(e)=>setPaymentAmountStr(e.target.value)}
                    style={{ width:'100%', padding:10, border:'1px solid var(--color-border)', borderRadius:8 }}
                  />
                  {(paymentMethod==='transfer_qr' || paymentMethod==='card' || paymentMethod==='account') && (
                    <input
                      placeholder={paymentMethod==='account' ? 'Cliente / Ref.' : 'Referencia / Autorización'}
                      value={paymentRef}
                      onChange={(e)=>setPaymentRef(e.target.value)}
                      style={{ width:'100%', padding:10, border:'1px solid var(--color-border)', borderRadius:8 }}
                    />
                  )}
                </div>
                <div className="modal-actions">
                  <div style={{ flex:1, alignSelf:'center', color:'var(--color-text-muted)' }}>
                    Restante: $ {remaining.toFixed(2)}
                  </div>
                  <button className="secondary" onClick={()=>{setShowPayment(false); setPaymentMethod(null); setPaymentRef(''); setPaymentAmountStr(''); setPayments([])}}>Cancelar</button>
                  <button className="primary" onClick={addPayment}>Agregar pago (+)</button>
                </div>
                {payments.length > 0 && (
                  <div className="pay-list">
                    {payments.map((p,idx)=> (
                      <div className="pay-item" key={idx}>
                        <span>{p.method==='cash'?'Efectivo':p.method==='transfer_qr'?'Transferencia/QR':p.method==='card'?'Tarjeta':'Cuenta Corriente'}</span>
                        <span>$ {p.amount.toFixed(2)}</span>
                        {p.ref && <span className="pay-ref">{p.ref}</span>}
                        <button className="danger" onClick={()=>{
                          setPayments(prev => prev.filter((_,i)=> i!==idx))
                        }}>Quitar</button>
                      </div>
                    ))}
                  </div>
                )}
                <div className="modal-actions">
                  <button className="secondary" onClick={()=>{setShowPayment(false); setPaymentMethod(null); setPaymentRef('')}}>Cancelar</button>
                  <button className="primary" disabled={remaining>0.01} onClick={checkout}>Confirmar cobro</button>
                </div>
              </div>
            </div>
          )}
        </main>
        ) : (
          <main className="main">
            <section className="left" style={{ gridColumn: '1 / -1' }}>
              <h2>{sectionLabel(activeSection)}</h2>
              <p style={{ color:'var(--color-text-muted)' }}>
                Próximamente: módulo de {sectionLabel(activeSection).toLowerCase()}.
              </p>
            </section>
          </main>
        )}
      </div>
    </div>
  )
}

function LoginForm({ onLogin }: { onLogin: (u: string, p: string) => Promise<void> }) {
  const [u, setU] = useState('')
  const [p, setP] = useState('')
  const [loading, setLoading] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const submit = async (e: any) => {
    e.preventDefault()
    setLoading(true); setErr(null)
    try { await onLogin(u, p) } catch (e: any) { setErr(e.message || 'Error') } finally { setLoading(false) }
  }
  return (
    <form onSubmit={submit} style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
      <input placeholder="Usuario" value={u} onChange={(e) => setU(e.target.value)} />
      <input placeholder="Contraseña" type="password" value={p} onChange={(e) => setP(e.target.value)} />
      <button className="primary" type="submit" disabled={loading}>Entrar</button>
      {err && <span className="error">{err}</span>}
    </form>
  )
}

export default App
