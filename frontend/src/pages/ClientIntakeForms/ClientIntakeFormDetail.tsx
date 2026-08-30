import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import './ClientIntakeFormDetail.css'
import ProfileMenu from '../../components/ProfileMenu'
import type { ClientContact } from '../../api/clientAuth'
import { getPublishedIntakeForm, submitIntakeForm } from '../../api/clientIntake'
import type { SubmitIntakeFormFile } from '../../api/clientIntake'
import type { IntakeForm } from '../../api/intakeForms'

type LoadState = 'loading' | 'error' | 'ready'

const MAX_FILE_SIZE = 10 * 1024 * 1024
const ALLOWED_FILE_ACCEPT = '.pdf,.doc,.docx,.txt,.jpg,.jpeg,.png'

interface ClientIntakeFormDetailProps {
  contact: ClientContact
  onLogout: () => void
}

function ClientIntakeFormDetail({ contact, onLogout }: ClientIntakeFormDetailProps) {
  const { formId } = useParams<{ formId: string }>()
  const navigate = useNavigate()

  const [form, setForm] = useState<IntakeForm | null>(null)
  const [status, setStatus] = useState<LoadState>('loading')
  const [values, setValues] = useState<Record<string, string>>({})
  const [checked, setChecked] = useState<Record<string, boolean>>({})
  const [files, setFiles] = useState<Record<string, File>>({})
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [submitted, setSubmitted] = useState(false)

  useEffect(() => {
    let cancelled = false
    setStatus('loading')
    const token = localStorage.getItem('access_token')
    if (!token || !formId) {
      setStatus('error')
      return
    }
    getPublishedIntakeForm(token, formId)
      .then((data) => {
        if (cancelled) return
        setForm(data)
        setStatus('ready')
      })
      .catch(() => {
        if (cancelled) return
        setStatus('error')
      })
    return () => {
      cancelled = true
    }
  }, [formId])

  function handleFileChange(fieldId: string, file: File | null) {
    setSubmitError(null)
    if (!file) {
      setFiles((prev) => {
        const next = { ...prev }
        delete next[fieldId]
        return next
      })
      return
    }
    if (file.size > MAX_FILE_SIZE) {
      setSubmitError('That file is too large — 10MB max.')
      return
    }
    setFiles((prev) => ({ ...prev, [fieldId]: file }))
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!form) return
    const token = localStorage.getItem('access_token')
    if (!token) return

    // Every required field already carries a native `required` attribute, so the browser's
    // own constraint validation blocks submission and focuses the first invalid field before
    // this handler ever runs — no need to duplicate that check here.

    const answers: Record<string, string> = {}
    const fileAnswers: SubmitIntakeFormFile[] = []
    for (const field of form.fields) {
      if (field.field_type === 'file') {
        const file = files[field.id]
        if (file) fileAnswers.push({ fieldId: field.id, file })
      } else if (field.field_type === 'checkbox') {
        answers[field.id] = checked[field.id] ? 'true' : 'false'
      } else if (values[field.id]) {
        answers[field.id] = values[field.id]
      }
    }

    setSubmitError(null)
    setSubmitting(true)
    try {
      await submitIntakeForm(token, form.id, answers, fileAnswers)
      setSubmitted(true)
    } catch {
      setSubmitError('Could not submit the form. Please check your answers and try again.')
    } finally {
      setSubmitting(false)
    }
  }

  if (status === 'loading') {
    return (
      <main className="dash-main">
        <div className="dash-state" role="status" aria-live="polite">
          <span className="dash-spinner" aria-hidden="true" />
          <p>Loading form…</p>
        </div>
      </main>
    )
  }

  if (status === 'error' || !form) {
    return (
      <main className="dash-main">
        <div className="dash-state" role="status" aria-live="polite">
          <p>This form isn&rsquo;t available.</p>
          <button type="button" className="btn-ghost" onClick={() => navigate(-1)}>
            Back
          </button>
        </div>
      </main>
    )
  }

  if (submitted) {
    return (
      <main className="dash-main">
        <header className="dash-topbar">
          <h1>{form.title}</h1>
          <ProfileMenu user={contact} onLogout={onLogout} />
        </header>
        <div className="card client-intake-success">
          <p>Thanks — your submission has been received.</p>
          <Link to="/client/my-intake-submissions" className="btn-solid">
            View My Requests
          </Link>
        </div>
      </main>
    )
  }

  return (
    <main className="dash-main">
      <header className="dash-topbar">
        <div>
          <button type="button" className="btn-ghost intake-detail-back" onClick={() => navigate(-1)}>
            ← Back
          </button>
          <h1>{form.title}</h1>
        </div>
        <ProfileMenu user={contact} onLogout={onLogout} />
      </header>

      {form.description && <p className="muted client-intake-description">{form.description}</p>}

      <form className="card client-intake-form" onSubmit={handleSubmit}>
        {form.fields.map((field) => (
          <label key={field.id} className="field">
            <span>
              {field.label}
              {field.is_required && <span className="client-intake-required"> *</span>}
            </span>
            {field.field_type === 'text' && (
              <input
                type="text"
                value={values[field.id] ?? ''}
                onChange={(e) => setValues((prev) => ({ ...prev, [field.id]: e.target.value }))}
                required={field.is_required}
                aria-required={field.is_required}
              />
            )}
            {field.field_type === 'textarea' && (
              <textarea
                rows={4}
                value={values[field.id] ?? ''}
                onChange={(e) => setValues((prev) => ({ ...prev, [field.id]: e.target.value }))}
                required={field.is_required}
                aria-required={field.is_required}
              />
            )}
            {field.field_type === 'number' && (
              <input
                type="number"
                value={values[field.id] ?? ''}
                onChange={(e) => setValues((prev) => ({ ...prev, [field.id]: e.target.value }))}
                required={field.is_required}
                aria-required={field.is_required}
              />
            )}
            {field.field_type === 'date' && (
              <input
                type="date"
                value={values[field.id] ?? ''}
                onChange={(e) => setValues((prev) => ({ ...prev, [field.id]: e.target.value }))}
                required={field.is_required}
                aria-required={field.is_required}
              />
            )}
            {field.field_type === 'dropdown' && (
              <select
                value={values[field.id] ?? ''}
                onChange={(e) => setValues((prev) => ({ ...prev, [field.id]: e.target.value }))}
                required={field.is_required}
                aria-required={field.is_required}
              >
                <option value="" disabled>
                  Select…
                </option>
                {(field.options ?? []).map((opt) => (
                  <option key={opt} value={opt}>
                    {opt}
                  </option>
                ))}
              </select>
            )}
            {field.field_type === 'checkbox' && (
              <input
                type="checkbox"
                checked={checked[field.id] ?? false}
                onChange={(e) => setChecked((prev) => ({ ...prev, [field.id]: e.target.checked }))}
                className="client-intake-checkbox"
                required={field.is_required}
                aria-required={field.is_required}
              />
            )}
            {field.field_type === 'file' && (
              <input
                type="file"
                accept={ALLOWED_FILE_ACCEPT}
                onChange={(e) => handleFileChange(field.id, e.target.files?.[0] ?? null)}
                required={field.is_required}
                aria-required={field.is_required}
              />
            )}
            {field.help_text && <span className="muted client-intake-help">{field.help_text}</span>}
          </label>
        ))}

        {submitError && (
          <p className="matter-error" role="alert" aria-live="polite">
            {submitError}
          </p>
        )}

        <div className="matter-actions">
          <button type="submit" className="btn-solid" disabled={submitting}>
            {submitting ? 'Submitting…' : 'Submit'}
          </button>
        </div>
      </form>
    </main>
  )
}

export default ClientIntakeFormDetail
