import { useEffect, useMemo, useState } from 'react'
import Card from '../components/Card'
import Button from '../components/Button'
import Input from '../components/Input'
import Select from '../components/Select'
import Badge from '../components/Badge'
import { useToast } from '../components/ToastContext'
import { db } from '../data/db'
import { formatMoney } from '../utils/format'
 

const INITIAL_EXTRAS = [{ name: 'Bolsas', amountText: '0' }, { name: 'Flete', amountText: '0' }]

export default function PriceCalculator() {
  const { show } = useToast()
  const [baseText, setBaseText] = useState('0')
  // Impuestos desglosados
  const [supplierName, setSupplierName] = useState('')
  const [productName, setProductName] = useState('')
  const [ivaPct, setIvaPct] = useState(21)
  const [iibbEnabled, setIibbEnabled] = useState(true)
  const [iibbPct, setIibbPct] = useState(2)
  const [percIvaEnabled, setPercIvaEnabled] = useState(true)
  const [percIvaPct, setPercIvaPct] = useState(3)
  const [extras, setExtras] = useState(INITIAL_EXTRAS)
  // Productos y listas destino para aplicar precios
  const [products, setProducts] = useState([])
  const [priceLists, setPriceLists] = useState([])
  const [selectedListId, setSelectedListId] = useState('')
  const [selectedProductIds, setSelectedProductIds] = useState([])
  const [filterText, setFilterText] = useState('')
  const [priceSourceKey, setPriceSourceKey] = useState('')
  const [roundingMode, setRoundingMode] = useState('none')
  const [taxesOpen, setTaxesOpen] = useState(false)
  

  useEffect(() => {
    (async () => {
      // Configuración de extras
      const cfg = await db.calcConfig.get(1)
      if (cfg && Array.isArray(cfg.extras)) {
        setExtras(cfg.extras.map(e => ({ name: e.name || '', amountText: String(e.amountText ?? e.amount ?? '0') })))
      } else {
        await db.calcConfig.put({ id: 1, extras: INITIAL_EXTRAS })
      }
      // Cargar productos y listas de precios destino
      const prods = await db.products.orderBy('name').toArray()
      setProducts(prods)
      const lists = await db.priceLists.orderBy('name').toArray()
      setPriceLists(lists)
      if (lists.length) {
        const general = lists.find(l => /general/i.test(l.name))
        setSelectedListId(String((general || lists[0]).id))
      }
    })()
  }, [])

  const base = useMemo(() => {
    const num = parseFloat(String(baseText).replace(',', '.'))
    return isNaN(num) ? 0 : num
  }, [baseText])

  const taxPct = useMemo(() => {
    const iva = Number(ivaPct) || 0
    const iibb = iibbEnabled ? (Number(iibbPct) || 0) : 0
    const perc = percIvaEnabled ? (Number(percIvaPct) || 0) : 0
    return iva + iibb + perc
  }, [ivaPct, iibbEnabled, iibbPct, percIvaEnabled, percIvaPct])

  const baseWithTax = useMemo(() => base * (1 + (taxPct / 100)), [base, taxPct])
  const extrasTotal = useMemo(() => {
    return extras.reduce((acc, e) => {
      const num = parseFloat(String(e.amountText).replace(',', '.'))
      return acc + (isNaN(num) ? 0 : num)
    }, 0)
  }, [extras])
  const costBeforeMargin = useMemo(() => baseWithTax + extrasTotal, [baseWithTax, extrasTotal])

  // Fuentes de precio calculado (listas configurables + pesables fijos)
  function applyRounding(price) {
    if (!price || roundingMode === 'none') return price
    if (roundingMode === 'nearest_1') return Math.round(price / 1) * 1
    if (roundingMode === 'nearest_0_5') return Math.round(price / 0.5) * 0.5
    return price
  }
  const pesableDefs = useMemo(() => ([
    { key: 'pes:X CAJA', name: 'X CAJA', pct: 20 },
    { key: 'pes:X PZA', name: 'X PZA', pct: 25 },
    { key: 'pes:X MPZ', name: 'X MPZ', pct: 30 },
    { key: 'pes:X KG', name: 'X KG', pct: 40 },
    { key: 'pes:MAY', name: 'MAY', pct: 15 },
    { key: 'pes:PY', name: 'PY', pct: 10 },
  ]), [])
  const calcSources = useMemo(() => {
    const pesSources = pesableDefs.map(d => {
      const raw = costBeforeMargin * (1 + (d.pct / 100))
      return { key: d.key, label: `${d.name} (+${d.pct}%)`, price: applyRounding(raw) }
    })
    return pesSources
  }, [costBeforeMargin, pesableDefs, roundingMode, applyRounding])
  const selectedSource = useMemo(() => calcSources.find(s => s.key === priceSourceKey) || null, [calcSources, priceSourceKey])

  const filteredProducts = useMemo(() => {
    const q = filterText.trim().toLowerCase()
    if (!q) return products
    return products.filter(p => (
      (p.name || '').toLowerCase().includes(q) ||
      (p.sku || '').toLowerCase().includes(q) ||
      (p.category || '').toLowerCase().includes(q)
    ))
  }, [products, filterText])

  function toggleSelectProduct(id) {
    setSelectedProductIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id])
  }
  function selectAllFiltered() {
    setSelectedProductIds(Array.from(new Set([...selectedProductIds, ...filteredProducts.map(p => p.id)])))
  }
  function clearSelection() {
    setSelectedProductIds([])
  }

  async function applyToSelected() {
    const listIdNum = Number(selectedListId)
    if (!listIdNum) { show('Seleccioná la Lista destino', 'error'); return }
    if (!selectedSource) { show('Seleccioná la fuente de precio calculado', 'error'); return }
    if (selectedProductIds.length === 0) { show('Seleccioná al menos un producto', 'error'); return }
    const targetPrice = selectedSource.price
    // Cargar precios existentes de la lista
    const existing = await db.prices.where('listId').equals(listIdNum).toArray()
    const byPid = {}
    for (const pr of existing) byPid[pr.productId] = pr
    const toUpdate = []
    const toAdd = []
    for (const pid of selectedProductIds) {
      if (byPid[pid]) {
        toUpdate.push({ id: byPid[pid].id, listId: listIdNum, productId: pid, price: targetPrice })
      } else {
        toAdd.push({ listId: listIdNum, productId: pid, price: targetPrice })
      }
    }
    let updated = 0, added = 0
    if (toUpdate.length) { await db.prices.bulkPut(toUpdate); updated = toUpdate.length }
    if (toAdd.length) { await db.prices.bulkAdd(toAdd); added = toAdd.length }
    show(`Precios aplicados. Actualizados: ${updated}, agregados: ${added}`, 'success')
  }

  async function saveConfig() {
    // Persistir solo extras
    await db.calcConfig.put({ id: 1, extras })
    show('Configuración guardada', 'success')
  }

  function addExtra() {
    setExtras(prev => ([...prev, { name: '', amountText: '0' }]))
  }
  function removeExtra(idx) {
    setExtras(prev => prev.filter((_, i) => i !== idx))
  }
  function updateExtra(idx, patch) {
    setExtras(prev => prev.map((it, i) => i === idx ? { ...it, ...patch } : it))
  }

  return (
    <div className="max-w-5xl mx-auto space-y-6 p-4">
      <h2 className="text-2xl font-bold tracking-tight text-slate-800">Calculadora de precios</h2>
      <Card>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 items-end">
          <Input label="Proveedor" value={supplierName} onChange={e => setSupplierName(e.target.value)} placeholder="Ej: LA LECHERITA" />
          <Input label="Producto" value={productName} onChange={e => setProductName(e.target.value)} placeholder="Ej: QUESO CREMOSO" />
        </div>
      </Card>
      <Card>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 items-end">
          <Input label="Costo unitario" type="text" value={baseText} onChange={e => {
            let val = e.target.value
            val = val.replace(/\./g, ',')
            val = val.replace(/[^0-9,]/g, '')
            const parts = val.split(',')
            if (parts.length > 2) {
              val = parts[0] + ',' + parts.slice(1).join('').replace(/,/g, '')
            }
            setBaseText(val)
          }} placeholder="Ej: 100,00" />
          <div className="p-2 border rounded text-sm">
            <div className="flex items-center justify-between mb-1">
              <div className="font-semibold">Impuestos del proveedor</div>
              <button type="button" className="text-xs text-slate-600 hover:text-slate-800 underline" onClick={() => setTaxesOpen(v => !v)}>
                {taxesOpen ? 'Ocultar' : 'Mostrar'}
              </button>
            </div>
            {taxesOpen && (
            <div className="grid grid-cols-3 gap-1">
              <div>
                <label className="block text-xs text-slate-700">IVA</label>
                <select className="w-full border rounded px-2 py-1" value={ivaPct} onChange={e => setIvaPct(Number(e.target.value))}>
                  <option value={0}>0%</option>
                  <option value={10.5}>10,5%</option>
                  <option value={21}>21%</option>
                </select>
              </div>
              <div>
                <label className="block text-xs text-slate-700">IIBB</label>
                <div className="flex items-center gap-1">
                  <input type="checkbox" checked={iibbEnabled} onChange={e => setIibbEnabled(e.target.checked)} />
                  <input className="w-full border rounded px-2 py-1" type="text" value={String(iibbPct)} onChange={e => {
                    let val = e.target.value
                    val = val.replace(/\./g, ',')
                    val = val.replace(/[^0-9,]/g, '')
                    const parts = val.split(',')
                    if (parts.length > 2) { val = parts[0] + ',' + parts.slice(1).join('').replace(/,/g, '') }
                    const num = parseFloat(val.replace(',', '.'))
                    setIibbPct(isNaN(num) ? 0 : num)
                  }} disabled={!iibbEnabled} placeholder="2" />
                  <span className="text-xs text-slate-600">%</span>
                </div>
              </div>
              <div>
                <label className="block text-xs text-slate-700">PERC IVA</label>
                <div className="flex items-center gap-1">
                  <input type="checkbox" checked={percIvaEnabled} onChange={e => setPercIvaEnabled(e.target.checked)} />
                  <input className="w-full border rounded px-2 py-1" type="text" value={String(percIvaPct)} onChange={e => {
                    let val = e.target.value
                    val = val.replace(/\./g, ',')
                    val = val.replace(/[^0-9,]/g, '')
                    const parts = val.split(',')
                    if (parts.length > 2) { val = parts[0] + ',' + parts.slice(1).join('').replace(/,/g, '') }
                    const num = parseFloat(val.replace(',', '.'))
                    setPercIvaPct(isNaN(num) ? 0 : num)
                  }} disabled={!percIvaEnabled} placeholder="3" />
                  <span className="text-xs text-slate-600">%</span>
                </div>
              </div>
            </div>
            )}
            <div className="mt-1 text-xs text-slate-700">Total impuestos: <span className="font-semibold">{taxPct}%</span></div>
          </div>
          <div className="p-2 bg-slate-50 rounded border border-slate-200 text-slate-700">
            <div className="text-xs text-slate-600">Costo con impuestos</div>
            <div className="font-semibold text-sm">{formatMoney(baseWithTax)}</div>
          </div>
          <div className="flex gap-2">
            <Button type="button" variant="success" onClick={saveConfig}>Guardar configuración</Button>
          </div>
        </div>
      </Card>

      <Card>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-lg font-semibold">Costos adicionales (por unidad)</h3>
          <div className="flex items-center gap-2">
            <Badge variant="default">Total extras: {formatMoney(extrasTotal)}</Badge>
            <Button type="button" variant="primary" onClick={addExtra}>Agregar costo</Button>
          </div>
        </div>
        <div className="overflow-auto">
          <table className="min-w-full border border-slate-200 rounded">
            <thead>
              <tr className="bg-slate-50 text-slate-700">
                <th className="text-left px-3 py-2 border border-slate-200">Concepto</th>
                <th className="text-left px-3 py-2 border border-slate-200">Monto</th>
                <th className="text-left px-3 py-2 border border-slate-200">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {extras.length === 0 && (
                <tr>
                  <td colSpan="3" className="px-3 py-3 text-slate-600 text-center"><Badge variant="default">No hay costos adicionales</Badge></td>
                </tr>
              )}
              {extras.map((ex, idx) => (
                <tr key={idx} className="hover:bg-slate-50">
                  <td className="px-3 py-2 border border-slate-200">
                    <Input label="" value={ex.name} onChange={e => updateExtra(idx, { name: e.target.value })} placeholder="Bolsas, Flete, etc." />
                  </td>
                  <td className="px-3 py-2 border border-slate-200">
                    <Input label="" type="text" value={ex.amountText} onChange={e => {
                      let val = e.target.value
                      val = val.replace(/\./g, ',')
                      val = val.replace(/[^0-9,]/g, '')
                      const parts = val.split(',')
                      if (parts.length > 2) {
                        val = parts[0] + ',' + parts.slice(1).join('').replace(/,/g, '')
                      }
                      updateExtra(idx, { amountText: val })
                    }} placeholder="Ej: 50,00" />
                  </td>
                  <td className="px-3 py-2 border border-slate-200">
                    <div className="flex gap-2">
                      <Button type="button" variant="danger" onClick={() => removeExtra(idx)}>Eliminar</Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>


      <Card>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-lg font-semibold">Productos pesables</h3>
          <Badge variant="default">{supplierName || 'Proveedor'} • {productName || 'Producto'}</Badge>
        </div>
        <div className="overflow-auto">
          <table className="min-w-full border border-slate-200 rounded">
            <thead>
              <tr className="bg-slate-50 text-slate-700">
                <th className="text-left px-3 py-2 border border-slate-200">Presentación</th>
                <th className="text-left px-3 py-2 border border-slate-200">+ %</th>
                <th className="text-left px-3 py-2 border border-slate-200">Precio</th>
              </tr>
            </thead>
            <tbody>
              {[
                { name: 'X CAJA', pct: 20 },
                { name: 'X PZA', pct: 25 },
                { name: 'X MPZ', pct: 30 },
                { name: 'X KG', pct: 40 },
                { name: 'MAY', pct: 15 },
                { name: 'PY', pct: 10 },
              ].map((row, idx) => {
                const price = costBeforeMargin * (1 + (row.pct / 100))
                return (
                  <tr key={idx} className="hover:bg-slate-50">
                    <td className="px-3 py-2 border border-slate-200">{row.name}</td>
                    <td className="px-3 py-2 border border-slate-200">{row.pct}%</td>
                    <td className="px-3 py-2 border border-slate-200"><div className="font-semibold">{formatMoney(price)}</div></td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </Card>

      <Card>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-lg font-semibold">Aplicar cálculo a productos</h3>
          <Badge variant="default">Seleccionados: {selectedProductIds.length}</Badge>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3 items-end mb-3">
          <div>
            <label className="block text-sm">Lista destino</label>
            <select className="mt-1 w-full border rounded px-3 py-2" value={selectedListId} onChange={e => setSelectedListId(e.target.value)}>
              <option value="">-- Seleccioná lista --</option>
              {priceLists.map(l => <option key={l.id} value={String(l.id)}>{l.name} ({l.currency})</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm">Usar precio calculado de</label>
            <Select value={priceSourceKey} onChange={e => setPriceSourceKey(e.target.value)}>
              <option value="">-- Seleccioná fuente --</option>
              {calcSources.map(s => (
                <option key={s.key} value={s.key}>{s.label} → {formatMoney(s.price)}</option>
              ))}
            </Select>
          </div>
          <div>
            <label className="block text-sm">Redondeo</label>
            <Select value={roundingMode} onChange={e => setRoundingMode(e.target.value)}>
              <option value="none">Sin redondeo</option>
              <option value="nearest_1">Al 1,00 más cercano</option>
              <option value="nearest_0_5">Al 0,50 más cercano</option>
            </Select>
          </div>
          <div>
            <label className="block text-sm">Buscar producto</label>
            <Input value={filterText} onChange={e => setFilterText(e.target.value)} placeholder="Ej.: azúcar, 779..." />
          </div>
        </div>
        <div className="overflow-auto">
          <table className="min-w-full border border-slate-200 rounded">
            <thead>
              <tr className="bg-slate-50 text-slate-700">
                <th className="text-left px-3 py-2 border border-slate-200">Sel.</th>
                <th className="text-left px-3 py-2 border border-slate-200">Nombre</th>
                <th className="text-left px-3 py-2 border border-slate-200">SKU</th>
              </tr>
            </thead>
            <tbody>
              {filteredProducts.length === 0 && (
                <tr>
                  <td colSpan="3" className="px-3 py-3 text-slate-600 text-center"><Badge variant="default">Sin resultados</Badge></td>
                </tr>
              )}
              {filteredProducts.map(p => (
                <tr key={p.id} className="hover:bg-slate-50">
                  <td className="px-3 py-2 border border-slate-200">
                    <input type="checkbox" checked={selectedProductIds.includes(p.id)} onChange={() => toggleSelectProduct(p.id)} />
                  </td>
                  <td className="px-3 py-2 border border-slate-200">{p.name}</td>
                  <td className="px-3 py-2 border border-slate-200">{p.sku || '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="flex items-center gap-2 mt-3">
          <Button type="button" variant="secondary" onClick={selectAllFiltered}>Seleccionar todos (filtrados)</Button>
          <Button type="button" variant="secondary" onClick={clearSelection}>Limpiar selección</Button>
          <Button type="button" variant="primary" onClick={applyToSelected}>Aplicar a seleccionados</Button>
        </div>
      </Card>
    </div>
  )
}
