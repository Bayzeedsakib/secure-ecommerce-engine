const formatters = new Map<string, Intl.NumberFormat>()

export function formatMoney(cents: number, currency = 'usd'): string {
  const code = currency.toUpperCase()
  let formatter = formatters.get(code)
  if (!formatter) {
    formatter = new Intl.NumberFormat('en-US', { style: 'currency', currency: code })
    formatters.set(code, formatter)
  }
  return formatter.format(cents / 100)
}

export function formatDate(iso: string): string {
  return new Date(iso).toLocaleString('en-US', {
    dateStyle: 'medium',
    timeStyle: 'short',
  })
}
