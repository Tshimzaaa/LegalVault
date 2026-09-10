import { useEffect, useState } from 'react'
import './MatterAdmin.css'
import ProfileMenu from '../../components/ProfileMenu'
import type { ClientContact } from '../../api/clientAuth'
import { listMyContactPermissions } from '../../api/clientMatters'
import type { ContactPermissionLevel, MatterContactPermission } from '../../api/clientMatters'

type LoadState = 'loading' | 'error' | 'ready'

const permissionLabel: Record<ContactPermissionLevel, string> = {
  owner: 'Owner',
  editor: 'Editor',
  viewer: 'Viewer',
}

const permissionColor: Record<ContactPermissionLevel, string> = {
  owner: '#22c55e',
  editor: '#3987e5',
  viewer: '#9ca3af',
}

interface MatterAdminProps {
  contact: ClientContact
  onLogout: () => void
}

function MatterAdmin({ contact, onLogout }: MatterAdminProps) {
  const [permissions, setPermissions] = useState<MatterContactPermission[]>([])
  const [status, setStatus] = useState<LoadState>('loading')
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    let cancelled = false
    setStatus('loading')

    const token = localStorage.getItem('access_token')
    if (!token) {
      setStatus('error')
      return
    }

    listMyContactPermissions(token)
      .then((data) => {
        if (cancelled) return
        setPermissions(data)
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

  return (
    <main className="dash-main">
      <header className="dash-topbar">
        <h1>Matter Admin</h1>
        <div className="topbar-actions">
          <span className="chip">
            Access grants <span className="chip-badge">{permissions.length}</span>
          </span>
          <ProfileMenu user={contact} onLogout={onLogout} />
        </div>
      </header>

      {status === 'loading' && (
        <div className="dash-state" role="status" aria-live="polite">
          <span className="dash-spinner" aria-hidden="true" />
          <p>Loading matter access…</p>
        </div>
      )}

      {status === 'error' && (
        <div className="dash-state">
          <p>Couldn&rsquo;t reach the backend for matter access data.</p>
          <button type="button" className="btn-ghost" onClick={() => setAttempt((n) => n + 1)}>
            Retry
          </button>
        </div>
      )}

      {status === 'ready' && (
        <section className="card matter-admin-table-card">
          {permissions.length === 0 ? (
            <p className="muted">No matter access has been granted to anyone at your company yet.</p>
          ) : (
            <div className="table-scroll">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Matter</th>
                  <th>Contact</th>
                  <th>Permission</th>
                </tr>
              </thead>
              <tbody>
                {permissions.map((p) => (
                  <tr key={p.id}>
                    <td>{p.matter_title}</td>
                    <td className="muted">
                      {p.contact_name}
                      {p.client_contact_id === contact.id ? ' (you)' : ''}
                    </td>
                    <td>
                      <span
                        className="status-badge"
                        style={{
                          color: permissionColor[p.permission_level],
                          background: `${permissionColor[p.permission_level]}22`,
                        }}
                      >
                        {permissionLabel[p.permission_level]}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            </div>
          )}
        </section>
      )}
    </main>
  )
}

export default MatterAdmin
