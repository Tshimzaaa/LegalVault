import { useState } from 'react'
import type { FormEvent } from 'react'
import { createOrganization } from '../../api/owner'
import type { Inquiry } from '../../api/owner'
import { IconCheckCircle } from '../../components/icons'
import { Modal } from './ownerParts'
import { copyText, generatePassword, splitName } from './ownerUtils'
import { useOwnerData } from './OwnerDataContext'

const emptyCreateForm = {
  orgName: '',
  orgEmail: '',
  orgPhone: '',
  orgWebsite: '',
  orgAddress: '',
  adminFirstName: '',
  adminLastName: '',
  adminEmail: '',
  adminPassword: '',
}

function initialForm(inquiry?: Inquiry | null) {
  const base = { ...emptyCreateForm, adminPassword: generatePassword() }
  if (!inquiry) return base
  const { first, last } = splitName(inquiry.name)
  return {
    ...base,
    orgName: inquiry.organization_name ?? '',
    orgEmail: inquiry.email,
    orgPhone: inquiry.phone ?? '',
    adminFirstName: first,
    adminLastName: last,
    adminEmail: inquiry.email,
  }
}

interface CreatedInfo {
  orgName: string
  email: string
  password: string
  organizationId: string
}

interface OnboardDialogProps {
  inquiry?: Inquiry | null
  onClose: () => void
  /** Runs after the organization exists; used to flip the source inquiry to onboarded. */
  onLinkInquiry?: (inquiry: Inquiry, organizationId: string) => Promise<boolean>
}

function CopyRow({ label, value, secret }: { label: string; value: string; secret?: boolean }) {
  const [copied, setCopied] = useState(false)
  return (
    <div className="share-row">
      <span className="share-label">{label}</span>
      <code className={`share-value${secret ? ' secret' : ''}`}>{value}</code>
      <button
        type="button"
        className="btn-ghost share-copy"
        aria-label={`Copy ${label.toLowerCase()}`}
        onClick={async () => {
          if (await copyText(value)) {
            setCopied(true)
            window.setTimeout(() => setCopied(false), 1800)
          }
        }}
      >
        {copied ? 'Copied' : 'Copy'}
      </button>
    </div>
  )
}

function OnboardDialog({ inquiry, onClose, onLinkInquiry }: OnboardDialogProps) {
  const { token, reloadOrgs } = useOwnerData()
  const [form, setForm] = useState(() => initialForm(inquiry))
  const [showPassword, setShowPassword] = useState(true)
  const [createError, setCreateError] = useState('')
  const [creating, setCreating] = useState(false)
  const [created, setCreated] = useState<CreatedInfo | null>(null)
  const [linkFailed, setLinkFailed] = useState(false)
  const [linking, setLinking] = useState(false)
  const [allCopied, setAllCopied] = useState(false)

  function updateField<K extends keyof typeof emptyCreateForm>(key: K, value: string) {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!token) return
    setCreateError('')

    if (form.adminPassword.length < 8) {
      setCreateError('Admin password must be at least 8 characters.')
      return
    }

    setCreating(true)
    try {
      const result = await createOrganization(token, {
        organization: {
          name: form.orgName,
          email: form.orgEmail,
          phone: form.orgPhone || null,
          website: form.orgWebsite || null,
          address: form.orgAddress || null,
        },
        admin: {
          first_name: form.adminFirstName,
          last_name: form.adminLastName,
          email: form.adminEmail,
          password: form.adminPassword,
        },
      })
      setCreated({
        orgName: form.orgName,
        email: form.adminEmail,
        password: form.adminPassword,
        organizationId: result.organization_id,
      })
      reloadOrgs()
      if (inquiry && onLinkInquiry) {
        const ok = await onLinkInquiry(inquiry, result.organization_id)
        setLinkFailed(!ok)
      }
    } catch (err) {
      setCreateError(err instanceof Error ? err.message : 'Could not create the organization.')
    } finally {
      setCreating(false)
    }
  }

  async function retryLink() {
    if (!created || !inquiry || !onLinkInquiry) return
    setLinking(true)
    const ok = await onLinkInquiry(inquiry, created.organizationId)
    setLinkFailed(!ok)
    setLinking(false)
  }

  if (created) {
    const loginUrl = `${window.location.origin}/login`
    const details = `Organization: ${created.orgName}\nLogin URL: ${loginUrl}\nEmail: ${created.email}\nPassword: ${created.password}`
    return (
      <Modal
        title="Organization created"
        onClose={onClose}
        footer={
          <button type="button" className="btn-solid" onClick={onClose} data-autofocus>
            Done
          </button>
        }
      >
        <div className="onboard-success" aria-live="polite">
          <p className="onboard-success-lead">
            <IconCheckCircle aria-hidden="true" /> <strong>{created.orgName}</strong> is ready.
            {inquiry && !linkFailed && ' The inquiry is now marked as onboarded.'}
          </p>
          {linkFailed && (
            <p className="contract-error onboard-link-error" role="alert">
              The organization was created, but the inquiry could not be marked as onboarded.{' '}
              <button type="button" className="link-btn" onClick={retryLink} disabled={linking}>
                {linking ? 'Retrying…' : 'Try again'}
              </button>
            </p>
          )}
        </div>
        <section className="share-card" aria-labelledby="share-heading">
          <h3 id="share-heading">Share these details with the client</h3>
          <CopyRow label="Login URL" value={loginUrl} />
          <CopyRow label="Login email" value={created.email} />
          <CopyRow label="Password" value={created.password} secret />
          <button
            type="button"
            className="btn-ghost share-all"
            onClick={async () => {
              if (await copyText(details)) {
                setAllCopied(true)
                window.setTimeout(() => setAllCopied(false), 1800)
              }
            }}
          >
            {allCopied ? 'Copied all details' : 'Copy all details'}
          </button>
          <p className="share-warning" role="note">
            This password is shown only now. Copy it before you close this window, it cannot be viewed again.
          </p>
        </section>
      </Modal>
    )
  }

  return (
    <Modal
      title={inquiry ? 'Onboard this firm' : 'Onboard a new organization'}
      onClose={onClose}
      wide
      footer={
        <>
          <button type="button" className="btn-ghost" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" form="onboard-form" className="btn-solid" disabled={creating}>
            {creating ? 'Creating…' : 'Create organization & admin'}
          </button>
        </>
      }
    >
      <form id="onboard-form" onSubmit={handleSubmit} className="owner-create-org-form">
        {inquiry && (
          <p className="onboard-source muted">
            Prefilled from the access request by {inquiry.name}. Check the details before creating.
          </p>
        )}
        <fieldset className="onboard-group">
          <legend>Organization</legend>
          <div className="field-row">
            <label className="field">
              <span>Organization name</span>
              <input
                value={form.orgName}
                onChange={(e) => updateField('orgName', e.target.value)}
                required
                autoComplete="organization"
              />
            </label>
            <label className="field">
              <span>Organization email</span>
              <input
                type="email"
                value={form.orgEmail}
                onChange={(e) => updateField('orgEmail', e.target.value)}
                required
                autoComplete="email"
                spellCheck={false}
              />
            </label>
          </div>
          <div className="field-row">
            <label className="field">
              <span>Organization phone (optional)</span>
              <input
                type="tel"
                value={form.orgPhone}
                onChange={(e) => updateField('orgPhone', e.target.value)}
                autoComplete="tel"
              />
            </label>
            <label className="field">
              <span>Organization website (optional)</span>
              <input
                type="url"
                value={form.orgWebsite}
                onChange={(e) => updateField('orgWebsite', e.target.value)}
                autoComplete="url"
              />
            </label>
          </div>
          <label className="field">
            <span>Organization address (optional)</span>
            <input
              value={form.orgAddress}
              onChange={(e) => updateField('orgAddress', e.target.value)}
              autoComplete="street-address"
            />
          </label>
        </fieldset>

        <fieldset className="onboard-group">
          <legend>First administrator</legend>
          <div className="field-row">
            <label className="field">
              <span>Admin first name</span>
              <input
                value={form.adminFirstName}
                onChange={(e) => updateField('adminFirstName', e.target.value)}
                required
                autoComplete="off"
              />
            </label>
            <label className="field">
              <span>Admin last name</span>
              <input
                value={form.adminLastName}
                onChange={(e) => updateField('adminLastName', e.target.value)}
                required
                autoComplete="off"
              />
            </label>
          </div>
          <label className="field">
            <span>Admin email</span>
            <input
              type="email"
              value={form.adminEmail}
              onChange={(e) => updateField('adminEmail', e.target.value)}
              required
              autoComplete="off"
              spellCheck={false}
            />
          </label>
          <div className="field">
            <label htmlFor="onboard-password">Admin password</label>
            <div className="password-row">
              <input
                id="onboard-password"
                type={showPassword ? 'text' : 'password'}
                value={form.adminPassword}
                onChange={(e) => updateField('adminPassword', e.target.value)}
                placeholder="At least 8 characters…"
                required
                autoComplete="new-password"
                spellCheck={false}
                className="password-input"
              />
              <button type="button" className="btn-ghost" onClick={() => setShowPassword((v) => !v)} aria-pressed={showPassword}>
                {showPassword ? 'Hide' : 'Show'}
              </button>
              <button
                type="button"
                className="btn-ghost"
                onClick={() => {
                  updateField('adminPassword', generatePassword())
                  setShowPassword(true)
                }}
              >
                Generate
              </button>
            </div>
            <span className="field-hint">You choose this password and pass it to the client. They can change it after signing in.</span>
          </div>
        </fieldset>

        <p className="contract-error owner-form-error" aria-live="polite">
          {createError}
        </p>
      </form>
    </Modal>
  )
}

export default OnboardDialog
