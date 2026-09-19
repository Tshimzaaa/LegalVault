import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { listInquiries } from '../../../api/owner'
import type { Inquiry } from '../../../api/owner'
import { IconBuilding, IconCheckCircle, IconMessageCircle, IconPlus, IconShield } from '../../../components/icons'
import { useOwnerData } from '../OwnerDataContext'
import { ErrorState, KindBadge, LoadingState, Page, StatusBadge } from '../ownerParts'
import { healthStatusColor, healthStatusLabel, numberFormat, relativeTime } from '../ownerUtils'
import type { LoadState } from '../ownerUtils'

interface Attention {
  key: string
  to: string
  count?: number
  title: string
  detail: string
  tone: 'primary' | 'warn' | 'danger' | 'neutral'
  icon: React.ReactNode
}

function OverviewView() {
  const { token, orgs, orgsStatus, reloadOrgs, health, healthStatus, metrics, summary, refreshSummary } = useOwnerData()
  const [recent, setRecent] = useState<Inquiry[]>([])
  const [recentStatus, setRecentStatus] = useState<LoadState>('loading')

  const loadRecent = useCallback(() => {
    if (!token) {
      setRecentStatus('error')
      return
    }
    setRecentStatus('loading')
    listInquiries(token, { limit: 5 })
      .then((data) => {
        setRecent(data.items)
        setRecentStatus('ready')
      })
      .catch(() => setRecentStatus('error'))
  }, [token])

  useEffect(() => {
    loadRecent()
    refreshSummary()
  }, [loadRecent, refreshSummary])

  const suspended = orgs.filter((o) => !o.is_active).length
  const activeCount = orgs.length - suspended
  const unhealthyDeps = health ? health.dependencies.filter((d) => d.status !== 'healthy') : []
  const errorRate = health?.requests.error_rate_percent ?? 0
  const healthIssue = !!health && (health.status !== 'operational' || unhealthyDeps.length > 0)

  const attention: Attention[] = []
  if (summary && summary.new_access_requests > 0) {
    attention.push({
      key: 'access',
      to: '/owner/inquiries?status=new&kind=access_request',
      count: summary.new_access_requests,
      title: summary.new_access_requests === 1 ? 'New access request' : 'New access requests',
      detail: 'Firms waiting to be onboarded',
      tone: 'primary',
      icon: <IconBuilding aria-hidden="true" />,
    })
  }
  if (summary && summary.new_contact > 0) {
    attention.push({
      key: 'contact',
      to: '/owner/inquiries?status=new&kind=contact',
      count: summary.new_contact,
      title: summary.new_contact === 1 ? 'New contact message' : 'New contact messages',
      detail: 'Unread messages from the public site',
      tone: 'warn',
      icon: <IconMessageCircle aria-hidden="true" />,
    })
  }
  if (healthIssue && health) {
    const parts: string[] = []
    if (health.status !== 'operational') parts.push(`Platform ${healthStatusLabel[health.status].toLowerCase()}`)
    unhealthyDeps.forEach((d) => parts.push(`${d.name} ${healthStatusLabel[d.status].toLowerCase()}`))
    if (errorRate > 5) parts.push(`error rate ${errorRate.toFixed(2)}%`)
    attention.push({
      key: 'health',
      to: '/owner/health',
      title: 'Platform needs a look',
      detail: parts.join(', '),
      tone: 'danger',
      icon: <IconShield aria-hidden="true" />,
    })
  }
  if (suspended > 0) {
    attention.push({
      key: 'suspended',
      to: '/owner/organizations?status=suspended',
      count: suspended,
      title: suspended === 1 ? 'Suspended organization' : 'Suspended organizations',
      detail: 'Staff there cannot sign in',
      tone: 'neutral',
      icon: <IconBuilding aria-hidden="true" />,
    })
  }

  const attentionLoading = summary === null && orgsStatus === 'loading'

  const stats = [
    { label: 'Organizations', value: numberFormat.format(orgs.length), sub: `${numberFormat.format(activeCount)} active` },
    { label: 'Staff accounts', value: numberFormat.format(orgs.reduce((s, f) => s + f.staff_count, 0)), sub: 'across the platform' },
    { label: 'Contracts open', value: numberFormat.format(orgs.reduce((s, f) => s + f.contract_count, 0)), sub: 'across the platform' },
  ]

  return (
    <Page
      title="Overview"
      subtitle="What needs you right now"
      actions={
        <Link to="/owner/organizations/new" className="btn-solid">
          <IconPlus aria-hidden="true" /> Onboard organization
        </Link>
      }
    >
      <div className="owner-stack">
        <section aria-labelledby="attention-h" className="owner-attention">
          <h2 id="attention-h" className="owner-section-title">
            Needs attention
          </h2>
          {attentionLoading ? (
            <LoadingState label="Checking the platform…" />
          ) : attention.length === 0 ? (
            <div className="card owner-allclear">
              <IconCheckCircle aria-hidden="true" />
              <div>
                <strong>No new requests</strong>
                <p className="muted">
                  No unread inquiries, no suspended organizations{healthStatus === 'ready' ? ' and the platform is healthy.' : '.'}
                </p>
              </div>
              <Link to="/owner/inquiries" className="btn-ghost">
                Open inquiries
              </Link>
            </div>
          ) : (
            <ul className="owner-attention-grid">
              {attention.map((a, i) => (
                <li key={a.key} className={i === 0 && a.tone === 'primary' ? 'lead' : undefined}>
                  <Link to={a.to} className={`card owner-attention-card tone-${a.tone}`}>
                    <span className="owner-attention-icon">{a.icon}</span>
                    {a.count !== undefined && <span className="owner-attention-count tabular">{a.count}</span>}
                    <span className="owner-attention-text">
                      <strong>{a.title}</strong>
                      <span>{a.detail}</span>
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section aria-labelledby="numbers-h">
          <h2 id="numbers-h" className="owner-section-title">
            Platform at a glance
          </h2>
          {orgsStatus === 'error' ? (
            <ErrorState label="Couldn’t reach the backend for platform data." onRetry={reloadOrgs} />
          ) : (
            <div className="owner-stats m-stats">
              {stats.map((s) => (
                <div key={s.label} className="card owner-stat-card">
                  <span className="owner-stat-label">{s.label}</span>
                  <span className="stat-big">{orgsStatus === 'ready' ? s.value : '-'}</span>
                  <span className="stat-sub">{s.sub}</span>
                </div>
              ))}
              <div className="card owner-stat-card">
                <span className="owner-stat-label">Requests, 24h</span>
                <span className="stat-big">{health ? numberFormat.format(health.requests.total_requests) : '-'}</span>
                <span className="stat-sub">
                  {health ? `${health.active_users} active users` : healthStatus === 'error' ? 'Unavailable' : 'Loading'}
                </span>
              </div>
              <div className="card owner-stat-card">
                <span className="owner-stat-label">New firms, 30 days</span>
                <span className="stat-big">{metrics ? numberFormat.format(metrics.usage.new_orgs_last_30_days) : '-'}</span>
                <span className="stat-sub">{metrics ? `${metrics.usage.new_orgs_last_7_days} in the last 7 days` : 'Loading'}</span>
              </div>
            </div>
          )}
        </section>

        <div className="owner-two-col">
          <section className="card" aria-labelledby="recent-inq-h">
            <div className="card-header">
              <h2 id="recent-inq-h">Recent inquiries</h2>
              <Link to="/owner/inquiries" className="owner-link">
                View all
              </Link>
            </div>
            {recentStatus === 'loading' && <LoadingState label="Loading inquiries…" />}
            {recentStatus === 'error' && <ErrorState label="Couldn’t load inquiries." onRetry={loadRecent} />}
            {recentStatus === 'ready' && recent.length === 0 && (
              <p className="muted owner-table-empty">No inquiries yet. Requests from the public site will show up here.</p>
            )}
            {recentStatus === 'ready' && recent.length > 0 && (
              <ul className="owner-mini-list">
                {recent.map((i) => (
                  <li key={i.id}>
                    <Link to={`/owner/inquiries/${i.id}`} className="owner-mini-item">
                      <span className="owner-mini-main">
                        <strong>{i.name}</strong>
                        <span className="muted">{i.organization_name ?? i.email}</span>
                        <span className="inq-badges">
                          <KindBadge kind={i.kind} />
                          <StatusBadge status={i.status} />
                        </span>
                      </span>
                      <time className="muted owner-mini-time" dateTime={i.created_at}>
                        {relativeTime(i.created_at)}
                      </time>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <div className="owner-stack">
            <section className="card" aria-labelledby="status-h">
              <div className="card-header">
                <h2 id="status-h">Platform status</h2>
                <Link to="/owner/health" className="owner-link">
                  Details
                </Link>
              </div>
              {healthStatus === 'loading' && !health && <LoadingState label="Loading status…" />}
              {healthStatus === 'error' && !health && <p className="muted owner-table-empty">Status unavailable right now.</p>}
              {health && (
                <>
                  <p className="owner-status-line">
                    <span className="owner-health-dot" style={{ background: healthStatusColor[health.status] }} aria-hidden="true" />
                    <strong style={{ color: healthStatusColor[health.status] }}>{healthStatusLabel[health.status]}</strong>
                    <span className="muted">error rate {errorRate.toFixed(2)}%</span>
                  </p>
                  <ul className="owner-dep-list">
                    {health.dependencies.map((d) => (
                      <li key={d.name}>
                        <span>{d.name}</span>
                        <span style={{ color: healthStatusColor[d.status] }}>
                          {healthStatusLabel[d.status]}
                          {d.latency_ms != null ? ` · ${Math.round(d.latency_ms)}ms` : ''}
                        </span>
                      </li>
                    ))}
                  </ul>
                </>
              )}
            </section>

            <section className="card" aria-labelledby="orgs-h">
              <div className="card-header">
                <h2 id="orgs-h">Organizations</h2>
                <Link to="/owner/organizations" className="owner-link">
                  View all
                </Link>
              </div>
              {orgsStatus === 'ready' && orgs.length === 0 && <p className="muted owner-table-empty">No organizations yet.</p>}
              {orgs.length > 0 && (
                <ul className="owner-dep-list">
                  {orgs.slice(0, 5).map((o) => (
                    <li key={o.id}>
                      <span>{o.name}</span>
                      <span className="muted">
                        {o.staff_count} staff · {o.is_active ? 'Active' : 'Suspended'}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </div>
        </div>
      </div>
    </Page>
  )
}

export default OverviewView
