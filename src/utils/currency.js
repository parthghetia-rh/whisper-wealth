const symbols = {
  USD: '$',
  CAD: 'C$',
  INR: '₹',
  EUR: '€',
  GBP: '£',
  JPY: '¥',
  AUD: 'A$',
  HKD: 'HK$',
  SGD: 'S$',
  CHF: 'CHF ',
}

export function currencySymbol(code) {
  return symbols[code] || `${code} `
}

export function convertAmount(amount, from, to, rates) {
  if (from === to || !rates[from] || !rates[to]) return amount
  return (amount * rates[from]) / rates[to]
}

export function formatCurrency(amount, currencyCode) {
  const sym = currencySymbol(currencyCode)
  const isNegative = amount < 0
  const formatted = Math.abs(amount).toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
  return `${isNegative ? '-' : ''}${sym}${formatted}`
}
