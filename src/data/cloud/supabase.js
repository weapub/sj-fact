import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

export const supabase = (url && anonKey) ? createClient(url, anonKey) : null

export function isSupabaseConfigured() {
  return !!(url && anonKey)
}

export async function pushAll(data) {
  if (!isSupabaseConfigured() || !supabase) {
    throw new Error('Supabase no configurado. Agregue VITE_SUPABASE_URL y VITE_SUPABASE_ANON_KEY')
  }
  const { data: userData } = await supabase.auth.getUser()
  const user = userData?.user
  if (!user) {
    throw new Error('Debe iniciar sesión para sincronizar')
  }
  const ownerId = user.id
  const tableMap = {
    customers: 'customers',
    products: 'products',
    priceLists: 'pricelists',
    prices: 'prices',
    invoices: 'invoices',
    invoiceItems: 'invoiceitems',
    ledger: 'ledger',
  }
  const toRemote = {
    customers: (r) => ({ id: r.id, name: r.name, taxid: r.taxId, email: r.email, owner: r.owner ?? ownerId }),
    // Para products NO enviamos 'id' cuando usamos conflicto por 'sku',
    // para evitar choques con el PK remoto.
    products: (r) => ({ name: r.name, sku: r.sku, owner: r.owner ?? ownerId }),
    priceLists: (r) => ({ id: r.id, name: r.name, currency: r.currency, owner: r.owner ?? ownerId }),
    // Para prices no enviamos 'id' y hacemos upsert por (listid, productid)
    prices: (r) => ({ listid: r.listId, productid: r.productId, price: r.price }),
    invoices: (r) => ({ id: r.id, number: r.number, customerid: r.customerId, date: r.date, total: r.total, owner: r.owner ?? ownerId }),
    invoiceItems: (r) => ({ id: r.id, invoiceid: r.invoiceId, productid: r.productId, qty: r.qty, unitprice: r.unitPrice, total: r.total, owner: r.owner ?? ownerId }),
    ledger: (r) => ({ id: r.id, customerid: r.customerId, date: r.date, type: r.type, amount: r.amount, reference: r.reference, owner: r.owner ?? ownerId }),
  }
  // Construir colecciones mapeadas para cada tabla
  const mapped = Object.fromEntries(
    Object.keys(tableMap).map(k => [k, (data[k] ?? []).map(r => toRemote[k](r))])
  )
  // Contadores de resumen
  let filteredInvoiceItems = 0
  let filteredPrices = 0
  let remappedItemsChanged = 0
  let remappedPricesChanged = 0
  let normalizedCounts = {
    prices: 0,
    invoiceItems: 0,
    invoices: 0,
    ledger: 0,
    clamped: 0,
    invalidFiltered: 0,
  }
  const dedupCounts = {
    products: 0,
    prices: 0,
    invoiceItems: 0,
    ledger: 0,
  }

  const dedupBy = (arr, keySelector) => {
    const map = new Map()
    let removed = 0
    for (const r of (arr ?? [])) {
      const k = keySelector(r)
      if (k === undefined || k === null || k === '') {
        // Sin clave: no deduplicar
        map.set(Symbol('no-key'), r)
        continue
      }
      if (map.has(k)) removed++
      map.set(k, r) // último gana
    }
    return { arr: Array.from(map.values()), removed }
  }

  // 1) Subir tablas base primero (sin dependencias FK)
  for (const localKey of ['customers', 'products', 'priceLists', 'invoices']) {
    const remoteTable = tableMap[localKey]
    let arr = mapped[localKey]
    if (!arr || arr.length === 0) continue
    if (localKey === 'products') {
      // Deduplicar por (owner, sku) para que el upsert no afecte dos veces a la misma fila
      const d = dedupBy(arr, (r) => r.sku ? `${r.owner}|${r.sku}` : undefined)
      arr = d.arr
      dedupCounts.products += d.removed
      // Intento principal: conflicto compuesto por owner,sku
      let { error } = await supabase.from(remoteTable).upsert(arr, { onConflict: 'owner,sku' })
      // Compatibilidad: si el esquema remoto no tiene unique (owner, sku), reintentar con 'sku'
      if (error && /no unique|exclusion constraint/i.test(error.message || '')) {
        // Deduplicar por sku para el caso de conflicto simple
        const dSku = dedupBy(arr, (r) => r.sku ? r.sku : undefined)
        const retry = await supabase.from(remoteTable).upsert(dSku.arr, { onConflict: 'sku' })
        if (retry.error) throw retry.error
      } else if (error) {
        throw error
      }
    } else {
      const { error } = await supabase.from(remoteTable).upsert(arr, { onConflict: 'id' })
      if (error) throw error
    }
  }

  // Tras subir productos sin 'id', necesitamos mapear productId local -> remoto
  // para poder subir precios e invoiceItems correctamente.
  const localProdKeyById = new Map((data.products ?? []).map(p => {
    const sku = (p.sku || '').trim()
    const name = (p.name || '').trim().toLowerCase()
    const key = sku ? `SKU:${sku}` : `NAME:${name}`
    return [p.id, key]
  }))
  const { data: remoteProds, error: rpErr } = await supabase.from('products').select('id, sku, name')
  if (rpErr) throw rpErr
  const remoteIdByKey = new Map((remoteProds ?? []).map(p => {
    const sku = (p.sku || '').trim()
    const name = (p.name || '').trim().toLowerCase()
    const key = sku ? `SKU:${sku}` : `NAME:${name}`
    return [key, p.id]
  }))
  const remapProductId = (arr) => {
    let changed = 0
    const out = (arr ?? []).map(r => {
      const key = localProdKeyById.get(r.productid)
      const remoteId = key ? remoteIdByKey.get(key) : null
      if (remoteId && remoteId !== r.productid) {
        changed++
        return { ...r, productid: remoteId }
      }
      return r
    })
    return { arr: out, changed }
  }
  const remapPrices = remapProductId(mapped.prices)
  mapped.prices = remapPrices.arr
  remappedPricesChanged = remapPrices.changed
  const remapItems = remapProductId(mapped.invoiceItems)
  mapped.invoiceItems = remapItems.arr
  remappedItemsChanged = remapItems.changed

  // Normalización defensiva de campos numéricos para evitar overflow en numeric(12,2)/(12,3)
  const normalizeNumber = (val, precision, scale) => {
    if (val === null || val === undefined) return { ok: false, value: 0 }
    let v = val
    // Intentar parsear strings con formato local (p.ej. "1.234,56")
    if (typeof v === 'string') {
      const s = v.trim()
      if (!s) return { ok: false, value: 0 }
      // Elimina espacios y separadores no numéricos
      let t = s.replace(/[^0-9,.-]/g, '')
      // Si contiene coma y punto, asume coma decimal y punto miles
      if (t.includes(',') && t.includes('.')) {
        t = t.replace(/\./g, '').replace(/,/g, '.')
      } else if (t.includes(',')) {
        // Solo coma: cámbiala por punto
        t = t.replace(/,/g, '.')
      }
      v = parseFloat(t)
    }
    if (typeof v !== 'number' || Number.isNaN(v) || !Number.isFinite(v)) {
      return { ok: false, value: 0 }
    }
    // Redondeo a la escala
    const factor = Math.pow(10, scale)
    let rounded = Math.round(v * factor) / factor
    // Clamp según precisión
    const maxIntDigits = precision - scale
    const maxInt = Math.pow(10, maxIntDigits) - 1
    const maxAbs = maxInt
    let clamped = false
    if (Math.abs(rounded) > maxAbs) {
      rounded = Math.sign(rounded) * maxAbs
      clamped = true
    }
    return { ok: true, value: rounded, clamped }
  }

  // Aplica normalización por tabla
  if ((mapped.prices ?? []).length > 0) {
    mapped.prices = mapped.prices.map(r => {
      const n = normalizeNumber(r.price, 12, 2)
      if (n.ok) {
        if (n.clamped) normalizedCounts.clamped++
        if (n.value !== r.price) normalizedCounts.prices++
        return { ...r, price: n.value }
      } else {
        normalizedCounts.invalidFiltered++
        return { ...r, price: 0 }
      }
    })
  }

  if ((mapped.invoiceItems ?? []).length > 0) {
    mapped.invoiceItems = mapped.invoiceItems.map(r => {
      const nq = normalizeNumber(r.qty, 12, 3)
      const nu = normalizeNumber(r.unitprice, 12, 2)
      const nt = normalizeNumber(r.total, 12, 2)
      let rr = { ...r }
      if (nq.ok) { if (nq.clamped) normalizedCounts.clamped++; if (rr.qty !== nq.value) normalizedCounts.invoiceItems++; rr.qty = nq.value } else { normalizedCounts.invalidFiltered++; rr.qty = 0 }
      if (nu.ok) { if (nu.clamped) normalizedCounts.clamped++; if (rr.unitprice !== nu.value) normalizedCounts.invoiceItems++; rr.unitprice = nu.value } else { normalizedCounts.invalidFiltered++; rr.unitprice = 0 }
      if (nt.ok) { if (nt.clamped) normalizedCounts.clamped++; if (rr.total !== nt.value) normalizedCounts.invoiceItems++; rr.total = nt.value } else { normalizedCounts.invalidFiltered++; rr.total = (rr.qty * rr.unitprice) }
      return rr
    })
  }

  if ((mapped.invoices ?? []).length > 0) {
    mapped.invoices = mapped.invoices.map(r => {
      const nt = normalizeNumber(r.total, 12, 2)
      let rr = { ...r }
      if (nt.ok) { if (nt.clamped) normalizedCounts.clamped++; if (rr.total !== nt.value) normalizedCounts.invoices++; rr.total = nt.value } else { normalizedCounts.invalidFiltered++; rr.total = 0 }
      // number: asegure int
      if (typeof rr.number === 'string') {
        const nstr = rr.number.replace(/[^0-9-]/g, '')
        const num = parseInt(nstr || '0', 10)
        rr.number = Number.isFinite(num) ? num : 0
      }
      return rr
    })
  }

  if ((mapped.ledger ?? []).length > 0) {
    mapped.ledger = mapped.ledger.map(r => {
      const na = normalizeNumber(r.amount, 12, 2)
      let rr = { ...r }
      if (na.ok) { if (na.clamped) normalizedCounts.clamped++; if (rr.amount !== na.value) normalizedCounts.ledger++; rr.amount = na.value } else { normalizedCounts.invalidFiltered++; rr.amount = 0 }
      return rr
    })
  }

  // Verificaciones de integridad referencial para colecciones con claves foráneas
  // Ayuda a detectar y reportar IDs faltantes antes de intentar insertar detalles.
  const fetchIds = async (table) => {
    const { data, error } = await supabase.from(table).select('id')
    if (error) throw error
    return new Set((data ?? []).map(r => r.id))
  }

  // invoiceItems requiere invoices.id y products.id
  if ((mapped.invoiceItems ?? []).length > 0) {
    const productIds = await fetchIds('products')
    const invoiceIds = await fetchIds('invoices')
    const mappedItems = mapped.invoiceItems
    // Filtrar cualquier item con referencias faltantes para no romper la sync.
    const validItems = mappedItems.filter(r => productIds.has(r.productid) && invoiceIds.has(r.invoiceid))
    filteredInvoiceItems = mappedItems.length - validItems.length
    mapped.invoiceItems = validItems
  }

  // prices requiere products.id y pricelists.id
  if ((mapped.prices ?? []).length > 0) {
    const productIds = await fetchIds('products')
    const listIds = await fetchIds('pricelists')
    const mappedPrices = mapped.prices
    // Filtrar precios con referencias faltantes
    const validPrices = mappedPrices.filter(r => productIds.has(r.productid) && listIds.has(r.listid))
    filteredPrices = mappedPrices.length - validPrices.length
    // Deduplicar por (listid,productid)
    const d = dedupBy(validPrices, (r) => (r.listid && r.productid) ? `${r.listid}|${r.productid}` : undefined)
    dedupCounts.prices += d.removed
    mapped.prices = d.arr
  }

  // ledger requiere customers.id
  if ((mapped.ledger ?? []).length > 0) {
    const customerIds = await fetchIds('customers')
    const mappedLedger = mapped.ledger
    const missingCust = [...new Set(mappedLedger.filter(r => !customerIds.has(r.customerid)).map(r => r.customerid))]
    if (missingCust.length) {
      throw new Error(`Referencias faltantes para ledger: customerid inexistente: ${missingCust.join(', ')}`)
    }
  }

  // 2) Subir tablas dependientes (ya validadas)
  for (const localKey of ['prices', 'invoiceItems', 'ledger']) {
    const remoteTable = tableMap[localKey]
    let arr = mapped[localKey]
    if (!arr || arr.length === 0) continue
    // Deduplicación por clave de conflicto
    if (localKey === 'prices') {
      const d = dedupBy(arr, (r) => (r.listid && r.productid) ? `${r.listid}|${r.productid}` : undefined)
      dedupCounts.prices += d.removed
      arr = d.arr
    } else if (localKey === 'invoiceItems') {
      const d = dedupBy(arr, (r) => r.id ?? undefined)
      dedupCounts.invoiceItems += d.removed
      arr = d.arr
    } else if (localKey === 'ledger') {
      const d = dedupBy(arr, (r) => r.id ?? undefined)
      dedupCounts.ledger += d.removed
      arr = d.arr
    }
    // Upsert de prices por clave natural (listid,productid) para evitar el único
    const conflict = localKey === 'prices' ? 'listid,productid' : 'id'
    const { error } = await supabase.from(remoteTable).upsert(arr, { onConflict: conflict })
    if (error) throw error
  }

  // Devolver resumen de omisiones y remapeos
  return {
    filtered: {
      invoiceItems: filteredInvoiceItems,
      prices: filteredPrices,
      invalidNumeric: normalizedCounts.invalidFiltered,
    },
    remapped: {
      invoiceItems: remappedItemsChanged,
      prices: remappedPricesChanged,
    },
    deduplicated: {
      products: dedupCounts.products,
      prices: dedupCounts.prices,
      invoiceItems: dedupCounts.invoiceItems,
      ledger: dedupCounts.ledger,
    },
    normalized: {
      prices: normalizedCounts.prices,
      invoiceItems: normalizedCounts.invoiceItems,
      invoices: normalizedCounts.invoices,
      ledger: normalizedCounts.ledger,
      clamped: normalizedCounts.clamped,
    }
  }
}

export async function pullAll() {
  if (!isSupabaseConfigured() || !supabase) {
    throw new Error('Supabase no configurado. Agregue VITE_SUPABASE_URL y VITE_SUPABASE_ANON_KEY')
  }
  const tableMap = {
    customers: 'customers',
    products: 'products',
    priceLists: 'pricelists',
    prices: 'prices',
    invoices: 'invoices',
    invoiceItems: 'invoiceitems',
    ledger: 'ledger',
  }
  const fromRemote = {
    customers: (r) => ({ id: r.id, name: r.name, taxId: r.taxid, email: r.email, owner: r.owner }),
    products: (r) => ({ id: r.id, name: r.name, sku: r.sku, owner: r.owner }),
    priceLists: (r) => ({ id: r.id, name: r.name, currency: r.currency, owner: r.owner }),
    prices: (r) => ({ id: r.id, listId: r.listid, productId: r.productid, price: r.price, owner: r.owner }),
    invoices: (r) => ({ id: r.id, number: r.number, customerId: r.customerid, date: r.date, total: r.total, owner: r.owner }),
    invoiceItems: (r) => ({ id: r.id, invoiceId: r.invoiceid, productId: r.productid, qty: r.qty, unitPrice: r.unitprice, total: r.total, owner: r.owner }),
    ledger: (r) => ({ id: r.id, customerId: r.customerid, date: r.date, type: r.type, amount: r.amount, reference: r.reference, owner: r.owner }),
  }
  const result = {}
  for (const [localKey, remoteTable] of Object.entries(tableMap)) {
    const { data, error } = await supabase.from(remoteTable).select('*')
    if (error) throw error
    result[localKey] = (data ?? []).map(r => fromRemote[localKey](r))
  }
  return result
}

export async function getUser() {
  if (!supabase) return null
  const { data } = await supabase.auth.getUser()
  return data.user ?? null
}

export async function signIn({ email, password }) {
  if (!supabase) throw new Error('Supabase no configurado')
  const { data, error } = await supabase.auth.signInWithPassword({ email, password })
  if (error) throw error
  return data.user
}

export async function signOut() {
  if (!supabase) throw new Error('Supabase no configurado')
  const { error } = await supabase.auth.signOut()
  if (error) throw error
}

export async function signUp({ email, password }) {
  if (!supabase) throw new Error('Supabase no configurado')
  const { data, error } = await supabase.auth.signUp({ email, password })
  if (error) throw error
  return data.user
}

export async function sendPasswordReset(email) {
  if (!supabase) throw new Error('Supabase no configurado')
  const redirectTo = window.location.origin
  const { data, error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo })
  if (error) throw error
  return data
}

export async function updatePassword(newPassword) {
  if (!supabase) throw new Error('Supabase no configurado')
  const { data, error } = await supabase.auth.updateUser({ password: newPassword })
  if (error) throw error
  return data.user
}

export async function resendEmailConfirmation(email) {
  if (!supabase) throw new Error('Supabase no configurado')
  const redirectTo = window.location.origin
  const { data, error } = await supabase.auth.resend({ type: 'signup', email, options: { redirectTo } })
  if (error) throw error
  return data
}

export async function deleteProductsAndPricesByKeys({ skus = [], names = [] }) {
  if (!isSupabaseConfigured() || !supabase) {
    throw new Error('Supabase no configurado. Agregue VITE_SUPABASE_URL y VITE_SUPABASE_ANON_KEY')
  }
  const { data: userData } = await supabase.auth.getUser()
  const user = userData?.user
  if (!user) throw new Error('Debe iniciar sesión para sincronizar')
  const ownerId = user.id
  const cleanSkus = (skus || []).map(s => (s || '').trim()).filter(Boolean)
  const cleanNames = (names || []).map(n => (n || '').trim().toLowerCase()).filter(Boolean)
  if (cleanSkus.length === 0 && cleanNames.length === 0) return { deletedProducts: 0, deletedPrices: 0 }
  // Buscar productos remotos por owner + sku o nombre
  let query = supabase.from('products').select('id, sku, name').eq('owner', ownerId)
  if (cleanSkus.length > 0) query = query.in('sku', cleanSkus)
  const { data: bySku, error: errSku } = await query
  if (errSku) throw errSku
  let remote = bySku || []
  if (cleanNames.length > 0) {
    // Agregar productos por nombre que no tengan SKU (o no coincidan por SKU)
    const { data: byName, error: errName } = await supabase.from('products').select('id, sku, name').eq('owner', ownerId)
    if (errName) throw errName
    const nameSet = new Set(cleanNames)
    const already = new Set((remote || []).map(r => r.id))
    for (const r of (byName || [])) {
      const nm = (r.name || '').trim().toLowerCase()
      if (nameSet.has(nm) && !already.has(r.id)) remote.push(r)
    }
  }
  const ids = (remote || []).map(r => r.id).filter(Boolean)
  if (ids.length === 0) return { deletedProducts: 0, deletedPrices: 0 }
  const { error: delPricesErr, count: pricesCount } = await supabase.from('prices').delete({ count: 'exact' }).in('productid', ids)
  if (delPricesErr) throw delPricesErr
  const { error: delProdsErr, count: prodsCount } = await supabase.from('products').delete({ count: 'exact' }).in('id', ids)
  if (delProdsErr) throw delProdsErr
  return { deletedProducts: prodsCount || 0, deletedPrices: pricesCount || 0 }
}

export async function deleteAllOwnerData() {
  if (!isSupabaseConfigured() || !supabase) {
    throw new Error('Supabase no configurado. Agregue VITE_SUPABASE_URL y VITE_SUPABASE_ANON_KEY')
  }
  const { data: userData } = await supabase.auth.getUser()
  const user = userData?.user
  if (!user) throw new Error('Debe iniciar sesión para sincronizar')
  const ownerId = user.id
  // Obtener ids relacionados
  const { data: prodRows, error: prodErr } = await supabase.from('products').select('id').eq('owner', ownerId)
  if (prodErr) throw prodErr
  const productIds = (prodRows ?? []).map(r => r.id)
  const { data: listRows, error: listErr } = await supabase.from('pricelists').select('id').eq('owner', ownerId)
  if (listErr) throw listErr
  const listIds = (listRows ?? []).map(r => r.id)
  const { data: invRows, error: invErr } = await supabase.from('invoices').select('id').eq('owner', ownerId)
  if (invErr) throw invErr
  const invoiceIds = (invRows ?? []).map(r => r.id)
  // Borrar dependientes primero
  if (productIds.length) {
    const delPricesByProd = await supabase.from('prices').delete({ count: 'exact' }).in('productid', productIds)
    if (delPricesByProd.error) throw delPricesByProd.error
    const delItemsByProd = await supabase.from('invoiceitems').delete({ count: 'exact' }).in('productid', productIds)
    if (delItemsByProd.error) throw delItemsByProd.error
  }
  if (listIds.length) {
    const delPricesByList = await supabase.from('prices').delete({ count: 'exact' }).in('listid', listIds)
    if (delPricesByList.error) throw delPricesByList.error
  }
  if (invoiceIds.length) {
    const delItemsByInv = await supabase.from('invoiceitems').delete({ count: 'exact' }).in('invoiceid', invoiceIds)
    if (delItemsByInv.error) throw delItemsByInv.error
  }
  const delLedger = await supabase.from('ledger').delete({ count: 'exact' }).eq('owner', ownerId)
  if (delLedger.error) throw delLedger.error
  const delInvoices = await supabase.from('invoices').delete({ count: 'exact' }).eq('owner', ownerId)
  if (delInvoices.error) throw delInvoices.error
  const delLists = await supabase.from('pricelists').delete({ count: 'exact' }).eq('owner', ownerId)
  if (delLists.error) throw delLists.error
  const delProducts = await supabase.from('products').delete({ count: 'exact' }).eq('owner', ownerId)
  if (delProducts.error) throw delProducts.error
  const delCustomers = await supabase.from('customers').delete({ count: 'exact' }).eq('owner', ownerId)
  if (delCustomers.error) throw delCustomers.error
  return {
    deleted: {
      customers: delCustomers.count || 0,
      products: delProducts.count || 0,
      priceLists: delLists.count || 0,
      invoices: delInvoices.count || 0,
      ledger: delLedger.count || 0,
    }
  }
}