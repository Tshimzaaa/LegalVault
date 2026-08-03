import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import './Clients.css'
import { IconPlus } from '../../components/icons'
import { listClients, createClient, inviteContact, resendInvite } from '../../api/clients'
import type { Client } from '../../api/clients'

type LoadState = 'loading' | 'error' | 'ready'

function Clients() {
  const [clients, setClients] = useState<Client[]>([])
  const [status, setStatus] = useState<LoadState>('loading')
  const [attempt, setAttempt] = useState(0)

  const [showNewClient, setShowNewClient] = useState(false)
  const [companyName, setCompanyName] = useState('')
  const [creating, setCreating] = useState(false)
  const [createError, setCreateError] = useState<string | null>(null)

  const [inviteClientId, setInviteClientId] = useState('')
  const [inviteFirstName, setInviteFirstName] = useState('')
  const [inviteLastName, setInviteLastName] = useState('')
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviting, setInviting] = useState(false)
  const [inviteError, setInviteError] = useState<string | null>(null)
  const [inviteSent, setInviteSent] = useState(false)

  const [resendEmail, setResendEmail] = useState('')
  const [resending, setResending] = useState(false)
  const [resendMessage, setResendMessage] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    setStatus('loading')

    const token = localStorage.getItem('access_token')
    if (!token) {
      setStatus('error')
      return
    }

    listClients(token)
      .then((data) => {
        if (cancelled) return
        setClients(data)
        setStatus('ready')
      })
      .catch(() => {
        if (cancelled) return
        setStatus('error')
      })

    return () => {
      cancelled = true
    }
  }, [attempt])

  async function handleCreateClient(e: FormEvent) {
    e.preventDefault()
    setCreateError(null)
    const token = localStorage.getItem('access_token')
    if (!token || !companyName) return

    setCreating(true)
    try {
      await createClient(token, companyName)
      setCompanyName('')
      setShowNewClient(false)
      setAttempt((n) => n + 1)
    } catch {
      setCreateError('Could not create the client. Please try again.')
    } finally {
      setCreating(false)
    }
  }

  async function handleInvite(e: FormEvent) {
    e.preventDefault()
    setInviteError(null)
    setInviteSent(false)
    const token = localStorage.getItem('access_token')
    if (!token || !inviteClientId || !inviteFirstName || !inviteLastName || !inviteEmail) {
      setInviteError('Select a client and fill in all fields.')
      return
    }

    setInviting(true)
    try {
      await inviteContact(token, inviteClientId, {
        first_name: inviteFirstName,
        last_name: inviteLastName,
        email: inviteEmail,
      })
      setInviteFirstName('')
      setInviteLastName('')
      setInviteEmail('')
      setInviteSent(true)
    } catch {
      setInviteError('Could not send the invite. The email may already be in use.')
    } finally {
      setInviting(false)
    }
  }

  async function handleResend(e: FormEvent) {
    e.preventDefault()
    setResendMessage(null)
    const token = localStorage.getItem('access_token')
    if (!token || !resendEmail) return

    setResending(true)
    try {
      await resendInvite(token, resendEmail)
      setResendMessage('Invite resent.')
      setResendEmail('')
    } catch {
      setResendMessage('Could not resend the invite.')
    } finally {
      setResending(false)
    }
  }

  return (
    <main className="dash-main">
      <header className="dash-topbar">
        <h1>Clients</h1>
        <div className="topbar-actions">
          <span className="chip">
            Total <span className="chip-badge">{clients.length}</span>
          </span>
          <button type="button" className="btn-solid" onClick={() => setShowNewClient((v) => !v)}>
            <IconPlus /> New Client
          </button>
        </div>
      </header>

      {showNewClient && (
        <form className="card" onSubmit={handleCreateClient} style={{ marginBottom: 16 }}>
          <div className="field-row">
            <label className="field">
              <span>Company name</span>
              <input type="text" value={companyName} onChange={(e) => setCompanyName(e.target.value)} />
            </label>
          </div>
          <div className="matter-actions">
            <button type="button" className="btn-ghost" onClick={() => setShowNewClient(false)}>
              Cancel
            </button>
            <button type="submit" className="btn-solid" disabled={creating}>
              {creating ? 'Creating…' : 'Create Client'}
            </button>
          </div>
          {createError && <p className="matter-error">{createError}</p>}
        </form>
      )}

      {status === 'loading' && (
        <div className="dash-state">
          <span className="dash-spinner" />
          <p>Loading clients…</p>
        </div>
      )}

      {status === 'error' && (
        <div className="dash-state">
          <p>Couldn&rsquo;t reach the backend for your clients.</p>
          <button type="button" className="btn-ghost" onClick={() => setAttempt((n) => n + 1)}>
            Retry
          </button>
        </div>
      )}

      {status === 'ready' && (
        <div className="clients-layout">
          <section className="card clients-table-card">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Company</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {clients.map((c) => (
                  <tr key={c.id}>
                    <td>{c.company_name}</td>
                    <td>
                      <span
                        className="status-badge"
                        style={{
                          color: c.is_active ? '#22c55e' : '#9ca3af',
                          background: c.is_active ? '#22c55e22' : '#9ca3af22',
                        }}
                      >
                        {c.is_active ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                  </tr>
                ))}
                {clients.length === 0 && (
                  <tr>
                    <td colSpan={2} className="muted">
                      No clients yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </section>

          <div className="clients-side">
            <section className="card">
              <div className="card-header">
                <span>Invite a Contact</span>
              </div>
              <form onSubmit={handleInvite}>
                <label className="field">
                  <span>Client</span>
                  <select value={inviteClientId} onChange={(e) => setInviteClientId(e.target.value)}>
                    <option value="">Select client</option>
                    {clients.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.company_name}
                      </option>
                    ))}
                  </select>
                </label>
                <div className="field-row">
                  <label className="field">
                    <span>First name</span>
                    <input type="text" value={inviteFirstName} onChange={(e) => setInviteFirstName(e.target.value)} />
                  </label>
                  <label className="field">
                    <span>Last name</span>
                    <input type="text" value={inviteLastName} onChange={(e) => setInviteLastName(e.target.value)} />
                  </label>
                </div>
                <label className="field">
                  <span>Email</span>
                  <input type="email" value={inviteEmail} onChange={(e) => setInviteEmail(e.target.value)} />
                </label>
                <button type="submit" className="btn-solid" disabled={inviting}>
                  {inviting ? 'Sending…' : 'Send Invite'}
                </button>
                {inviteError && <p className="matter-error">{inviteError}</p>}
                {inviteSent && <p className="clients-form-note">Invite sent.</p>}
              </form>
            </section>

            <section className="card">
              <div className="card-header">
                <span>Resend an Invite</span>
              </div>
              <form onSubmit={handleResend}>
                <label className="field">
                  <span>Contact email</span>
                  <input type="email" value={resendEmail} onChange={(e) => setResendEmail(e.target.value)} />
                </label>
                <button type="submit" className="btn-ghost" disabled={resending}>
                  {resending ? 'Resending…' : 'Resend Invite'}
                </button>
                {resendMessage && <p className="clients-form-note">{resendMessage}</p>}
              </form>
            </section>
          </div>
        </div>
      )}
    </main>
  )
}

export default Clients
