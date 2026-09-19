import { useCallback, useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { deleteInquiry, listInquiries, updateInquiry } from '../../../api/owner'
import type { Inquiry } from '../../../api/owner'
import type { InquiryKind, InquiryStatus } from '../../../api/inquiries'
import { IconChevron, IconInbox, IconMail, IconTrash } from '../../../components/icons'
import { useOwnerData } from '../OwnerDataContext'
import OnboardDialog from '../OnboardDialog'
import { ErrorState, KindBadge, LoadingState, Page, StatusBadge } from '../ownerParts'
import { dateTimeFormat, inquiryStatusLabel, relativeTime } from '../ownerUtils'
import type { LoadState } from '../ownerUtils'

const PAGE_SIZE = 50
const POLL_MS = 60000

const STATUS_FILTERS: { key: InquiryStatus | 'all'; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'new', label: 'New' },
  { key: 'in_progress', label: 'In progress' },
  { key: 'onboarded', label: 'Onboarded' },
  { key: 'closed', label: 'Closed' },
]

const KIND_FILTERS: { key: InquiryKind | 'all'; label: string }[] = [
  { key: 'all', label: 'All types' },
  { key: 'access_request', label: 'Access requests' },
  { key: 'contact', label: 'Contact messages' },
]

function parseStatus(v: string | null): InquiryStatus | undefined {
  return v === 'new' || v === 'in_progress' || v === 'onboarded' || v === 'closed' ? v : undefined
}

function parseKind(v: string | null): InquiryKind | undefined {
  return v === 'access_request' || v === 'contact' ? v : undefined
}

function replaceItem(list: Inquiry[], next: Inquiry): Inquiry[] {
  return list.map((x) => (x.id === next.id ? next : x))
}

interface DetailProps {
  inquiry: Inquiry
  backTo: string
  onPatch: (inquiry: Inquiry, patch: { status?: InquiryStatus; owner_note?: string | null }) => Promise<boolean>
  onDelete: (inquiry: Inquiry) => void
  onOnboard: () => void
  headingRef: React.RefObject<HTMLHeadingElement | null>
  deleting: boolean
}

function InquiryDetail({ inquiry, backTo, onPatch, onDelete, onOnboard, headingRef, deleting }: DetailProps) {
  const [draft, setDraft] = useState(inquiry.owner_note ?? '')
  const [saved, setSaved] = useState(false)
  const [saving, setSaving] = useState(false)
  const dirty = draft !== (inquiry.owner_note ?? '')
  const firstName = inquiry.name.trim().split(/\s+/)[0] ?? ''
  const subject =
    inquiry.kind === 'access_request' ? 'Re: Your LegalVault access request' : 'Re: Your message to LegalVault'
  const mailto = `mailto:${inquiry.email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(`Hello ${firstName},\n\n`)}`
  const canOnboard = inquiry.kind === 'access_request' && inquiry.status !== 'onboarded'

  async function saveNote() {
    setSaving(true)
    setSaved(false)
    const ok = await onPatch(inquiry, { owner_note: draft.trim() ? draft : null })
    setSaving(false)
    setSaved(ok)
  }

  return (
    <article className="inq-detail" aria-labelledby="inq-detail-title">
      <Link to={backTo} className="inq-back">
        <IconChevron aria-hidden="true" /> Inquiries
      </Link>
      <header className="inq-detail-head">
        <h2 id="inq-detail-title" tabIndex={-1} ref={headingRef}>
          {inquiry.name}
        </h2>
        <div className="inq-badges">
          <KindBadge kind={inquiry.kind} />
          <StatusBadge status={inquiry.status} />
        </div>
      </header>

      <dl className="inq-meta">
        <div>
          <dt>Email</dt>
          <dd>
            <a href={`mailto:${inquiry.email}`}>{inquiry.email}</a>
          </dd>
        </div>
        <div>
          <dt>Phone</dt>
          <dd>{inquiry.phone ? <a href={`tel:${inquiry.phone.replace(/\s+/g, '')}`}>{inquiry.phone}</a> : <span className="muted">Not provided</span>}</dd>
        </div>
        <div>
          <dt>Firm</dt>
          <dd>{inquiry.organization_name ?? <span className="muted">Not provided</span>}</dd>
        </div>
        <div>
          <dt>Received</dt>
          <dd>
            <time dateTime={inquiry.created_at}>{dateTimeFormat.format(new Date(inquiry.created_at))}</time>
          </dd>
        </div>
        {inquiry.handled_at && (
          <div>
            <dt>Handled</dt>
            <dd>
              <time dateTime={inquiry.handled_at}>{dateTimeFormat.format(new Date(inquiry.handled_at))}</time>
            </dd>
          </div>
        )}
        <div>
          <dt>
            <label htmlFor="inq-status">Status</label>
          </dt>
          <dd>
            <select
              id="inq-status"
              className="select-input"
              value={inquiry.status}
              onChange={(e) => onPatch(inquiry, { status: e.target.value as InquiryStatus })}
            >
              {(Object.keys(inquiryStatusLabel) as InquiryStatus[]).map((s) => (
                <option key={s} value={s}>
                  {inquiryStatusLabel[s]}
                </option>
              ))}
            </select>
          </dd>
        </div>
      </dl>

      <section aria-labelledby="inq-message-h" className="inq-section">
        <h3 id="inq-message-h">Message</h3>
        {inquiry.message ? <p className="inq-message">{inquiry.message}</p> : <p className="muted">No message was included.</p>}
      </section>

      <section aria-labelledby="inq-note-h" className="inq-section">
        <h3 id="inq-note-h">Owner note</h3>
        <label className="field">
          <span className="sr-only">Owner note, private to you</span>
          <textarea
            rows={3}
            value={draft}
            placeholder="Private notes, follow-ups, what was agreed…"
            onChange={(e) => {
              setDraft(e.target.value)
              setSaved(false)
            }}
          />
        </label>
        <div className="inq-note-actions">
          <button type="button" className="btn-ghost" disabled={!dirty || saving} onClick={saveNote}>
            {saving ? 'Saving…' : 'Save note'}
          </button>
          <span className="inq-saved muted" role="status">
            {saved && !dirty ? 'Saved' : dirty ? 'Unsaved changes' : ''}
          </span>
        </div>
      </section>

      <section aria-labelledby="inq-actions-h" className="inq-section">
        <h3 id="inq-actions-h">Workflow</h3>
        <div className="inq-quick">
          {inquiry.status === 'new' && (
            <button type="button" className="btn-ghost" onClick={() => onPatch(inquiry, { status: 'in_progress' })}>
              Mark in progress
            </button>
          )}
          {(inquiry.status === 'new' || inquiry.status === 'in_progress') && (
            <button type="button" className="btn-ghost" onClick={() => onPatch(inquiry, { status: 'closed' })}>
              Close
            </button>
          )}
          {inquiry.status === 'closed' && (
            <button type="button" className="btn-ghost" onClick={() => onPatch(inquiry, { status: 'in_progress' })}>
              Reopen
            </button>
          )}
          {inquiry.status === 'onboarded' && inquiry.organization_id && (
            <Link to={`/owner/organizations`} className="btn-ghost">
              View organizations
            </Link>
          )}
          <button type="button" className="btn-ghost inq-delete" disabled={deleting} onClick={() => onDelete(inquiry)}>
            <IconTrash aria-hidden="true" /> Delete
          </button>
        </div>
      </section>

      <div className="inq-actionbar">
        {canOnboard && (
          <button type="button" className="btn-solid" onClick={onOnboard}>
            Onboard this firm
          </button>
        )}
        <a href={mailto} className={canOnboard ? 'btn-ghost inq-reply' : 'btn-solid inq-reply'}>
          <IconMail aria-hidden="true" /> Reply by email
        </a>
      </div>
    </article>
  )
}

function InquiriesView() {
  const { token, summary, refreshSummary } = useOwnerData()
  const navigate = useNavigate()
  const { id } = useParams()
  const [searchParams, setSearchParams] = useSearchParams()
  const statusFilter = parseStatus(searchParams.get('status'))
  const kindFilter = parseKind(searchParams.get('kind'))

  const [items, setItems] = useState<Inquiry[]>([])
  const [total, setTotal] = useState(0)
  const [state, setState] = useState<LoadState>('loading')
  const [loadingMore, setLoadingMore] = useState(false)
  const [actionError, setActionError] = useState<string | null>(null)
  const [extra, setExtra] = useState<Inquiry | null>(null)
  const [lookupDone, setLookupDone] = useState(false)
  const [onboardOpen, setOnboardOpen] = useState(false)
  const [deleting, setDeleting] = useState(false)

  const requestSeq = useRef(0)
  const itemsCount = useRef(0)
  const headingRef = useRef<HTMLHeadingElement>(null)
  const prevId = useRef<string | undefined>(undefined)

  useEffect(() => {
    itemsCount.current = items.length
  }, [items])

  const load = useCallback(
    (silent: boolean) => {
      if (!token) {
        setState('error')
        return
      }
      const seq = ++requestSeq.current
      if (!silent) setState('loading')
      listInquiries(token, {
        status: statusFilter,
        kind: kindFilter,
        limit: Math.max(PAGE_SIZE, silent ? itemsCount.current : 0),
        offset: 0,
      })
        .then((data) => {
          if (seq !== requestSeq.current) return
          setItems(data.items)
          setTotal(data.total)
          setState('ready')
        })
        .catch(() => {
          if (seq !== requestSeq.current) return
          if (!silent) setState('error')
        })
    },
    [token, statusFilter, kindFilter],
  )

  useEffect(() => {
    load(false)
  }, [load])

  useEffect(() => {
    const timer = window.setInterval(() => {
      if (!document.hidden) {
        load(true)
        refreshSummary()
      }
    }, POLL_MS)
    return () => window.clearInterval(timer)
  }, [load, refreshSummary])

  const fromList = id ? items.find((i) => i.id === id) : undefined
  const selected = fromList ?? (extra && extra.id === id ? extra : undefined)

  useEffect(() => {
    setLookupDone(false)
  }, [id])

  useEffect(() => {
    if (!id || state !== 'ready' || fromList || (extra && extra.id === id) || lookupDone || !token) return
    let cancelled = false
    listInquiries(token, { limit: 200 })
      .then((data) => {
        if (cancelled) return
        setExtra(data.items.find((i) => i.id === id) ?? null)
        setLookupDone(true)
      })
      .catch(() => {
        if (!cancelled) setLookupDone(true)
      })
    return () => {
      cancelled = true
    }
  }, [id, state, fromList, extra, lookupDone, token])

  useEffect(() => {
    if (id && selected) {
      headingRef.current?.focus()
    } else if (!id && prevId.current) {
      document.querySelector<HTMLElement>(`[data-inq-id="${prevId.current}"]`)?.focus()
    }
    prevId.current = id
  }, [id, selected?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  function setFilter(key: 'status' | 'kind', value: string) {
    setSearchParams(
      (prev) => {
        const params = new URLSearchParams(prev)
        if (value === 'all') params.delete(key)
        else params.set(key, value)
        return params
      },
      { replace: true },
    )
  }

  const query = searchParams.toString()
  const listPath = `/owner/inquiries${query ? `?${query}` : ''}`

  async function patchInquiry(
    inquiry: Inquiry,
    patch: { status?: InquiryStatus; owner_note?: string | null; organization_id?: string | null },
  ): Promise<boolean> {
    if (!token) return false
    setActionError(null)
    const optimistic = { ...inquiry, ...patch } as Inquiry
    setItems((prev) => replaceItem(prev, optimistic))
    setExtra(optimistic)
    try {
      const updated = await updateInquiry(token, inquiry.id, patch)
      setItems((prev) => replaceItem(prev, updated))
      setExtra(updated)
      refreshSummary()
      return true
    } catch (err) {
      setItems((prev) => replaceItem(prev, inquiry))
      setExtra(inquiry)
      setActionError(err instanceof Error ? err.message : 'Could not update this inquiry.')
      return false
    }
  }

  async function handleDelete(inquiry: Inquiry) {
    if (!token) return
    if (!window.confirm(`Delete the inquiry from ${inquiry.name}? This cannot be undone.`)) return
    setActionError(null)
    setDeleting(true)
    try {
      await deleteInquiry(token, inquiry.id)
      setItems((prev) => prev.filter((x) => x.id !== inquiry.id))
      setTotal((t) => Math.max(0, t - 1))
      setExtra(null)
      refreshSummary()
      navigate(listPath, { replace: true })
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Could not delete this inquiry.')
    } finally {
      setDeleting(false)
    }
  }

  async function loadMore() {
    if (!token) return
    setLoadingMore(true)
    try {
      const data = await listInquiries(token, {
        status: statusFilter,
        kind: kindFilter,
        limit: PAGE_SIZE,
        offset: items.length,
      })
      setItems((prev) => [...prev, ...data.items.filter((n) => !prev.some((p) => p.id === n.id))])
      setTotal(data.total)
    } catch {
      setActionError('Could not load more inquiries.')
    } finally {
      setLoadingMore(false)
    }
  }

  const counts: Record<string, number | undefined> = summary
    ? {
        all: summary.new + summary.in_progress + summary.onboarded + summary.closed,
        new: summary.new,
        in_progress: summary.in_progress,
        onboarded: summary.onboarded,
        closed: summary.closed,
      }
    : {}

  const filtered = !!statusFilter || !!kindFilter

  return (
    <Page
      title="Inquiries"
      rowHeader
      subtitle="Access requests and messages from the public site"
      className="owner-main--split"
      hideHeaderOnPhone={!!id}
      actions={
        <button type="button" className="btn-ghost" onClick={() => { load(true); refreshSummary() }}>
          Refresh
        </button>
      }
    >
      <p className="owner-live" role="alert" hidden={!actionError}>
        {actionError}
      </p>
      <div className={`inq-split${id ? ' has-detail' : ''}`}>
        <section className="card inq-list-pane" aria-label="Inquiry list">
          <div className="inq-filters">
            <div role="group" aria-label="Filter by status" className="inq-chips">
              {STATUS_FILTERS.map((f) => {
                const active = (statusFilter ?? 'all') === f.key
                return (
                  <button
                    key={f.key}
                    type="button"
                    className={`inq-chip${active ? ' active' : ''}`}
                    aria-pressed={active}
                    onClick={() => setFilter('status', f.key)}
                  >
                    {f.label}
                    {counts[f.key] !== undefined && <span className="inq-chip-count">{counts[f.key]}</span>}
                  </button>
                )
              })}
            </div>
            <label className="inq-kind-filter">
              <span className="sr-only">Filter by type</span>
              <select className="select-input" value={kindFilter ?? 'all'} onChange={(e) => setFilter('kind', e.target.value)}>
                {KIND_FILTERS.map((f) => (
                  <option key={f.key} value={f.key}>
                    {f.label}
                  </option>
                ))}
              </select>
            </label>
          </div>

          {state === 'loading' && <LoadingState label="Loading inquiries…" />}
          {state === 'error' && <ErrorState label="Couldn’t reach the backend for inquiries." onRetry={() => load(false)} />}
          {state === 'ready' && items.length === 0 && (
            <div className="inq-empty">
              <IconInbox aria-hidden="true" />
              <p>{filtered ? 'No inquiries match these filters.' : 'No inquiries yet.'}</p>
              <p className="muted">
                {filtered
                  ? 'Try a different status or type.'
                  : 'Access requests and contact messages from the public site will appear here.'}
              </p>
              {filtered && (
                <button type="button" className="btn-ghost" onClick={() => setSearchParams({}, { replace: true })}>
                  Clear filters
                </button>
              )}
            </div>
          )}
          {state === 'ready' && items.length > 0 && (
            <>
              <ul className="inq-list">
                {items.map((i) => (
                  <li key={i.id}>
                    <Link
                      to={`/owner/inquiries/${i.id}${query ? `?${query}` : ''}`}
                      data-inq-id={i.id}
                      className={`inq-item${i.id === id ? ' selected' : ''}${i.status === 'new' ? ' unread' : ''}`}
                      aria-current={i.id === id ? 'true' : undefined}
                    >
                      <span className="inq-item-top">
                        <span className="inq-item-name">{i.name}</span>
                        <time className="inq-item-time" dateTime={i.created_at}>
                          {relativeTime(i.created_at)}
                        </time>
                      </span>
                      <span className="inq-item-firm">{i.organization_name ?? i.email}</span>
                      <span className="inq-badges">
                        <KindBadge kind={i.kind} />
                        <StatusBadge status={i.status} />
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
              {items.length < total && (
                <div className="inq-more">
                  <button type="button" className="btn-ghost" onClick={loadMore} disabled={loadingMore}>
                    {loadingMore ? 'Loading…' : `Load more (${total - items.length} left)`}
                  </button>
                </div>
              )}
            </>
          )}
        </section>

        <section className="card inq-detail-pane" aria-label="Inquiry detail">
          {selected ? (
            <InquiryDetail
              key={selected.id}
              inquiry={selected}
              backTo={listPath}
              onPatch={patchInquiry}
              onDelete={handleDelete}
              onOnboard={() => setOnboardOpen(true)}
              headingRef={headingRef}
              deleting={deleting}
            />
          ) : id && state === 'ready' && lookupDone ? (
            <div className="inq-empty">
              <p>This inquiry could not be found.</p>
              <Link to={listPath} className="btn-ghost">
                Back to inquiries
              </Link>
            </div>
          ) : id ? (
            <LoadingState label="Loading inquiry…" />
          ) : (
            <div className="inq-empty inq-placeholder">
              <IconInbox aria-hidden="true" />
              <p>Select an inquiry to read it and take action.</p>
            </div>
          )}
        </section>
      </div>

      {onboardOpen && selected && (
        <OnboardDialog
          inquiry={selected}
          onClose={() => {
            setOnboardOpen(false)
            window.setTimeout(() => {
              const a = document.activeElement
              if (!a || a === document.body || (a as HTMLElement).id === 'main-content') headingRef.current?.focus()
            }, 0)
          }}
          onLinkInquiry={(inq, orgId) => patchInquiry(inq, { status: 'onboarded', organization_id: orgId })}
        />
      )}
    </Page>
  )
}

export default InquiriesView
