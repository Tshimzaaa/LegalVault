import type { AnnouncementSeverity } from '../../api/announcements'
import type { InquiryKind, InquiryStatus } from '../../api/inquiries'

export type LoadState = 'loading' | 'error' | 'ready'

export const dateTimeFormat = new Intl.DateTimeFormat(undefined, {
  year: 'numeric',
  month: 'short',
  day: 'numeric',
  hour: 'numeric',
  minute: '2-digit',
})
export const hourFormat = new Intl.DateTimeFormat(undefined, { hour: 'numeric' })
export const timeFormat = new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit', second: '2-digit' })
export const numberFormat = new Intl.NumberFormat()

export const severityColor: Record<AnnouncementSeverity, string> = {
  info: '#3987e5',
  warning: 'var(--warning)',
  critical: 'var(--danger)',
}

// rgb triples so a translucent badge background can be composed with rgba(); appending a hex
// alpha to a var(--token) string is invalid CSS.
export const severityColorRgb: Record<AnnouncementSeverity, string> = {
  info: '57, 135, 229',
  warning: 'var(--warning-rgb)',
  critical: 'var(--danger-rgb)',
}

export type HealthKey = 'operational' | 'degraded' | 'down' | 'healthy'

export const healthStatusColor: Record<HealthKey, string> = {
  operational: 'var(--accent)',
  healthy: 'var(--accent)',
  degraded: 'var(--warning)',
  down: 'var(--danger)',
}

export const healthStatusColorRgb: Record<HealthKey, string> = {
  operational: 'var(--accent-rgb)',
  healthy: 'var(--accent-rgb)',
  degraded: 'var(--warning-rgb)',
  down: 'var(--danger-rgb)',
}

export const healthStatusLabel: Record<HealthKey, string> = {
  operational: 'Operational',
  healthy: 'Healthy',
  degraded: 'Degraded',
  down: 'Down',
}

export function formatUptime(seconds: number): string {
  const days = Math.floor(seconds / 86400)
  const hours = Math.floor((seconds % 86400) / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)
  if (days > 0) return `${days}d ${hours}h`
  if (hours > 0) return `${hours}h ${minutes}m`
  if (minutes > 0) return `${minutes}m`
  return `${Math.floor(seconds)}s`
}

export function formatHour(iso: string): string {
  return hourFormat.format(new Date(iso))
}

export function relativeTime(iso: string, now: number = Date.now()): string {
  const diff = Math.max(0, now - new Date(iso).getTime())
  const minutes = Math.floor(diff / 60000)
  if (minutes < 1) return 'just now'
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  if (days < 7) return `${days}d ago`
  return new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric' }).format(new Date(iso))
}

export const inquiryStatusLabel: Record<InquiryStatus, string> = {
  new: 'New',
  in_progress: 'In progress',
  onboarded: 'Onboarded',
  closed: 'Closed',
}

export const inquiryKindLabel: Record<InquiryKind, string> = {
  access_request: 'Access request',
  contact: 'Contact message',
}

export function splitName(full: string): { first: string; last: string } {
  const parts = full.trim().split(/\s+/).filter(Boolean)
  if (parts.length <= 1) return { first: parts[0] ?? '', last: '' }
  return { first: parts[0], last: parts.slice(1).join(' ') }
}

const LOWER = 'abcdefghijkmnopqrstuvwxyz'
const UPPER = 'ABCDEFGHJKLMNPQRSTUVWXYZ'
const DIGITS = '23456789'
const SYMBOLS = '!@#$%&*?-_'

function randomInt(max: number): number {
  const limit = Math.floor(0x100000000 / max) * max
  const buf = new Uint32Array(1)
  do {
    crypto.getRandomValues(buf)
  } while (buf[0] >= limit)
  return buf[0] % max
}

function pick(chars: string): string {
  return chars[randomInt(chars.length)]
}

/** 16 characters with at least one lowercase, uppercase, digit and symbol; no look-alike characters. */
export function generatePassword(length = 16): string {
  const all = LOWER + UPPER + DIGITS + SYMBOLS
  const chars = [pick(LOWER), pick(UPPER), pick(DIGITS), pick(SYMBOLS)]
  while (chars.length < length) chars.push(pick(all))
  for (let i = chars.length - 1; i > 0; i--) {
    const j = randomInt(i + 1)
    ;[chars[i], chars[j]] = [chars[j], chars[i]]
  }
  return chars.join('')
}

export async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text)
    return true
  } catch {
    try {
      const ta = document.createElement('textarea')
      ta.value = text
      ta.setAttribute('readonly', '')
      ta.style.position = 'fixed'
      ta.style.opacity = '0'
      document.body.appendChild(ta)
      ta.select()
      const ok = document.execCommand('copy')
      ta.remove()
      return ok
    } catch {
      return false
    }
  }
}
