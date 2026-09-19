import { useEffect, useId, useRef } from 'react'
import type { ReactNode } from 'react'
import { IconBuilding, IconCheckCircle, IconClock, IconMessageCircle, IconX } from '../../components/icons'
import type { InquiryKind, InquiryStatus } from '../../api/inquiries'
import { inquiryKindLabel, inquiryStatusLabel } from './ownerUtils'

export function LoadingState({ label }: { label: string }) {
  return (
    <div className="dash-state" role="status" aria-live="polite">
      <span className="dash-spinner" aria-hidden="true" />
      <p>{label}</p>
    </div>
  )
}

export function ErrorState({ label, onRetry }: { label: string; onRetry: () => void }) {
  return (
    <div className="dash-state" role="alert">
      <p>{label}</p>
      <button type="button" className="btn-ghost" onClick={onRetry}>
        Retry
      </button>
    </div>
  )
}

export function StatusBadge({ status }: { status: InquiryStatus }) {
  return (
    <span className={`inq-badge inq-status-${status}`}>
      {status === 'onboarded' ? <IconCheckCircle aria-hidden="true" /> : status === 'closed' ? <IconClock aria-hidden="true" /> : <span className="inq-dot" aria-hidden="true" />}
      {inquiryStatusLabel[status]}
    </span>
  )
}

export function KindBadge({ kind }: { kind: InquiryKind }) {
  return (
    <span className="inq-badge inq-kind">
      {kind === 'access_request' ? <IconBuilding aria-hidden="true" /> : <IconMessageCircle aria-hidden="true" />}
      {inquiryKindLabel[kind]}
    </span>
  )
}

interface PageProps {
  title: string
  subtitle?: string
  actions?: ReactNode
  className?: string
  hideHeaderOnPhone?: boolean
  /** Keep secondary header actions beside the title on phones instead of on their own row. */
  rowHeader?: boolean
  children: ReactNode
}

export function Page({ title, subtitle, actions, className = '', hideHeaderOnPhone, rowHeader, children }: PageProps) {
  return (
    <main className={`dash-main owner-main ${className}`}>
      <header className={`dash-topbar m-header owner-header${hideHeaderOnPhone ? ' hide-phone' : ''}${rowHeader ? ' owner-header--row' : ''}`}>
        <div className="owner-header-text">
          <h1>{title}</h1>
          {subtitle && <p className="owner-subtitle">{subtitle}</p>}
        </div>
        {actions && <div className="topbar-actions">{actions}</div>}
      </header>
      {children}
    </main>
  )
}

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'

interface ModalProps {
  title: string
  onClose: () => void
  children: ReactNode
  footer?: ReactNode
  wide?: boolean
}

/** Dialog that traps focus, closes on Escape, locks page scroll and returns focus to its opener. */
export function Modal({ title, onClose, children, footer, wide }: ModalProps) {
  const titleId = useId()
  const ref = useRef<HTMLDivElement>(null)
  const onCloseRef = useRef(onClose)

  useEffect(() => {
    onCloseRef.current = onClose
  })

  useEffect(() => {
    const opener = document.activeElement as HTMLElement | null
    const dialog = ref.current
    const first =
      dialog?.querySelector<HTMLElement>('[data-autofocus]') ??
      dialog?.querySelector<HTMLElement>('.owner-modal-body input, .owner-modal-body textarea, .owner-modal-body select') ??
      dialog?.querySelector<HTMLElement>('button')
    first?.focus()
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        e.stopPropagation()
        onCloseRef.current()
        return
      }
      if (e.key !== 'Tab' || !dialog) return
      const items = Array.from(dialog.querySelectorAll<HTMLElement>(FOCUSABLE)).filter((el) => el.offsetParent !== null || el === document.activeElement)
      if (items.length === 0) return
      const firstEl = items[0]
      const lastEl = items[items.length - 1]
      if (e.shiftKey && document.activeElement === firstEl) {
        e.preventDefault()
        lastEl.focus()
      } else if (!e.shiftKey && document.activeElement === lastEl) {
        e.preventDefault()
        firstEl.focus()
      }
    }
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('keydown', onKeyDown)
      document.body.style.overflow = prevOverflow
      if (opener && opener.isConnected) opener.focus()
      else document.getElementById('main-content')?.focus()
    }
  }, [])

  return (
    <div className="owner-modal-backdrop">
      <div ref={ref} role="dialog" aria-modal="true" aria-labelledby={titleId} className={`owner-modal${wide ? ' wide' : ''}`}>
        <div className="owner-modal-head">
          <h2 id={titleId}>{title}</h2>
          <button type="button" className="owner-modal-close" onClick={onClose} aria-label="Close dialog">
            <IconX aria-hidden="true" />
          </button>
        </div>
        <div className="owner-modal-body">{children}</div>
        {footer && <div className="owner-modal-foot">{footer}</div>}
      </div>
    </div>
  )
}
