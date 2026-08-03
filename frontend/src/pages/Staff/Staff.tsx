import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import './Staff.css'
import { IconPlus } from '../../components/icons'
import { listUsers, inviteStaff, updateStaffStatus } from '../../api/auth'
import type { User, UserRole } from '../../api/auth'

type LoadState = 'loading' | 'error' | 'ready'

const roleOptions: { value: UserRole; label: string }[] = [
  { value: 'admin', label: 'Admin' },
  { value: 'lawyer', label: 'Lawyer' },
  { value: 'paralegal', label: 'Paralegal' },
  { value: 'secretary', label: 'Secretary' },
  { value: 'receptionist', label: 'Receptionist' },
]

const roleLabel: Record<UserRole, string> = {
  admin: 'Admin',
  lawyer: 'Lawyer',
  paralegal: 'Paralegal',
  secretary: 'Secretary',
  receptionist: 'Receptionist',
}

const emptyInviteForm = { first_name: '', last_name: '', email: '', role: 'lawyer' as UserRole }

interface StaffProps {
  user: User
}

function Staff({ user }: StaffProps) {
  const [users, setUsers] = useState<User[]>([])
  const [status, setStatus] = useState<LoadState>('loading')
  const [togglingId, setTogglingId] = useState<string | null>(null)

  const [showInviteForm, setShowInviteForm] = useState(false)
  const [inviteForm, setInviteForm] = useState(emptyInviteForm)
  const [inviteError, setInviteError] = useState('')
  const [inviting, setInviting] = useState(false)
  const [inviteLink, setInviteLink] = useState<string | null>(null)
  const [linkCopied, setLinkCopied] = useState(false)

  const token = localStorage.getItem('access_token')

  function loadAll() {
    if (!token) {
      setStatus('error')
      return
    }
    setStatus('loading')
    listUsers(token)
      .then((list) => {
        setUsers(list)
        setStatus('ready')
      })
      .catch(() => setStatus('error'))
  }

  useEffect(loadAll, []) // eslint-disable-line react-hooks/exhaustive-deps

  async function handleToggleStatus(target: User) {
    if (!token) return
    setTogglingId(target.id)
    try {
      const updated = await updateStaffStatus(token, target.id, !target.is_active)
      setUsers((prev) => prev.map((u) => (u.id === target.id ? updated : u)))
    } finally {
      setTogglingId(null)
    }
  }

  async function handleInvite(e: FormEvent) {
    e.preventDefault()
    if (!token) return
    setInviteError('')
    setInviting(true)
    try {
      const created = await inviteStaff(token, inviteForm)
      setUsers((prev) => [...prev, created])
      setInviteForm(emptyInviteForm)
      setLinkCopied(false)
      setInviteLink(
        created.invitation_token
          ? `${window.location.origin}/accept-staff-invite?token=${created.invitation_token}`
          : null,
      )
    } catch (err) {
      setInviteError(err instanceof Error ? err.message : 'Could not send the invitation.')
    } finally {
      setInviting(false)
    }
  }

  async function handleCopyLink() {
    if (!inviteLink) return
    try {
      await navigator.clipboard.writeText(inviteLink)
      setLinkCopied(true)
    } catch {
      setLinkCopied(false)
    }
  }

  if (user.role !== 'admin') {
    return (
      <main className="dash-main">
        <header className="dash-topbar">
          <h1>Staff</h1>
        </header>
        <div className="dash-state">
          <p>Only firm admins can manage staff.</p>
        </div>
      </main>
    )
  }

  return (
    <main className="dash-main">
      <header className="dash-topbar">
        <h1>Staff</h1>
        <div className="topbar-actions">
          <span className="chip">
            Total <span className="chip-badge">{users.length}</span>
          </span>
          <button
            type="button"
            className="btn-solid"
            onClick={() => {
              setShowInviteForm((v) => !v)
              setInviteLink(null)
            }}
          >
            <IconPlus /> Invite Staff
          </button>
        </div>
      </header>

      {showInviteForm && (
        <section className="card staff-invite-card">
          <div className="card-header">
            <span>Invite a staff member</span>
          </div>

          {inviteLink ? (
            <div className="staff-invite-link-box">
              <p className="muted">
                Invitation created. Share this link with them — it expires in 48 hours (no email is sent
                automatically yet):
              </p>
              <div className="staff-invite-link-row">
                <input type="text" readOnly value={inviteLink} onFocus={(e) => e.target.select()} />
                <button type="button" className="btn-ghost" onClick={handleCopyLink}>
                  {linkCopied ? 'Copied!' : 'Copy'}
                </button>
              </div>
              <button
                type="button"
                className="btn-ghost"
                style={{ marginTop: 10 }}
                onClick={() => {
                  setInviteLink(null)
                  setShowInviteForm(false)
                }}
              >
                Done
              </button>
            </div>
          ) : (
            <form onSubmit={handleInvite}>
              <div className="field-row">
                <label className="field">
                  <span>First name</span>
                  <input
                    value={inviteForm.first_name}
                    onChange={(e) => setInviteForm((f) => ({ ...f, first_name: e.target.value }))}
                    required
                  />
                </label>
                <label className="field">
                  <span>Last name</span>
                  <input
                    value={inviteForm.last_name}
                    onChange={(e) => setInviteForm((f) => ({ ...f, last_name: e.target.value }))}
                    required
                  />
                </label>
              </div>
              <div className="field-row">
                <label className="field">
                  <span>Email</span>
                  <input
                    type="email"
                    value={inviteForm.email}
                    onChange={(e) => setInviteForm((f) => ({ ...f, email: e.target.value }))}
                    required
                  />
                </label>
                <label className="field">
                  <span>Role</span>
                  <select
                    value={inviteForm.role}
                    onChange={(e) => setInviteForm((f) => ({ ...f, role: e.target.value as UserRole }))}
                  >
                    {roleOptions.map((r) => (
                      <option key={r.value} value={r.value}>
                        {r.label}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              {inviteError && <p className="matter-error">{inviteError}</p>}

              <div className="matter-actions">
                <button type="button" className="btn-ghost" onClick={() => setShowInviteForm(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn-solid" disabled={inviting}>
                  {inviting ? 'Sending…' : 'Send invite'}
                </button>
              </div>
            </form>
          )}
        </section>
      )}

      {status === 'loading' && (
        <div className="dash-state">
          <span className="dash-spinner" />
          <p>Loading staff…</p>
        </div>
      )}

      {status === 'error' && (
        <div className="dash-state">
          <p>Couldn&rsquo;t reach the backend for staff.</p>
          <button type="button" className="btn-ghost" onClick={loadAll}>
            Retry
          </button>
        </div>
      )}

      {status === 'ready' && (
        <section className="card staff-table-card">
          <table className="data-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Email</th>
                <th>Role</th>
                <th>Status</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id}>
                  <td>
                    {u.first_name} {u.last_name}
                    {u.id === user.id && <span className="muted"> (you)</span>}
                  </td>
                  <td className="muted">{u.email}</td>
                  <td className="muted">{roleLabel[u.role]}</td>
                  <td>
                    {u.invitation_status === 'pending' ? (
                      <span className="status-badge" style={{ color: '#eab308', background: '#eab30822' }}>
                        Invite pending
                      </span>
                    ) : (
                      <span
                        className="status-badge"
                        style={{
                          color: u.is_active ? '#22c55e' : '#ef4444',
                          background: u.is_active ? '#22c55e22' : '#ef444422',
                        }}
                      >
                        {u.is_active ? 'Active' : 'Deactivated'}
                      </span>
                    )}
                  </td>
                  <td>
                    <button
                      type="button"
                      className="btn-ghost staff-toggle-btn"
                      disabled={u.id === user.id || togglingId === u.id}
                      onClick={() => handleToggleStatus(u)}
                    >
                      {togglingId === u.id ? 'Saving…' : u.is_active ? 'Deactivate' : 'Reactivate'}
                    </button>
                  </td>
                </tr>
              ))}
              {users.length === 0 && (
                <tr>
                  <td colSpan={5} className="muted">
                    No staff yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </section>
      )}
    </main>
  )
}

export default Staff
