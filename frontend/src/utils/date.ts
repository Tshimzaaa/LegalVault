const dateFormat = new Intl.DateTimeFormat(undefined, { year: 'numeric', month: 'short', day: 'numeric' })
const dateTimeFormat = new Intl.DateTimeFormat(undefined, {
  year: 'numeric',
  month: 'short',
  day: 'numeric',
  hour: 'numeric',
  minute: '2-digit',
})
const hourFormat = new Intl.DateTimeFormat(undefined, { hour: 'numeric' })

export function formatDate(iso: string): string {
  return dateFormat.format(new Date(iso))
}

export function formatDateTime(iso: string): string {
  return dateTimeFormat.format(new Date(iso))
}

export function formatHour(iso: string): string {
  return hourFormat.format(new Date(iso))
}
