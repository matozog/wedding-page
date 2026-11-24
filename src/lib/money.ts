// Kwoty w PLN i daty terminów (kolumna date, "RRRR-MM-DD").

const plnFormat = new Intl.NumberFormat('pl-PL', { style: 'currency', currency: 'PLN' })
const plnShortFormat = new Intl.NumberFormat('pl-PL', {
  style: 'currency',
  currency: 'PLN',
  maximumFractionDigits: 0,
})
const amountInputFormat = new Intl.NumberFormat('pl-PL', {
  minimumFractionDigits: 0,
  maximumFractionDigits: 2,
  useGrouping: false,
})
const dateFormat = new Intl.DateTimeFormat('pl-PL', { day: 'numeric', month: 'short', year: 'numeric' })

export const formatPln = (value: number) => plnFormat.format(value)

// Bez groszy - kafelki i podsumowania.
export const formatPlnShort = (value: number) => plnShortFormat.format(value)

// Wartość do pola formularza: "1234,5".
export const formatAmountInput = (value: number | null) =>
  value === null ? '' : amountInputFormat.format(value)

// "1 234,56", "1234.56", "1 234 zł" -> 1234.56. Pusty tekst -> null,
// niepoprawny lub z więcej niż 2 miejscami po przecinku -> NaN.
export const parseAmount = (text: string): number | null => {
  const normalized = text.replace(/[\s ]/g, '').replace(/zł$/i, '').replace(',', '.')

  if (normalized === '') {
    return null
  }

  if (!/^\d+(\.\d{1,2})?$/.test(normalized)) {
    return Number.NaN
  }

  return Number(normalized)
}

// Dzisiejsza data lokalna w formacie kolumny date.
export const todayIso = (now = new Date()) => {
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const day = String(now.getDate()).padStart(2, '0')
  return `${now.getFullYear()}-${month}-${day}`
}

export const addDaysIso = (iso: string, days: number) => {
  const [year, month, day] = iso.split('-').map(Number)
  return todayIso(new Date(year, month - 1, day + days))
}

export const formatDate = (iso: string) => {
  const [year, month, day] = iso.split('-').map(Number)
  return dateFormat.format(new Date(year, month - 1, day))
}
