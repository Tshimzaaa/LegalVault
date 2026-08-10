import { useState } from 'react'
import type { FormEvent } from 'react'
import '../Settings/Settings.css'
import { updateContactProfile, changeContactPassword } from '../../api/clientAuth'
import type { ClientContact } from '../../api/clientAuth'

interface ClientAccountSettingsProps {
  contact: ClientContact
  onLogout: () => void
  onContactUpdate: (contact: ClientContact) => void
}

function ClientAccountSettings({ contact, onLogout, onContactUpdate }: ClientAccountSettingsProps) {
  const token = localStorage.getItem('access_token')

  const [firstName, setFirstName] = useState(contact.first_name)
  const [lastName, setLastName] = useState(contact.last_name)
  const [email, setEmail] = useState(contact.email)
  const [profileSaving, setProfileSaving] = useState(false)
  const [profileError, setProfileError] = useState<string | null>(null)
  const [profileSaved, setProfileSaved] = useState(false)

  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [passwordSaving, setPasswordSaving] = useState(false)
  const [passwordError, setPasswordError] = useState<string | null>(null)

  async function handleProfileSave(e: FormEvent) {
    e.preventDefault()
    if (!token) return
    setProfileError(null)
    setProfileSaved(false)
    setProfileSaving(true)
    try {
      const updated = await updateContactProfile(token, { first_name: firstName, last_name: lastName, email })
      onContactUpdate(updated)
      setProfileSaved(true)
    } catch (err) {
      setProfileError(err instanceof Error ? err.message : 'Could not save your profile.')
    } finally {
      setProfileSaving(false)
    }
  }

  async function handlePasswordSave(e: FormEvent) {
    e.preventDefault()
    if (!token) return
    setPasswordError(null)

    if (newPassword !== confirmPassword) {
      setPasswordError('New password and confirmation do not match.')
      return
    }

    setPasswordSaving(true)
    try {
      await changeContactPassword(token, currentPassword, newPassword)
      // The backend revokes every session on password change, this one included —
      // so the local session is now stale. Send the user back to log in fresh.
      onLogout()
    } catch (err) {
      setPasswordError(err instanceof Error ? err.message : 'Could not change your password.')
      setPasswordSaving(false)
    }
  }

  return (
    <main className="dash-main">
      <header className="dash-topbar">
        <h1>Account Settings</h1>
      </header>

      <section className="card settings-card">
        <div className="card-header">
          <span>Your profile</span>
        </div>

        <form onSubmit={handleProfileSave} className="settings-form">
          <div className="field-row">
            <label className="field">
              <span>First name</span>
              <input value={firstName} onChange={(e) => setFirstName(e.target.value)} required />
            </label>
            <label className="field">
              <span>Last name</span>
              <input value={lastName} onChange={(e) => setLastName(e.target.value)} required />
            </label>
          </div>
          <label className="field">
            <span>Email</span>
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
          </label>

          {profileError && <p className="matter-error">{profileError}</p>}
          {profileSaved && <p className="settings-saved">Profile saved.</p>}

          <div className="matter-actions">
            <button type="submit" className="btn-solid" disabled={profileSaving}>
              {profileSaving ? 'Saving…' : 'Save changes'}
            </button>
          </div>
        </form>
      </section>

      <section className="card settings-card">
        <div className="card-header">
          <span>Change password</span>
        </div>

        <form onSubmit={handlePasswordSave} className="settings-form">
          <label className="field">
            <span>Current password</span>
            <input
              type="password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              required
            />
          </label>
          <div className="field-row">
            <label className="field">
              <span>New password</span>
              <input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                minLength={8}
                required
              />
            </label>
            <label className="field">
              <span>Confirm new password</span>
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                minLength={8}
                required
              />
            </label>
          </div>

          {passwordError && <p className="matter-error">{passwordError}</p>}

          <div className="matter-actions">
            <button type="submit" className="btn-solid" disabled={passwordSaving}>
              {passwordSaving ? 'Changing…' : 'Change password'}
            </button>
          </div>
          <p className="muted">Changing your password will sign you out of all devices.</p>
        </form>
      </section>

      <section className="card settings-card">
        <div className="card-header">
          <span>Account</span>
        </div>
        <div className="settings-form">
          <p className="muted">
            Status: {contact.is_active ? 'Active' : 'Deactivated'}
            {contact.last_login && ` · Last login ${new Date(contact.last_login).toLocaleString()}`}
          </p>
          <p className="muted">
            To deactivate or remove your account, contact your firm — this is managed on their side.
          </p>
        </div>
      </section>
    </main>
  )
}

export default ClientAccountSettings
