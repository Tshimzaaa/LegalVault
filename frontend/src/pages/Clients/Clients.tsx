import { Fragment, useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import './Clients.css'
import { IconPlus, IconChevron, IconTrash, IconMail } from '../../components/icons'
import {
  listClients,
  createClient,
  inviteContact,
  resendInvite,
  listContacts,
  updateClientStatus,
  deleteClient,
  updateContactStatus,
  deleteContact,
  forceLogoutContact,
} from '../../api/clients'
import type { Client, Contact } from '../../api/clients'
import type { User } from '../../api/auth'

type LoadState = 'loading' | 'error' | 'ready'

interface ClientsProps {
  user: User
}

function Clients({ user }: ClientsProps) {
  const isAdmin = user.role === 'admin'

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

  const [togglingClientId, setTogglingClientId] = useState<string | null>(null)
  const [deletingClientId, setDeletingClientId] = useState<string | null>(null)
  const [clientActionError, setClientActionError] = useState<string | null>(null)

  const [expandedClientId, setExpandedClientId] = useState<string | null>(null)
  const [contactsByClient, setContactsByClient] = useState<Record<string, Contact[]>>({})
  const [contactsLoading, setContactsLoading] = useState(false)
  const [contactActionId, setContactActionId] = useState<string | null>(null)

  const token = localStorage.getItem('access_token')

  useEffect(() => {
    let cancelled = false
    setStatus('loading')

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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [attempt])

  async function handleCreateClient(e: FormEvent) {
    e.preventDefault()
    setCreateError(null)
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
      if (expandedClientId === inviteClientId) {
        listContacts(token, inviteClientId).then((data) =>
          setContactsByClient((prev) => ({ ...prev, [inviteClientId]: data })),
        )
      }
    } catch {
      setInviteError('Could not send the invite. The email may already be in use.')
    } finally {
      setInviting(false)
    }
  }

  async function handleResend(e: FormEvent) {
    e.preventDefault()
    setResendMessage(null)
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

  async function handleToggleClientStatus(client: Client) {
    if (!token) return
    setClientActionError(null)
    setTogglingClientId(client.id)
    try {
      const updated = await updateClientStatus(token, client.id, !client.is_active)
      setClients((prev) => prev.map((c) => (c.id === client.id ? updated : c)))
    } catch (err) {
      setClientActionError(err instanceof Error ? err.message : 'Could not update client status.')
    } finally {
      setTogglingClientId(null)
    }
  }

  async function handleDeleteClient(client: Client) {
    if (!token) return
    if (!window.confirm(`Delete ${client.company_name}? This cannot be undone.`)) return
    setClientActionError(null)
    setDeletingClientId(client.id)
    try {
      await deleteClient(token, client.id)
      setClients((prev) => prev.filter((c) => c.id !== client.id))
      if (expandedClientId === client.id) setExpandedClientId(null)
    } catch (err) {
      setClientActionError(
        err instanceof Error ? err.message : 'Could not delete this client — it may still have open matters.',
      )
    } finally {
      setDeletingClientId(null)
    }
  }

  async function handleToggleExpand(client: Client) {
    if (expandedClientId === client.id) {
      setExpandedClientId(null)
      return
    }
    setExpandedClientId(client.id)
    if (!token || contactsByClient[client.id]) return
    setContactsLoading(true)
    try {
      const data = await listContacts(token, client.id)
      setContactsByClient((prev) => ({ ...prev, [client.id]: data }))
    } finally {
      setContactsLoading(false)
    }
  }

  async function handleToggleContactStatus(clientId: string, contact: Contact) {
    if (!token) return
    setContactActionId(contact.id)
    try {
      const updated = await updateContactStatus(token, clientId, contact.id, !contact.is_active)
      setContactsByClient((prev) => ({
        ...prev,
        [clientId]: (prev[clientId] ?? []).map((c) => (c.id === contact.id ? updated : c)),
      }))
    } finally {
      setContactActionId(null)
    }
  }

  async function handleForceLogoutContact(clientId: string, contact: Contact) {
    if (!token) return
    if (!window.confirm(`Log ${contact.first_name} ${contact.last_name} out of all sessions right now?`)) return
    setContactActionId(contact.id)
    try {
      await forceLogoutContact(token, clientId, contact.id)
    } finally {
      setContactActionId(null)
    }
  }

  async function handleDeleteContact(clientId: string, contact: Contact) {
    if (!token) return
    if (!window.confirm(`Remove ${contact.first_name} ${contact.last_name} from this client?`)) return
    setContactActionId(contact.id)
    try {
      await deleteContact(token, clientId, contact.id)
      setContactsByClient((prev) => ({
        ...prev,
        [clientId]: (prev[clientId] ?? []).filter((c) => c.id !== contact.id),
      }))
    } finally {
      setContactActionId(null)
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
            {clientActionError && <p className="matter-error">{clientActionError}</p>}
            <table className="data-table">
              <thead>
                <tr>
                  <th />
                  <th>Company</th>
                  <th>Status</th>
                  {isAdmin && <th />}
                </tr>
              </thead>
              <tbody>
                {clients.map((c) => (
                  <Fragment key={c.id}>
                    <tr>
                      <td>
                        <button
                          type="button"
                          className="icon-btn clients-expand-btn"
                          onClick={() => handleToggleExpand(c)}
                          aria-label={`Show contacts for ${c.company_name}`}
                        >
                          <span className={expandedClientId === c.id ? 'clients-chevron open' : 'clients-chevron'}>
                            <IconChevron />
                          </span>
                        </button>
                      </td>
                      <td>{c.company_name}</td>
                      <td>
                        <span
                          className="status-badge"
                          style={{
                            color: c.is_active ? '#22c55e' : '#ef4444',
                            background: c.is_active ? '#22c55e22' : '#ef444422',
                          }}
                        >
                          {c.is_active ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                      {isAdmin && (
                        <td>
                          <div className="clients-row-actions">
                            <button
                              type="button"
                              className="btn-ghost clients-action-btn"
                              disabled={togglingClientId === c.id}
                              onClick={() => handleToggleClientStatus(c)}
                            >
                              {togglingClientId === c.id ? 'Saving…' : c.is_active ? 'Deactivate' : 'Activate'}
                            </button>
                            <button
                              type="button"
                              className="icon-btn"
                              disabled={deletingClientId === c.id}
                              onClick={() => handleDeleteClient(c)}
                              aria-label={`Delete ${c.company_name}`}
                            >
                              <IconTrash />
                            </button>
                          </div>
                        </td>
                      )}
                    </tr>
                    {expandedClientId === c.id && (
                      <tr>
                        <td colSpan={isAdmin ? 4 : 3} className="clients-contacts-cell">
                          {contactsLoading && !contactsByClient[c.id] ? (
                            <p className="muted">Loading contacts…</p>
                          ) : (
                            <div className="clients-contacts-list">
                              {(contactsByClient[c.id] ?? []).map((contact) => (
                                <div key={contact.id} className="clients-contact-row">
                                  <span className="clients-contact-name">
                                    {contact.first_name} {contact.last_name}
                                  </span>
                                  <span className="muted">{contact.email}</span>
                                  {contact.invitation_status === 'pending' ? (
                                    <span className="status-badge" style={{ color: '#eab308', background: '#eab30822' }}>
                                      Invite pending
                                    </span>
                                  ) : (
                                    <span
                                      className="status-badge"
                                      style={{
                                        color: contact.is_active ? '#22c55e' : '#ef4444',
                                        background: contact.is_active ? '#22c55e22' : '#ef444422',
                                      }}
                                    >
                                      {contact.is_active ? 'Active' : 'Deactivated'}
                                    </span>
                                  )}
                                  {isAdmin && (
                                    <div className="clients-row-actions">
                                      <button
                                        type="button"
                                        className="btn-ghost clients-action-btn"
                                        disabled={contactActionId === contact.id}
                                        onClick={() => handleToggleContactStatus(c.id, contact)}
                                      >
                                        {contactActionId === contact.id
                                          ? 'Saving…'
                                          : contact.is_active
                                            ? 'Deactivate'
                                            : 'Reactivate'}
                                      </button>
                                      {contact.is_active && contact.invitation_status !== 'pending' && (
                                        <button
                                          type="button"
                                          className="btn-ghost clients-action-btn"
                                          disabled={contactActionId === contact.id}
                                          onClick={() => handleForceLogoutContact(c.id, contact)}
                                        >
                                          Force logout
                                        </button>
                                      )}
                                      <button
                                        type="button"
                                        className="icon-btn"
                                        disabled={contactActionId === contact.id}
                                        onClick={() => handleDeleteContact(c.id, contact)}
                                        aria-label={`Remove ${contact.first_name} ${contact.last_name}`}
                                      >
                                        <IconTrash />
                                      </button>
                                    </div>
                                  )}
                                </div>
                              ))}
                              {(contactsByClient[c.id] ?? []).length === 0 && (
                                <p className="muted">No contacts invited yet.</p>
                              )}
                            </div>
                          )}
                        </td>
                      </tr>
                    )}
                  </Fragment>
                ))}
                {clients.length === 0 && (
                  <tr>
                    <td colSpan={isAdmin ? 4 : 3} className="muted">
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
                  <IconMail /> {inviting ? 'Sending…' : 'Send Invite'}
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
