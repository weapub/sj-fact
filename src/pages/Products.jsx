import { useEffect, useRef, useState, useCallback } from 'react'
import { db } from '../data/db'
import Card from '../components/Card'
import Button from '../components/Button'
import Table from '../components/Table'
import Input from '../components/Input'
import Select from '../components/Select'
import Badge from '../components/Badge'
import Modal from '../components/Modal'
import { useToast } from '../components/ToastContext'
import { formatMoney, parseMoney } from '../utils/format'

export default function Products() {
  const [products, setProducts] = useState([])
  const [form, setForm] = useState({ name: '', sku: '', barcode: '', category: '', weighable: false, unitsPerBox: '' })
  const [formErrors, setFormErrors] = useState({ name: '' })
  const addNameRef = useRef(null)
  const [addSuggestions, setAddSuggestions] = useState([])
  const [csvHeaders, setCsvHeaders] = useState([])
  const [csvRows, setCsvRows] = useState([])
  const [mapName, setMapName] = useState('')
  const [mapSku, setMapSku] = useState('')
  const [mapPrice, setMapPrice] = useState('')
  const [mapCategory, setMapCategory] = useState('')
  const [mapTipo, setMapTipo] = useState('')
  const [importResult, setImportResult] = useState(null)
  const [productImportMode, setProductImportMode] = useState(() => localStorage.getItem('import.productMode') || 'add_update')
  const [includePrices, setIncludePrices] = useState(() => (localStorage.getItem('import.includePrices') ?? 'true') !== 'false')
  const [importPlan, setImportPlan] = useState(null)
  const [csvImportOpen, setCsvImportOpen] = useState(() => (localStorage.getItem('import.csvOpen') ?? 'false') === 'true')
  const [priceLists, setPriceLists] = useState([])
  const [selectedListId, setSelectedListId] = useState('')
  const [selectedVariant, setSelectedVariant] = useState('unidad')
  const [createNewList, setCreateNewList] = useState(false)
  const [newListName, setNewListName] = useState('Importación CSV')
  const [newListCurrency, setNewListCurrency] = useState('ARS')
  const [delimiter, setDelimiter] = useState(';')
  const [csvRaw, setCsvRaw] = useState('')
  const [csvBuffer, setCsvBuffer] = useState(null)
  const [encoding, setEncoding] = useState('utf-8')
  const [pricesMap, setPricesMap] = useState({})
  const [editingId, setEditingId] = useState(null)
  const [editForm, setEditForm] = useState({ name: '', sku: '', barcode: '', category: '', weighable: false, price: '', unitsPerBox: '' })
  const [filterText, setFilterText] = useState('')
  const [filterCategory, setFilterCategory] = useState('')
  const [filterWeighable, setFilterWeighable] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [toDelete, setToDelete] = useState(null)
  const [deleteAllOpen, setDeleteAllOpen] = useState(false)
  const [resetAllOpen, setResetAllOpen] = useState(false)
  const [confirmDeleteAllText, setConfirmDeleteAllText] = useState('')
  const [confirmResetAllText, setConfirmResetAllText] = useState('')
  const toast = useToast()
  const [editOpen, setEditOpen] = useState(false)
  const [editErrors, setEditErrors] = useState({ name: '', price: '' })
  const nameRef = useRef(null)
  const [inlineEditingPriceId, setInlineEditingPriceId] = useState(null)
  const [inlinePriceText, setInlinePriceText] = useState('')
  const inlinePriceRef = useRef(null)
  const [inlineEditingSkuId, setInlineEditingSkuId] = useState(null)
  const [inlineSkuText, setInlineSkuText] = useState('')
  const inlineSkuRef = useRef(null)
  const [inlineEditingCategoryId, setInlineEditingCategoryId] = useState(null)
  const [inlineCategoryText, setInlineCategoryText] = useState('')
  const inlineCategoryRef = useRef(null)

  

  const load = useCallback(async () => {
    const list = await db.products.orderBy('name').toArray()
    setProducts(list)
    const lists = await db.priceLists.orderBy('name').toArray()
    setPriceLists(lists)
    if (!createNewList && lists.length > 0) {
      const storedId = localStorage.getItem('import.selectedListId')
      const byId = storedId ? lists.find(l => String(l.id) === String(storedId)) : null
      if (byId) {
        setSelectedListId(String(byId.id))
      } else if (!selectedListId) {
        const general = lists.find(l => /general/i.test(l.name))
        setSelectedListId(String((general || lists[0]).id))
      }
    }
  }, [createNewList, selectedListId])

  useEffect(() => {
    load()
    setTimeout(() => { addNameRef.current?.focus() }, 0)
  }, [load])

  useEffect(() => {
    const q = (form.name || '').trim().toLowerCase()
    if (q.length < 2) { setAddSuggestions([]); return }
    const matches = products.filter(p => [p.name, p.sku, p.barcode, p.category].some(v => (v || '').toLowerCase().includes(q))).slice(0, 8)
    setAddSuggestions(matches)
  }, [form.name, products])

  async function addProduct(e) {
    e.preventDefault()
    const name = (form.name || '').trim()
    const errors = { name: '' }
    if (!name) errors.name = 'El nombre es obligatorio.'
    setFormErrors(errors)
    if (errors.name) return
    const unitsRaw = (form.unitsPerBox || '').toString().trim()
    const units = parseInt(unitsRaw.replace(/[^\d]/g, ''), 10)
    await db.products.add({ name: form.name.trim(), sku: form.sku || '', barcode: form.barcode || '', category: form.category || '', weighable: !!form.weighable, unitsPerBox: isNaN(units) ? 0 : units })
    setForm({ name: '', sku: '', barcode: '', category: '', weighable: false, unitsPerBox: '' })
    setFormErrors({ name: '' })
    load()
  }

  function confirmDelete(id) {
    setToDelete(id)
    setDeleteOpen(true)
  }

  async function performDelete() {
    if (toDelete == null) return
    const usedCount = await db.invoiceItems.where('productId').equals(toDelete).count()
    if (usedCount > 0) {
      toast.show('No se puede eliminar: producto usado en facturas')
      setDeleteOpen(false)
      setToDelete(null)
      return
    }
    await db.products.delete(toDelete)
    await db.prices.where('productId').equals(toDelete).delete()
    setDeleteOpen(false)
    setToDelete(null)
    toast.show('Producto eliminado')
    await load()
  }

  async function performDeleteAll() {
    const all = await db.products.toArray()
    if (!all.length) { setDeleteAllOpen(false); toast.show('No hay productos'); return }
    const ids = all.map(p => p.id).filter(Boolean)
    await db.products.bulkDelete(ids)
    await db.prices.where('productId').anyOf(ids).delete()
    try {
      const { deleteProductsAndPricesByKeys, isSupabaseConfigured } = await import('../data/cloud/supabase')
      if (isSupabaseConfigured()) {
        const skus = all.map(p => p.sku).filter(Boolean)
        const names = all.map(p => p.name).filter(Boolean)
        await deleteProductsAndPricesByKeys({ skus, names })
      }
    } catch {
      toast.show('Error al eliminar productos en nube', 'warning')
    }
    setDeleteAllOpen(false)
    toast.show('Todos los productos fueron eliminados')
    await load()
  }

  async function performResetAll() {
    // Local: limpiar todas las tablas
    await db.customers.clear()
    await db.products.clear()
    await db.priceLists.clear()
    await db.prices.clear()
    await db.invoices.clear()
    await db.invoiceItems.clear()
    await db.ledger.clear()
    // Cloud: intentar borrar todo del owner
    try {
      const { deleteAllOwnerData, isSupabaseConfigured } = await import('../data/cloud/supabase')
      if (isSupabaseConfigured()) {
        await deleteAllOwnerData()
      }
    } catch {
      toast.show('Error al reiniciar datos en nube', 'warning')
    }
    setResetAllOpen(false)
    setConfirmResetAllText('')
    toast.show('Datos reiniciados')
    await load()
  }

  function openEdit(p) {
    const prc = pricesMap[p.id]
    const variant = prc?.variant || selectedVariant
    setEditForm({ name: p.name || '', sku: p.sku || '', barcode: p.barcode || '', category: p.category || '', weighable: !!p.weighable, price: prc ? formatMoney(prc.price) : '', variant, unitsPerBox: String(p.unitsPerBox ?? 0) })
    setEditingId(p.id)
    setEditOpen(true)
    setTimeout(() => { nameRef.current?.focus() }, 0)
  }

  async function performEdit() {
    const name = (editForm.name || '').trim()
    const errors = { name: '', price: '' }
    if (!name) errors.name = 'El nombre es obligatorio.'
    const priceStr = (editForm.price || '').toString().trim()
    if (priceStr) {
      const parsed = parseMoney(priceStr)
      if (isNaN(parsed)) {
        errors.price = 'Precio inválido. Usá números (ej.: 1234,56)'
      }
    }
    setEditErrors(errors)
    if (errors.name || errors.price) return
    if (!editingId) return
    const unitsRaw = (editForm.unitsPerBox || '').toString().trim()
    const units = parseInt(unitsRaw.replace(/[^\d]/g, ''), 10)
    await db.products.put({ id: editingId, name, sku: editForm.sku || '', barcode: editForm.barcode || '', category: editForm.category || '', weighable: !!editForm.weighable, unitsPerBox: isNaN(units) ? 0 : units })
    const listNum = Number(selectedListId)
    if (listNum > 0) {
      if (priceStr) {
        const val = parseMoney(priceStr)
        if (!isNaN(val)) {
           const currentProd = products.find(x => x.id === editingId)
          const varToUse = (editForm.variant || selectedVariant || 'unidad')
          if (currentProd?.weighable && varToUse !== 'unidad') {
            toast.show('Para productos pesables, solo precio por unidad')
            return
          }
          const existing = pricesMap[editingId]
          if (existing) {
            await db.prices.put({ id: existing.id, listId: listNum, productId: editingId, price: val, variant: varToUse })
          } else {
            await db.prices.add({ listId: listNum, productId: editingId, price: val, variant: varToUse })
          }
        }
      }
    }
    setEditOpen(false)
    setEditingId(null)
    toast.show('Producto actualizado')
    await load()
  }

  function parseCSV(text, delimiterChar = ',') {
    // Parser simple compatible con comillas dobles y separador coma
    const rows = []
    let i = 0
    const len = text.length
    let row = []
    let field = ''
    let inQuotes = false
    while (i < len) {
      const ch = text[i]
      if (inQuotes) {
        if (ch === '"') {
          if (text[i + 1] === '"') {
            field += '"'
            i += 2
            continue
          } else {
            inQuotes = false
            i++
            continue
          }
        } else {
          field += ch
          i++
          continue
        }
      } else {
        if (ch === '"') {
          inQuotes = true
          i++
          continue
        }
        if (ch === delimiterChar) {
          row.push(field)
          field = ''
          i++
          continue
        }
        if (ch === '\n') {
          row.push(field)
          field = ''
          rows.push(row)
          row = []
          i++
          continue
        }
        if (ch === '\r') { i++; continue }
        field += ch
        i++
      }
    }
    // último campo/row si quedó sin cerrar
    if (field.length > 0 || row.length > 0) {
      row.push(field)
      rows.push(row)
    }
    return rows
  }

  function detectDelimiter(text) {
    // Prueba candidatos en las primeras ~20 filas con parser que respeta comillas
    const candidates = [',', ';', '\t']
    let best = delimiter
    let bestScore = -1
    for (const cand of candidates) {
      const rows = parseCSV(text, cand)
      const sample = rows.slice(0, 20)
      if (sample.length === 0) continue
      const counts = sample.map(r => r.length)
      // Ponderamos: cantidad de columnas promedio y penalizamos 1 columna
      const avg = counts.reduce((a, b) => a + b, 0) / counts.length
      const penalized = avg - (avg <= 1 ? 1 : 0)
      if (penalized > bestScore) {
        bestScore = penalized
        best = cand
      }
    }
    return best
  }

  async function handleFile(e) {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => {
      const buf = reader.result
      setCsvBuffer(buf)
      // decodificar según encoding seleccionado, con fallback automático si aparecen caracteres de reemplazo
      const tryDecode = (enc) => {
        try {
          const td = new TextDecoder(enc, { fatal: false })
          return td.decode(buf)
        } catch {
          return null
        }
      }
      let text = tryDecode(encoding) || ''
      if (!text) {
        text = tryDecode('utf-8') || ''
        setEncoding('utf-8')
      }
      if (text.includes('\uFFFD')) { // caracteres desconocidos: intentar Windows-1252
        const alt = tryDecode('windows-1252')
        if (alt && !alt.includes('\uFFFD')) {
          text = alt
          setEncoding('windows-1252')
        }
      }
      setCsvRaw(text)
      // Autodetección usando múltiples filas y parser con comillas
      let detected = detectDelimiter(text)
      setDelimiter(detected)
      const rows = parseCSV(text, detected).filter(r => r.length && r.some(x => x !== ''))
      if (rows.length === 0) {
        setCsvHeaders([])
        setCsvRows([])
        return
      }
      const headers = rows[0].map(h => h.trim())
      const dataRows = rows.slice(1)
      setCsvHeaders(headers)
      setCsvRows(dataRows)
      // heurística inicial para mapear
      const nameGuess = headers.find(h => /(^|\s)(nombre|name)(\s|$)/i.test(h)) || headers[0]
      const skuGuess = headers.find(h => /(sku|codigo|código|code)/i.test(h)) || ''
      const priceGuess = headers.find(h => /(precio|price|unitprice|unit_price)/i.test(h)) || ''
      const categoryGuess = headers.find(h => /(categoria|categoría|category)/i.test(h)) || ''
      const tipoGuess = headers.find(h => /(tipo|type)/i.test(h)) || ''
      setMapName(nameGuess || '')
      setMapSku(skuGuess || '')
      setMapPrice(priceGuess || '')
      setMapCategory(categoryGuess || '')
      setMapTipo(tipoGuess || '')
      setImportResult(null)
    }
    reader.readAsArrayBuffer(file)
  }

  useEffect(() => {
    // Reparsear automáticamente cuando el usuario cambia el separador manualmente
    if (!csvRaw) return
    const rows = parseCSV(csvRaw, delimiter).filter(r => r.length && r.some(x => x !== ''))
    if (rows.length === 0) {
      setCsvHeaders([])
      setCsvRows([])
      return
    }
    const headers = rows[0].map(h => h.trim())
    const dataRows = rows.slice(1)
    setCsvHeaders(headers)
    setCsvRows(dataRows)
  }, [delimiter, csvRaw])

  useEffect(() => {
    // Re-decodificar cuando cambia la codificación
    if (!csvBuffer) return
    try {
      const td = new TextDecoder(encoding, { fatal: false })
      const text = td.decode(csvBuffer)
      setCsvRaw(text)
      const rows = parseCSV(text, delimiter).filter(r => r.length && r.some(x => x !== ''))
      if (rows.length === 0) {
        setCsvHeaders([])
        setCsvRows([])
        return
      }
      const headers = rows[0].map(h => h.trim())
      const dataRows = rows.slice(1)
      setCsvHeaders(headers)
      setCsvRows(dataRows)
    } catch {
      setCsvHeaders([])
      setCsvRows([])
    }
  }, [encoding, csvBuffer, delimiter])

  useEffect(() => {
    // actualizar mapa de precios cuando cambia la lista seleccionada
    (async () => {
      const listNum = Number(selectedListId)
      if (listNum > 0) {
        const prs = await db.prices.where('listId').equals(listNum).toArray()
        const map = {}
        for (const pr of prs) {
          const v = pr.variant || 'unidad'
          const cur = map[pr.productId]
          if (!cur) {
            // primer precio visto; si coincide variante seleccionada, lo usamos; si no, queda como fallback
            map[pr.productId] = pr
          } else {
            // si el actual no es de la variante seleccionada y este sí, reemplazamos
            const curV = cur.variant || 'unidad'
            if (curV !== selectedVariant && v === selectedVariant) {
              map[pr.productId] = pr
            }
          }
        }
        setPricesMap(map)
      } else {
        setPricesMap({})
      }
    })()
  }, [selectedListId, selectedVariant])

  useEffect(() => {
    // Si estamos editando y cambia la lista, actualizar el precio mostrado
    if (!editingId) return
    const prc = pricesMap[editingId]
    setEditForm(prev => ({ ...prev, price: prc ? formatMoney(prc.price) : '' }))
  }, [editingId, pricesMap, selectedListId])

  useEffect(() => {
    // foco cuando entra en edición inline
    if (inlineEditingPriceId != null) {
      setTimeout(() => { inlinePriceRef.current?.focus() }, 0)
    }
  }, [inlineEditingPriceId])

  useEffect(() => {
    if (inlineEditingSkuId != null) {
      setTimeout(() => { inlineSkuRef.current?.focus() }, 0)
    }
  }, [inlineEditingSkuId])

  useEffect(() => {
    if (inlineEditingCategoryId != null) {
      setTimeout(() => { inlineCategoryRef.current?.focus() }, 0)
    }
  }, [inlineEditingCategoryId])

  async function refreshPricesMap() {
    const listNum = Number(selectedListId)
    if (listNum > 0) {
      const prs = await db.prices.where('listId').equals(listNum).toArray()
      const map = {}
      for (const pr of prs) {
        const v = pr.variant || 'unidad'
        const cur = map[pr.productId]
        if (!cur) {
          map[pr.productId] = pr
        } else {
          const curV = cur.variant || 'unidad'
          if (curV !== selectedVariant && v === selectedVariant) {
            map[pr.productId] = pr
          }
        }
      }
      setPricesMap(map)
    } else {
      setPricesMap({})
    }
  }

  function startInlineEdit(p) {
    const prc = pricesMap[p.id]
    setInlineEditingPriceId(p.id)
    setInlinePriceText(prc ? formatMoney(prc.price) : '')
  }

  async function saveInlinePrice() {
    const listNum = Number(selectedListId)
    if (!listNum) { toast.show('Seleccioná una lista primero'); setInlineEditingPriceId(null); return }
    if (inlineEditingPriceId == null) return
    const priceStr = (inlinePriceText || '').trim()
    if (!priceStr) { setInlineEditingPriceId(null); return }
    const val = parseMoney(priceStr)
    if (isNaN(val)) { toast.show('Precio inválido. Usá números (ej.: 1234,56)'); return }
    const prod = products.find(x => x.id === inlineEditingPriceId)
    if (prod?.weighable && selectedVariant !== 'unidad') { toast.show('Para productos pesables, solo precio por unidad'); return }
    const existing = pricesMap[inlineEditingPriceId]
    if (existing) {
      await db.prices.put({ id: existing.id, listId: listNum, productId: inlineEditingPriceId, price: val, variant: selectedVariant })
    } else {
      await db.prices.add({ listId: listNum, productId: inlineEditingPriceId, price: val, variant: selectedVariant })
    }
    setInlineEditingPriceId(null)
    await refreshPricesMap()
    toast.show('Precio actualizado')
  }

  function startInlineSkuEdit(p) {
    setInlineEditingSkuId(p.id)
    setInlineSkuText(p.sku || '')
  }

  async function saveInlineSku() {
    if (inlineEditingSkuId == null) return
    const sku = (inlineSkuText || '').trim()
    await db.products.put({ id: inlineEditingSkuId, name: products.find(x => x.id === inlineEditingSkuId)?.name || '', sku, barcode: products.find(x => x.id === inlineEditingSkuId)?.barcode || '', category: products.find(x => x.id === inlineEditingSkuId)?.category || '', weighable: !!products.find(x => x.id === inlineEditingSkuId)?.weighable })
    setInlineEditingSkuId(null)
    await load()
    toast.show('SKU actualizado')
  }

  function startInlineCategoryEdit(p) {
    setInlineEditingCategoryId(p.id)
    setInlineCategoryText(p.category || '')
  }

  async function saveInlineCategory() {
    if (inlineEditingCategoryId == null) return
    const category = (inlineCategoryText || '').trim()
    await db.products.put({ id: inlineEditingCategoryId, name: products.find(x => x.id === inlineEditingCategoryId)?.name || '', sku: products.find(x => x.id === inlineEditingCategoryId)?.sku || '', barcode: products.find(x => x.id === inlineEditingCategoryId)?.barcode || '', category, weighable: !!products.find(x => x.id === inlineEditingCategoryId)?.weighable })
    setInlineEditingCategoryId(null)
    await load()
    toast.show('Categoría actualizada')
  }

  // Normaliza precios con puntos como separadores de miles cuando no hay coma decimal
  // Ej.: "1.234" => "1234" ; "12.345.678" => "12345678"
  // No modifica casos con coma ("1.234,56") porque parseMoney ya los maneja
  function normalizeThousandDots(raw) {
    if (raw == null) return ''
    let s = String(raw).trim()
    if (!s) return ''
    if (!/,/.test(s) && /^\d{1,3}(?:\.\d{3})+$/.test(s)) {
      s = s.replace(/\./g, '')
    }
    return s
  }

  async function computeImportImpact() {
    setImportPlan(null)
    if (!mapName) {
      setImportPlan({ ok: false, message: 'Seleccioná la columna para Nombre.' })
      return
    }
    const nameIdx = csvHeaders.indexOf(mapName)
    const skuIdx = mapSku ? csvHeaders.indexOf(mapSku) : -1
    const priceIdx = mapPrice ? csvHeaders.indexOf(mapPrice) : -1
    const categoryIdx = mapCategory ? csvHeaders.indexOf(mapCategory) : -1
    const existingBySku = {}
    if (skuIdx >= 0) {
      const existing = await db.products.toArray()
      for (const p of existing) {
        if (p.sku) existingBySku[p.sku] = p
      }
    }
    const toAdd = []
    const toUpdate = []
    const priceRows = []
    const tipoIdx = mapTipo ? csvHeaders.indexOf(mapTipo) : -1
    for (const r of csvRows) {
      const name = (r[nameIdx] || '').trim()
      const sku = skuIdx >= 0 ? (r[skuIdx] || '').trim() : ''
      const category = categoryIdx >= 0 ? (r[categoryIdx] || '').trim() : ''
      const priceRaw = priceIdx >= 0 ? r[priceIdx] : ''
      const priceVal = priceIdx >= 0 ? parseMoney(normalizeThousandDots(priceRaw)) : NaN
      const tipoStrRaw = tipoIdx >= 0 ? (r[tipoIdx] || '').toString().trim() : ''
      const tipoNorm = tipoStrRaw.toUpperCase().replace(/[-_\s]+/g, ' ')
      let weighableRaw = null
      if (tipoIdx >= 0) {
        if (tipoNorm) weighableRaw = (tipoNorm === 'NORMAL') ? false : true
      }
      if (!name) continue
      // Precalcular posibles altas/actualizaciones (se filtrarán por modo al final)
      if (sku && existingBySku[sku]) {
        const current = existingBySku[sku]
        toUpdate.push({ id: current.id, name, sku, category, weighable: (weighableRaw ?? current.weighable ?? false) })
      } else {
        toAdd.push({ name, sku, category, weighable: (weighableRaw ?? false) })
      }
      if (includePrices && selectedListId && sku && priceIdx >= 0 && !isNaN(priceVal)) {
        priceRows.push({ sku, price: priceVal })
      }
    }
    let priceAdds = 0
    let priceUpdates = 0
    if (priceRows.length && includePrices) {
      const listIdNum = Number(createNewList ? -1 : selectedListId)
      const prods = await db.products.toArray()
      const bySku = {}
      for (const p of prods) if (p.sku) bySku[p.sku] = p
      let existingPrices = []
      if (listIdNum > 0) {
        existingPrices = await db.prices.where('listId').equals(listIdNum).toArray()
      }
      const priceKey = (pid) => `${listIdNum}:${pid}`
      const existMap = {}
      for (const pr of existingPrices) existMap[priceKey(pr.productId)] = pr
      for (const row of priceRows) {
        const prod = bySku[row.sku]
        if (!prod) continue
        const key = priceKey(prod.id)
        if (existMap[key]) priceUpdates++
        else priceAdds++
      }
    }
    const effectiveAdds = (productImportMode === 'add_update' || productImportMode === 'add_only') ? toAdd.length : 0
    const effectiveUpdates = (productImportMode === 'add_update' || productImportMode === 'update_only') ? toUpdate.length : 0
    setImportPlan({
      ok: true,
      productsToAdd: effectiveAdds,
      productsToUpdate: effectiveUpdates,
      pricesToAdd: priceAdds,
      pricesToUpdate: priceUpdates,
      message: 'Cálculo de impacto listo.'
    })
  }

  async function uploadToCloud() {
    try {
      const collections = {
        customers: await db.customers.toArray(),
        products: await db.products.toArray(),
        priceLists: await db.priceLists.toArray(),
        prices: await db.prices.toArray(),
        invoices: await db.invoices.toArray(),
        invoiceItems: await db.invoiceItems.toArray(),
        ledger: await db.ledger.toArray(),
      }
      const { pushAll } = await import('../data/cloud/supabase')
      const summary = await pushAll(collections)
      toast.success('Datos subidos a la nube')
      if (summary) {
        toast.info(`Remapeos: ${summary.remapped?.prices ?? 0} precios, ${summary.remapped?.invoiceItems ?? 0} items. Omisiones: ${summary.filtered?.prices ?? 0} precios, ${summary.filtered?.invoiceItems ?? 0} items.`)
      }
    } catch (err) {
      toast.error(err.message || 'Error al subir a la nube')
    }
  }

  

  async function runImport() {
    if (!mapName) {
      setImportResult({ ok: false, message: 'Seleccioná la columna para Nombre.' })
      return
    }
    const nameIdx = csvHeaders.indexOf(mapName)
    const skuIdx = mapSku ? csvHeaders.indexOf(mapSku) : -1
    const priceIdx = mapPrice ? csvHeaders.indexOf(mapPrice) : -1
    const categoryIdx = mapCategory ? csvHeaders.indexOf(mapCategory) : -1
    let added = 0
    let updated = 0
    let pricesAdded = 0
    let pricesUpdated = 0
    const existingBySku = {}
    if (skuIdx >= 0) {
      const existing = await db.products.toArray()
      for (const p of existing) {
        if (p.sku) existingBySku[p.sku] = p
      }
    }
    const toAdd = []
    const toUpdate = []
    const priceRows = []
    const tipoIdx = mapTipo ? csvHeaders.indexOf(mapTipo) : -1
    for (const r of csvRows) {
      const name = (r[nameIdx] || '').trim()
      const sku = skuIdx >= 0 ? (r[skuIdx] || '').trim() : ''
      const category = categoryIdx >= 0 ? (r[categoryIdx] || '').trim() : ''
      const priceRaw = priceIdx >= 0 ? r[priceIdx] : ''
      const priceVal = priceIdx >= 0 ? parseMoney(normalizeThousandDots(priceRaw)) : NaN
      const tipoStrRaw = tipoIdx >= 0 ? (r[tipoIdx] || '').toString().trim() : ''
      const tipoNorm = tipoStrRaw.toUpperCase().replace(/[-_\s]+/g, ' ')
      let weighableRaw = null
      if (tipoIdx >= 0) {
        if (tipoNorm) weighableRaw = (tipoNorm === 'NORMAL') ? false : true
      }
      if (!name) continue
      // Precalcular posibles altas/actualizaciones (se aplicarán según modo)
      if (sku && existingBySku[sku]) {
        const current = existingBySku[sku]
        toUpdate.push({ id: current.id, name, sku, category, weighable: (weighableRaw ?? current.weighable ?? false) })
      } else {
        toAdd.push({ name, sku, category, weighable: (weighableRaw ?? false) })
      }
      // Solo agregamos precios si hay lista seleccionada y SKU disponible para asociar
      if (includePrices && selectedListId && sku && priceIdx >= 0 && !isNaN(priceVal)) {
        priceRows.push({ sku, price: priceVal })
      }
    }
    if (productImportMode !== 'none') {
      if (productImportMode === 'add_update' || productImportMode === 'update_only') {
        if (toUpdate.length) {
          await db.products.bulkPut(toUpdate)
          updated += toUpdate.length
        }
      }
      if (productImportMode === 'add_update' || productImportMode === 'add_only') {
        if (toAdd.length) {
          await db.products.bulkAdd(toAdd)
          added += toAdd.length
        }
      }
    }
    // Precios: construimos mapa productoId por SKU tras la importación
    // Crear lista nueva si corresponde
    let listIdNum = Number(selectedListId)
    if (includePrices && priceRows.length) {
      if (createNewList) {
        if (!newListName.trim()) {
          setImportResult({ ok: false, message: 'Ingresá un nombre para la nueva Lista.' })
          return
        }
        listIdNum = await db.priceLists.add({ name: newListName.trim(), currency: newListCurrency.trim() || 'ARS' })
      }
    }
    if (includePrices && priceRows.length && listIdNum > 0) {
      const prods = await db.products.toArray()
      const bySku = {}
      for (const p of prods) if (p.sku) bySku[p.sku] = p
      // cargar precios existentes de esa lista
      const existingPrices = await db.prices.where('listId').equals(listIdNum).toArray()
      const priceKey = (pid) => `${listIdNum}:${pid}`
      const existMap = {}
      for (const pr of existingPrices) existMap[priceKey(pr.productId)] = pr
      const toAddPrices = []
      const toUpdatePrices = []
      for (const row of priceRows) {
        const prod = bySku[row.sku]
        if (!prod) continue
        const key = priceKey(prod.id)
        if (existMap[key]) {
          toUpdatePrices.push({ id: existMap[key].id, listId: listIdNum, productId: prod.id, price: row.price })
        } else {
          toAddPrices.push({ listId: listIdNum, productId: prod.id, price: row.price })
        }
      }
      if (toUpdatePrices.length) {
        await db.prices.bulkPut(toUpdatePrices)
        pricesUpdated += toUpdatePrices.length
      }
      if (toAddPrices.length) {
        await db.prices.bulkAdd(toAddPrices)
        pricesAdded += toAddPrices.length
      }
    }
    await load()
    const parts = [`Agregados: ${added}`, `Actualizados: ${updated}`]
    if (priceRows.length) parts.push(`Precios agregados: ${pricesAdded}`, `Precios actualizados: ${pricesUpdated}`)
    setImportResult({ ok: true, message: `Importación completa. ${parts.join(', ')}` })
  }

  // Persistencia de preferencias
  useEffect(() => {
    localStorage.setItem('import.productMode', productImportMode)
  }, [productImportMode])
  useEffect(() => {
    localStorage.setItem('import.includePrices', includePrices ? 'true' : 'false')
  }, [includePrices])
  useEffect(() => {
    if (selectedListId) localStorage.setItem('import.selectedListId', selectedListId)
  }, [selectedListId])
  useEffect(() => {
    localStorage.setItem('import.csvOpen', csvImportOpen ? 'true' : 'false')
  }, [csvImportOpen])

  return (
    <div className="max-w-7xl mx-auto space-y-6 p-4">
<h2 className="text-2xl font-bold tracking-tight text-slate-800">Productos</h2>
      <Card>
      <form onSubmit={addProduct} className="grid grid-cols-1 md:grid-cols-4 gap-3 items-end">
        <div>
          <Input label="Nombre" value={form.name} onChange={e => { setForm({ ...form, name: e.target.value }); setFilterText(e.target.value) }} placeholder="Ej.: Aceite" helper={formErrors.name} className={formErrors.name ? 'border-red-500 focus:ring-red-500 focus:border-red-500' : ''} ref={addNameRef} />
          {addSuggestions.length > 0 && (
            <div className="mt-1 border rounded bg-white shadow text-sm max-h-40 overflow-auto">
<div className="px-2 py-1 text-xs text-slate-600">Coincidencias existentes</div>
              {addSuggestions.map(s => (
                <Button type="button" key={s.id} variant="outline" size="sm" className="w-full text-left px-2 py-1 flex items-center justify-between hover:bg-gray-50" onClick={() => openEdit(s)}>
                  <span className="truncate">{s.name}</span>
<span className="text-xs text-slate-600 ml-2">{s.barcode || s.sku || s.category || ''}</span>
                </Button>
              ))}
            </div>
          )}
        </div>
        <Input label="SKU" value={form.sku} onChange={e => setForm({ ...form, sku: e.target.value })} placeholder="Opcional" />
        <Input label="Código de barras" value={form.barcode} onChange={e => setForm({ ...form, barcode: e.target.value })} placeholder="Ej.: 779123..." />
        <Input label="Categoría" value={form.category} onChange={e => setForm({ ...form, category: e.target.value })} placeholder="Ej.: Almacén" />
        <Input label="Unidades por caja" value={form.unitsPerBox} onChange={e => { let val = e.target.value || ''; val = val.replace(/[^\d]/g, ''); setForm({ ...form, unitsPerBox: val }) }} placeholder="Ej.: 12" />
        <div className="md:col-span-3 flex items-center gap-3">
          <label className="inline-flex items-center gap-2">
            <input type="checkbox" className="rounded" checked={!!form.weighable} onChange={e => setForm({ ...form, weighable: e.target.checked })} />
            <span>Es producto pesable</span>
          </label>
        </div>
        <Button variant="primary" type="submit" className="md:col-span-4">Agregar producto</Button>
        <Button variant="danger" type="button" className="md:col-span-4" onClick={() => setDeleteAllOpen(true)}>Borrar todos los productos</Button>
        <Button variant="warning" type="button" className="md:col-span-4" onClick={() => setResetAllOpen(true)}>Borrar todo y reiniciar</Button>
      </form>
      </Card>

      <Card title="Importar desde CSV">
        <div className="flex items-center justify-between">
          <p className="text-sm text-slate-600">Descargá el archivo de Google Drive como CSV y cargalo acá. La primera fila debe ser el encabezado.</p>
          <Button variant="secondary" size="sm" onClick={() => setCsvImportOpen(v => !v)}>{csvImportOpen ? 'Ocultar' : 'Mostrar'}</Button>
        </div>
        {csvImportOpen && (
          <>
        <input type="file" className="text-sm" accept=".csv,text/csv" onChange={handleFile} />
<div className="text-sm text-slate-600">Separador detectado: <span className="font-mono">{delimiter === '\t' ? 'Tab' : (delimiter || 'n/a')}</span></div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 items-end">
          <Select label="Separador de columnas" value={delimiter} onChange={e => setDelimiter(e.target.value)} helper="Usá ';' si tu archivo separa columnas con punto y coma.">
            <option value=";">;</option>
            <option value=",">,</option>
            <option value="\t">Tabulador</option>
          </Select>
          <Select label="Codificación" value={encoding} onChange={e => setEncoding(e.target.value)} helper="Si ves caracteres raros (�), probá Windows-1252.">
            <option value="utf-8">UTF-8 (recomendado)</option>
            <option value="windows-1252">Windows-1252 (Excel/Windows)</option>
          </Select>
        </div>
        {csvHeaders.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 items-end">
            <Select label="Columna para Nombre" value={mapName} onChange={e => setMapName(e.target.value)}>
              <option value="">-- Elegir --</option>
              {csvHeaders.map(h => <option key={h} value={h}>{h}</option>)}
            </Select>
            <Select label="Columna para SKU (opcional)" value={mapSku} onChange={e => setMapSku(e.target.value)}>
              <option value="">-- Ninguna --</option>
              {csvHeaders.map(h => <option key={h} value={h}>{h}</option>)}
            </Select>
            <Select label="Columna para Precio (opcional)" value={mapPrice} onChange={e => setMapPrice(e.target.value)}>
              <option value="">-- Ninguna --</option>
              {csvHeaders.map(h => <option key={h} value={h}>{h}</option>)}
            </Select>
            <Select label="Columna para Tipo (opcional)" value={mapTipo} onChange={e => setMapTipo(e.target.value)}>
              <option value="">-- Ninguna --</option>
              {csvHeaders.map(h => <option key={h} value={h}>{h}</option>)}
            </Select>
            <Select label="Columna para Categoría (opcional)" value={mapCategory} onChange={e => setMapCategory(e.target.value)}>
              <option value="">-- Ninguna --</option>
              {csvHeaders.map(h => <option key={h} value={h}>{h}</option>)}
            </Select>
            <div className="md:col-span-3 flex flex-wrap items-center gap-4 mt-1">
              <Select label="Importar productos" value={productImportMode} onChange={e => setProductImportMode(e.target.value)}>
                <option value="add_update">Agregar y actualizar</option>
                <option value="add_only">Solo agregar</option>
                <option value="update_only">Solo actualizar</option>
                <option value="none">No importar</option>
              </Select>
              <label className="inline-flex items-center gap-2 text-sm">
                <input type="checkbox" className="rounded" checked={includePrices} onChange={e => setIncludePrices(e.target.checked)} />
                <span>Importar precios</span>
              </label>
            </div>
            <div className="md:col-span-3 grid grid-cols-1 md:grid-cols-3 gap-3">
              <div className="flex items-center gap-2">
                <input id="newList" type="checkbox" checked={createNewList} onChange={e => setCreateNewList(e.target.checked)} />
                <label htmlFor="newList" className="text-sm">Crear nueva Lista de precios</label>
              </div>
              {!createNewList && (
                <div>
                  <label className="block text-sm">Aplicar precios a Lista</label>
                  <select className="mt-1 w-full border rounded px-3 py-2" value={selectedListId} onChange={e => setSelectedListId(e.target.value)}>
                    <option value="">-- No aplicar precios --</option>
                    {priceLists.map(l => <option key={l.id} value={String(l.id)}>{l.name} ({l.currency})</option>)}
                  </select>
<p className="text-xs text-slate-600 mt-1">Para importar precios por fila, es necesario mapear SKU y Precio.</p>
                </div>
              )}
              {createNewList && (
                <>
                  <Input label="Nombre de la nueva Lista" value={newListName} onChange={e => setNewListName(e.target.value)} />
                  <Input label="Moneda" value={newListCurrency} onChange={e => setNewListCurrency(e.target.value)} />
                </>
              )}
            </div>
            <div className="flex items-center gap-2">
              <Button variant="secondary" onClick={computeImportImpact}>Calcular impacto</Button>
              <Button variant="success" onClick={runImport}>Importar</Button>
              <Button variant="primary" onClick={uploadToCloud}>Subir a nube</Button>
            </div>
          </div>
        )}
        {importResult && (
          <div className={"text-sm " + (importResult.ok ? 'text-green-700' : 'text-red-700')}>{importResult.message}</div>
        )}
        {importPlan && (
          <div className={"text-sm mt-2 " + (importPlan.ok ? 'text-slate-700' : 'text-red-700')}>
            {importPlan.ok ? (
              <div className="flex flex-wrap gap-3">
                <span className="px-2 py-0.5 bg-slate-100 rounded">Productos agregados: {importPlan.productsToAdd}</span>
                <span className="px-2 py-0.5 bg-slate-100 rounded">Productos actualizados: {importPlan.productsToUpdate}</span>
                <span className="px-2 py-0.5 bg-slate-100 rounded">Precios agregados: {importPlan.pricesToAdd}</span>
                <span className="px-2 py-0.5 bg-slate-100 rounded">Precios actualizados: {importPlan.pricesToUpdate}</span>
              </div>
            ) : (
              <div>{importPlan.message}</div>
            )}
          </div>
        )}
          </>
        )}
      </Card>

      {csvImportOpen && csvHeaders.length > 0 && (
        <Card title="Vista previa (primeras 10 filas)">
          <div className="overflow-auto">
            <Table className="border border-slate-200 rounded">
              <thead>
                <tr className="bg-slate-50 text-slate-700 text-left">
                  {csvHeaders.map(h => {
                    const isMapped = h === mapName || h === mapSku || h === mapPrice || h === mapCategory || h === mapTipo
                    return (
                      <th key={h} className={`p-2 border border-slate-200 ${isMapped ? 'bg-amber-50' : ''}`}>
                        {h}
                        {h === mapName && <span className="ml-2 text-xs text-amber-700">Nombre</span>}
                        {h === mapSku && <span className="ml-2 text-xs text-amber-700">SKU</span>}
                        {h === mapPrice && <span className="ml-2 text-xs text-amber-700">Precio</span>}
                        {h === mapTipo && <span className="ml-2 text-xs text-amber-700">Tipo</span>}
                        {h === mapCategory && <span className="ml-2 text-xs text-amber-700">Categoría</span>}
                      </th>
                    )
                  })}
                </tr>
              </thead>
              <tbody>
                {csvRows.slice(0, 10).map((row, i) => (
                  <tr key={i} className="border-t border-slate-200 hover:bg-slate-50">
                    {csvHeaders.map((h, idx) => {
                      const val = (row[idx] ?? '').toString()
                      const isPrice = h === mapPrice
                      return (
        <td key={idx} className={`p-2 border border-slate-200 whitespace-nowrap ${isPrice ? 'bg-amber-50' : ''}`}>{isPrice ? formatMoney(parseMoney(normalizeThousandDots(val))) : val}</td>
                      )
                    })}
                  </tr>
                ))}
              </tbody>
            </Table>
          </div>
          <p className="text-xs text-slate-600">Las columnas mapeadas se resaltan en amarillo.</p>
        </Card>
      )}

      <Card>
        <div className="flex items-center gap-3">
          <label className="text-sm">Lista para visualizar precios</label>
          <Select value={selectedListId} onChange={e => setSelectedListId(e.target.value)}>
            <option value="">-- Sin lista --</option>
            {priceLists.map(l => <option key={l.id} value={String(l.id)}>{l.name} ({l.currency})</option>)}
          </Select>
          <label className="text-sm">Variante</label>
          <Select value={selectedVariant} onChange={e => setSelectedVariant(e.target.value)}>
            <option value="unidad">Unidad</option>
            <option value="caja">Caja</option>
            <option value="mayor">Mayorista</option>
          </Select>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div>
            <label className="block text-sm">Buscar (código, descripción, categoría)</label>
            <Input value={filterText} onChange={e => setFilterText(e.target.value)} placeholder="Ej.: azúcar, 779123..." />
          </div>
          <div>
            <label className="block text-sm">Filtrar por categoría</label>
            <Select value={filterCategory} onChange={e => setFilterCategory(e.target.value)}>
              <option value="">Todas</option>
              {Array.from(new Set(products.map(p => p.category).filter(Boolean))).map(cat => (
                <option key={cat} value={cat}>{cat}</option>
              ))}
            </Select>
          </div>
          <div className="flex items-end">
            <label className="inline-flex items-center gap-2">
              <input type="checkbox" className="rounded" checked={filterWeighable} onChange={e => setFilterWeighable(e.target.checked)} />
              <span>Solo pesables</span>
            </label>
          </div>
        </div>
        <div className="relative overflow-x-auto">
          <div className="pointer-events-none absolute left-0 top-0 h-full w-6 bg-gradient-to-r from-white to-transparent" />
          <div className="pointer-events-none absolute right-0 top-0 h-full w-6 bg-gradient-to-l from-white to-transparent" />
        <Table className="min-w-[720px] border border-slate-200 rounded">
          <thead>
            <tr className="text-left">
              <th className="p-2 sticky top-0 bg-gray-50">Código</th>
              <th className="p-2 sticky top-0 bg-gray-50">Descripción</th>
              <th className="p-2 sticky top-0 bg-gray-50">Categoría</th>
              <th className="p-2 sticky top-0 bg-gray-50">Pesable</th>
              <th className="p-2 sticky top-0 bg-gray-50">Precio</th>
              <th className="p-2 sticky top-0 bg-gray-50">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {(products.filter(p => {
              const text = filterText.trim().toLowerCase()
              const matchText = !text || [p.name, p.sku, p.barcode, p.category].some(v => (v || '').toLowerCase().includes(text))
              const matchCat = !filterCategory || (p.category || '') === filterCategory
              const matchWeigh = !filterWeighable || !!p.weighable
              return matchText && matchCat && matchWeigh
            })).map(p => {
              const pr = pricesMap[p.id]
              const code = (p.barcode && p.barcode.trim()) ? p.barcode : (p.sku || '')
              
              return (
                <tr key={p.id} className="border-t hover:bg-gray-50">
                  <td className="p-1 md:p-2 text-sm md:text-base">
                    {inlineEditingSkuId === p.id ? (
                      <input
                        ref={inlineSkuRef}
                        type="text"
                        value={inlineSkuText}
                        onChange={e => setInlineSkuText(e.target.value)}
                        onBlur={saveInlineSku}
                        onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); saveInlineSku() } else if (e.key === 'Escape') { setInlineEditingSkuId(null) } }}
                        className="w-36 border rounded px-2 py-1 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm md:text-base"
                        placeholder="Ej.: ABC123"
                      />
                    ) : (
                      <div className="flex items-center gap-2">
                        {code ? <Badge variant="default" className="px-2">{code}</Badge> : '—'}
                        <Button type="button" variant="outline" size="sm" onClick={() => startInlineSkuEdit(p)}>Editar SKU</Button>
                      </div>
                    )}
                  </td>
                  <td className="p-1 md:p-2 text-sm md:text-base">
                    {p.name}
                  </td>
                  <td className="p-1 md:p-2 text-sm md:text-base">
                    {inlineEditingCategoryId === p.id ? (
                      <input
                        ref={inlineCategoryRef}
                        type="text"
                        value={inlineCategoryText}
                        onChange={e => setInlineCategoryText(e.target.value)}
                        onBlur={saveInlineCategory}
                        onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); saveInlineCategory() } else if (e.key === 'Escape') { setInlineEditingCategoryId(null) } }}
                        className="w-40 border rounded px-2 py-1 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm md:text-base"
                        placeholder="Ej.: Almacén"
                      />
                    ) : (
                      <div className="flex items-center gap-2">
                        {p.category ? <Badge variant="info">{p.category}</Badge> : <span>—</span>}
                        <Button type="button" variant="outline" size="sm" onClick={() => startInlineCategoryEdit(p)}>{p.category ? 'Editar' : 'Agregar categoría'}</Button>
                      </div>
                    )}
                  </td>
                  <td className="p-1 md:p-2 text-sm md:text-base">
                    {p.weighable ? <Badge variant="success">Sí</Badge> : <Badge variant="default">No</Badge>}
                  </td>
                  <td className="p-1 md:p-2 text-sm md:text-base">
{(() => {
  const sel = priceLists.find(l => String(l.id) === selectedListId)
  const isEditingInline = inlineEditingPriceId === p.id
  if (!selectedListId) {
    return <Badge variant="default">ℹ️ Seleccioná una lista</Badge>
  }
          if (isEditingInline) {
            return (
              <div className="flex items-center gap-2">
                <input
                  ref={inlinePriceRef}
                  type="text"
                  value={inlinePriceText}
                  onChange={e => {
                    let val = e.target.value || ''
                    val = val.replace(/\./g, ',')
                    val = val.replace(/[^\d,]/g, '')
                    val = val.replace(/(,.*),/, '$1')
                    setInlinePriceText(val)
                  }}
                  onBlur={saveInlinePrice}
                  onKeyDown={e => {
                    if (e.key === 'Enter') { e.preventDefault(); saveInlinePrice() }
                    else if (e.key === 'Escape') { setInlineEditingPriceId(null) }
                  }}
                  className="w-28 border rounded px-2 py-1 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm md:text-base"
                  placeholder="Ej: 10,50"
                />
                {sel?.currency ? <span className="text-slate-600 text-xs align-middle">{sel.currency}</span> : null}
                {(() => {
                  const units = parseInt(String(p.unitsPerBox || '0'), 10)
                  const priceNum = parseMoney(inlinePriceText)
                  if (units > 0 && !isNaN(priceNum)) {
                    const isUnit = selectedVariant === 'unidad'
                    const suggestion = isUnit ? (priceNum * units) : (priceNum / units)
                    const label = isUnit ? 'Sugerencia precio por caja' : 'Sugerencia precio por unidad'
                    return (
                      <div className="text-sm text-slate-600 flex items-center gap-2">
                        <span>{label}: {formatMoney(suggestion)}</span>
                        <Button type="button" variant="outline" size="sm" onClick={() => setInlinePriceText(formatMoney(suggestion))}>Usar sugerencia</Button>
                      </div>
                    )
                  }
                  return null
                })()}
              </div>
            )
          }
  if (pr) {
    return (
      <button type="button" className="inline-flex items-center gap-2 hover:bg-slate-50 rounded px-2 py-1" onClick={() => startInlineEdit(p)}>
        <span>{formatMoney(pr.price)}</span>
        {sel?.currency ? <span className="text-slate-600 text-xs align-middle">{sel.currency}</span> : null}
      </button>
    )
  }
  return (
    <Button type="button" variant="outline" size="sm" onClick={() => startInlineEdit(p)}>Agregar precio</Button>
  )
})()}
                  </td>
                  <td className="p-1 md:p-2 text-sm md:text-base">
                    <div className="flex gap-2">
                      <Button variant="primary" onClick={() => openEdit(p)}>Editar</Button>
                      <Button variant="danger" onClick={() => confirmDelete(p.id)}>Eliminar</Button>
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </Table>
        </div>
      </Card>
      <Modal
        isOpen={editOpen}
        title="Editar producto"
        onClose={() => { setEditOpen(false); setEditingId(null) }}
        footer={(
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => { setEditOpen(false); setEditingId(null) }}>Cancelar</Button>
            <Button variant="success" onClick={performEdit}>Guardar</Button>
          </div>
        )}
      >
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <Input label="Nombre" value={editForm.name} onChange={e => setEditForm({ ...editForm, name: e.target.value })} helper={editErrors.name} className={editErrors.name ? 'border-red-500 focus:ring-red-500 focus:border-red-500' : ''} ref={nameRef} />
          <Input label="SKU" value={editForm.sku} onChange={e => setEditForm({ ...editForm, sku: e.target.value })} />
          <Input label="Código de barras" value={editForm.barcode} onChange={e => setEditForm({ ...editForm, barcode: e.target.value })} />
          <Input label="Categoría" value={editForm.category} onChange={e => setEditForm({ ...editForm, category: e.target.value })} />
          <Input label="Unidades por caja" value={editForm.unitsPerBox} onChange={e => { let val = e.target.value || ''; val = val.replace(/[^\d]/g, ''); setEditForm({ ...editForm, unitsPerBox: val }) }} />
          <label className="inline-flex items-center gap-2 md:col-span-2">
            <input type="checkbox" className="rounded" checked={!!editForm.weighable} onChange={e => setEditForm({ ...editForm, weighable: e.target.checked })} />
            <span>Es producto pesable</span>
          </label>
          <Select label="Lista" value={selectedListId} onChange={e => setSelectedListId(e.target.value)} className="md:col-span-2" helper="Seleccioná una lista para editar el precio de este producto">
            <option value="">-- Sin lista --</option>
            {priceLists.map(l => <option key={l.id} value={String(l.id)}>{l.name} ({l.currency})</option>)}
          </Select>
          {selectedListId ? (
            <Select label="Variante" value={editForm.variant || selectedVariant} onChange={e => setEditForm({ ...editForm, variant: e.target.value })}>
              <option value="unidad">Unidad</option>
              <option value="caja">Caja</option>
              <option value="mayor">Mayorista</option>
            </Select>
          ) : null}
          {selectedListId ? (
            <>
              <Input label="Precio (lista seleccionada)" type="text" value={editForm.price} onChange={e => {
                let val = e.target.value || ''
                // Mapear punto del teclado numérico a coma y limitar caracteres
                val = val.replace(/\./g, ',')
                val = val.replace(/[^\d,]/g, '')
                // Permitir solo una coma
                val = val.replace(/(,.*),/, '$1')
                setEditForm({ ...editForm, price: val })
              }} helper={editErrors.price} className={editErrors.price ? 'border-red-500 focus:ring-red-500 focus:border-red-500' : ''} />
              {(() => {
                const units = parseInt((editForm.unitsPerBox || '0'), 10)
                const variant = editForm.variant || selectedVariant
                const priceNum = parseMoney(editForm.price)
                if (units > 0 && !isNaN(priceNum)) {
                  const isUnit = variant === 'unidad'
                  const suggestion = isUnit ? (priceNum * units) : (priceNum / units)
                  const label = isUnit ? 'Sugerencia precio por caja' : 'Sugerencia precio por unidad'
                  return (
                    <div className="text-sm text-slate-600 flex items-center gap-2">
                      <span>{label}: {formatMoney(suggestion)}</span>
                      <Button type="button" variant="outline" size="sm" onClick={() => setEditForm({ ...editForm, price: formatMoney(suggestion) })}>Usar sugerencia</Button>
                    </div>
                  )
                }
                return null
              })()}
            </>
          ) : (
            <Badge variant="default" className="md:col-span-2">ℹ️ Seleccioná una lista para editar precios</Badge>
          )}
        </div>
      </Modal>
      <Modal
        isOpen={deleteOpen}
        title="Eliminar producto"
        onClose={() => setDeleteOpen(false)}
        footer={(
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setDeleteOpen(false)}>Cancelar</Button>
            <Button variant="danger" onClick={performDelete}>Eliminar</Button>
          </div>
        )}
      >
<p className="text-slate-700">¿Deseás eliminar este producto? Se eliminarán también sus precios asociados. Si el producto está usado en facturas, no se podrá eliminar.</p>
      </Modal>
      <Modal
        isOpen={resetAllOpen}
        title="Borrar todo y empezar de nuevo"
        onClose={() => setResetAllOpen(false)}
        footer={(
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setResetAllOpen(false)}>Cancelar</Button>
            <Button variant="warning" disabled={confirmResetAllText !== 'BORRAR'} onClick={performResetAll}>Borrar todo</Button>
          </div>
        )}
      >
        <p className="text-slate-700">Esto eliminará clientes, productos, listas, precios, facturas, ítems y movimientos locales. Si la nube está configurada y hay sesión, también se borrarán los datos del propietario en Supabase.</p>
        <div className="mt-3">
          <label className="block text-sm">Escribí BORRAR para confirmar</label>
          <input type="text" className="mt-1 w-full border rounded px-3 py-2" value={confirmResetAllText} onChange={e => setConfirmResetAllText(e.target.value)} />
        </div>
      </Modal>
      <Modal
        isOpen={deleteAllOpen}
        title="Borrar todos los productos"
        onClose={() => setDeleteAllOpen(false)}
        footer={(
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setDeleteAllOpen(false)}>Cancelar</Button>
            <Button variant="danger" disabled={confirmDeleteAllText !== 'BORRAR'} onClick={performDeleteAll}>Borrar todos</Button>
          </div>
        )}
      >
        <p className="text-slate-700">Esta acción elimina todos los productos y sus precios asociados. Las facturas existentes no se modifican.</p>
        <div className="mt-3">
          <label className="block text-sm">Escribí BORRAR para confirmar</label>
          <input type="text" className="mt-1 w-full border rounded px-3 py-2" value={confirmDeleteAllText} onChange={e => setConfirmDeleteAllText(e.target.value)} />
        </div>
      </Modal>
    </div>
  )
}
