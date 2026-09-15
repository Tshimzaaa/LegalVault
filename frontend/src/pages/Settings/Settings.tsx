import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import './Settings.css'
import { getOrganizationProfile, updateOrganizationProfile } from '../../api/auth'
import type { OrganizationProfile, User } from '../../api/auth'

type LoadState = 'loading' | 'error' | 'ready'

interface SettingsProps {
  user: User
}

function Settings({ user }: SettingsProps) {
  const isAdmin = user.role === 'admin'

  const [org, setOrganization] = useState<OrganizationProfile | null>(null)
  const [status, setStatus] = useState<LoadState>('loading')

  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [website, setWebsite] = useState('')
  const [address, setAddress] = useState('')

  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)

  const token = localStorage.getItem('access_token')

  function loadOrganization() {
    if (!token) {
      setStatus('error')
      return
    }
    setStatus('loading')
    getOrganizationProfile(token)
      .then((data) => {
        setOrganization(data)
        setName(data.name)
        setEmail(data.email)
        setPhone(data.phone ?? '')
        setWebsite(data.website ?? '')
        setAddress(data.address ?? '')
        setStatus('ready')
      })
      .catch(() => setStatus('error'))
  }

  useEffect(loadOrganization, []) // eslint-disable-line react-hooks/exhaustive-deps

  async function handleSave(e: FormEvent) {
    e.preventDefault()
    if (!token) return
    setSaveError(null)
    setSaved(false)
    setSaving(true)
    try {
      const updated = await updateOrganizationProfile(token, {
        name,
        email,
        phone: phone || null,
        website: website || null,
        address: address || null,
      })
      setOrganization(updated)
      setSaved(true)
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Could not save organization settings.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <main className="dash-main">
      <header className="dash-topbar">
        <h1>Organization Settings</h1>
      </header>

      {status === 'loading' && (
        <div className="dash-state" role="status" aria-live="polite">
          <span className="dash-spinner" aria-hidden="true" />
          <p>Loading organization settings…</p>
        </div>
      )}

      {status === 'error' && (
        <div className="dash-state" role="status" aria-live="polite">
          <p>Couldn&rsquo;t reach the backend for organization settings.</p>
          <button type="button" className="btn-ghost" onClick={loadOrganization}>
            Retry
          </button>
        </div>
      )}

      {status === 'ready' && org && (
        <section className="card settings-card">
          <div className="card-header">
            <span>Organization profile</span>
            {!isAdmin && <span className="chip small">View only</span>}
          </div>

          <form onSubmit={handleSave} className="settings-form">
            <div className="field-row">
              <label className="field">
                <span>Organization name</span>
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  disabled={!isAdmin}
                  required
                  autoComplete="organization"
                />
              </label>
              <label className="field">
                <span>Organization email</span>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  disabled={!isAdmin}
                  required
                  autoComplete="email"
                  spellCheck={false}
                />
              </label>
            </div>
            <div className="field-row">
              <label className="field">
                <span>Phone</span>
                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  disabled={!isAdmin}
                  autoComplete="tel"
                />
              </label>
              <label className="field">
                <span>Website</span>
                <input
                  type="url"
                  value={website}
                  onChange={(e) => setWebsite(e.target.value)}
                  disabled={!isAdmin}
                  autoComplete="url"
                />
              </label>
            </div>
            <label className="field">
              <span>Address</span>
              <input
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                disabled={!isAdmin}
                autoComplete="street-address"
              />
            </label>

            {saveError && <p className="contract-error" aria-live="polite">{saveError}</p>}
            {saved && <p className="settings-saved" aria-live="polite">Organization settings saved.</p>}

            {isAdmin && (
              <div className="contract-actions">
                <button type="submit" className="btn-solid" disabled={saving}>
                  {saving ? 'Saving…' : 'Save changes'}
                </button>
              </div>
            )}
          </form>
        </section>
      )}
    </main>
  )
}

export default Settings
