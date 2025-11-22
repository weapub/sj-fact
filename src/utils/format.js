export function formatMoney(n) {
  if (n === null || n === undefined || n === '') return '0,00'
  const num = typeof n === 'number' ? n : Number(n)
  if (isNaN(num)) return String(n)
  try {
    return new Intl.NumberFormat('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(num)
  } catch {
    return num.toFixed(2).replace('.', ',')
  }
}

export function parseMoney(raw) {
  if (raw == null) return NaN
  let s = String(raw).trim()
  if (!s) return NaN
  s = s.replace(/[$€£\s]/g, '')
  if (/,/.test(s) && /\./.test(s)) {
    s = s.replace(/\./g, '')
    s = s.replace(/,/g, '.')
  } else if (/,/.test(s)) {
    s = s.replace(/,/g, '.')
  }
  const n = parseFloat(s)
  return isNaN(n) ? NaN : n
}