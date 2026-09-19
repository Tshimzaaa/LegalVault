import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import './Staff.css'
import { IconPlus } from '../../components/icons'
import { listUsers, inviteStaff, updateStaffStatus, forceLogoutStaff } from '../../api/auth'
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
  const [forceLogoutId, setForceLogoutId] = useState<string | null>(null)
  const [forceLogoutError, setForceLogoutError] = useState<string | null>(null)

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
    if (
      target.is_active &&
      !window.confirm(`Deactivate ${target.first_name} ${target.last_name}'s account access?`)
    )
      return
    setTogglingId(target.id)
    try {
      const updated = await updateStaffStatus(token, target.id, !target.is_active)
      setUsers((prev) => prev.map((u) => (u.id === target.id ? updated : u)))
    } finally {
      setTogglingId(null)
    }
  }

  async function handleForceLogout(target: User) {
    if (!token) return
    if (!window.confirm(`Log ${target.first_name} ${target.last_name} out of all sessions right now?`)) return
    setForceLogoutError(null)
    setForceLogoutId(target.id)
    try {
      await forceLogoutStaff(token, target.id)
    } catch (err) {
      setForceLogoutError(err instanceof Error ? err.message : 'Could not force logout.')
    } finally {
      setForceLogoutId(null)
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
          <p>Only org admins can manage staff.</p>
        </div>
      </main>
    )
  }

  return (
    <main className="dash-main">
      <header className="dash-topbar m-header">
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
                Invitation created. Share this link with them; it expires in 48 hours (no email is sent
                automatically yet):
              </p>
              <div className="staff-invite-link-row">
                <label
                  htmlFor="staff-invite-link"
                  style={{ position: 'absolute', width: 1, height: 1, overflow: 'hidden', clip: 'rect(0 0 0 0)' }}
                >
                  Invitation link
                </label>
                <input
                  id="staff-invite-link"
                  type="text"
                  readOnly
                  value={inviteLink}
                  onFocus={(e) => e.target.select()}
                />
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
                    autoComplete="given-name"
                  />
                </label>
                <label className="field">
                  <span>Last name</span>
                  <input
                    value={inviteForm.last_name}
                    onChange={(e) => setInviteForm((f) => ({ ...f, last_name: e.target.value }))}
                    required
                    autoComplete="family-name"
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
                    autoComplete="email"
                    spellCheck={false}
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

              {inviteError && <p className="contract-error" aria-live="polite">{inviteError}</p>}

              <div className="contract-actions">
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
        <div className="dash-state" role="status" aria-live="polite">
          <span className="dash-spinner" aria-hidden="true" />
          <p>Loading staff…</p>
        </div>
      )}

      {status === 'error' && (
        <div className="dash-state" role="status" aria-live="polite">
          <p>Couldn&rsquo;t reach the backend for staff.</p>
          <button type="button" className="btn-ghost" onClick={loadAll}>
            Retry
          </button>
        </div>
      )}

      {status === 'ready' && (
        <section className="card staff-table-card">
          {forceLogoutError && <p className="contract-error" aria-live="polite">{forceLogoutError}</p>}
          <div className="table-scroll">
          <table className="data-table data-table-list staff-list" role="table">
            <thead role="rowgroup">
              <tr role="row">
                <th role="columnheader">Name</th>
                <th role="columnheader">Email</th>
                <th role="columnheader">Role</th>
                <th role="columnheader">Status</th>
                <th role="columnheader"><span className="staff-sr">Deactivate or reactivate</span></th>
                <th role="columnheader"><span className="staff-sr">Force logout</span></th>
              </tr>
            </thead>
            <tbody role="rowgroup">
              {users.map((u) => (
                <tr key={u.id} role="row">
                  <td role="cell">
                    {u.first_name} {u.last_name}
                    {u.id === user.id && <span className="muted"> (you)</span>}
                  </td>
                  <td role="cell" className="muted staff-email">{u.email}</td>
                  <td role="cell" className="muted staff-role">{roleLabel[u.role]}</td>
                  <td role="cell" className="staff-status">
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
                  <td role="cell" className="staff-act">
                    <button
                      type="button"
                      className="btn-ghost staff-toggle-btn"
                      disabled={u.id === user.id || togglingId === u.id}
                      onClick={() => handleToggleStatus(u)}
                    >
                      {togglingId === u.id ? 'Saving…' : u.is_active ? 'Deactivate' : 'Reactivate'}
                    </button>
                  </td>
                  <td role="cell" className="staff-act">
                    {u.invitation_status !== 'pending' && u.is_active && (
                      <button
                        type="button"
                        className="btn-ghost staff-toggle-btn"
                        disabled={forceLogoutId === u.id}
                        onClick={() => handleForceLogout(u)}
                      >
                        {forceLogoutId === u.id ? 'Logging out…' : 'Force logout'}
                      </button>
                    )}
                  </td>
                </tr>
              ))}
              {users.length === 0 && (
                <tr>
                  <td role="cell" colSpan={6} className="muted">
                    No staff yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
          </div>
        </section>
      )}
    </main>
  )
}

export default Staff
