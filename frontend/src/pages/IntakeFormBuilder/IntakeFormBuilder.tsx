import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import './IntakeFormBuilder.css'
import { IconPlus, IconEdit, IconTrash, IconArrowUp, IconArrowDown } from '../../components/icons'
import {
  listIntakeForms,
  createIntakeForm,
  updateIntakeForm,
  deleteIntakeForm,
  publishIntakeForm,
  unpublishIntakeForm,
  addIntakeFormField,
  updateIntakeFormField,
  deleteIntakeFormField,
  reorderIntakeFormFields,
} from '../../api/intakeForms'
import type { IntakeForm, IntakeField, FieldType } from '../../api/intakeForms'

type LoadState = 'loading' | 'error' | 'ready'

const FIELD_TYPE_LABELS: Record<FieldType, string> = {
  text: 'Text',
  textarea: 'Long text',
  number: 'Number',
  date: 'Date',
  dropdown: 'Dropdown',
  checkbox: 'Checkbox',
  file: 'File upload',
}

const emptyFormInput = { title: '', description: '' }
const emptyFieldInput = { label: '', field_type: 'text' as FieldType, is_required: false, help_text: '', optionsText: '' }

function IntakeFormBuilder() {
  const [forms, setForms] = useState<IntakeForm[]>([])
  const [status, setStatus] = useState<LoadState>('loading')
  const [attempt, setAttempt] = useState(0)
  const [expandedFormId, setExpandedFormId] = useState<string | null>(null)

  const [showCreate, setShowCreate] = useState(false)
  const [createForm, setCreateForm] = useState(emptyFormInput)
  const [creating, setCreating] = useState(false)
  const [createError, setCreateError] = useState<string | null>(null)

  const [editingFormId, setEditingFormId] = useState<string | null>(null)
  const [editFormInput, setEditFormInput] = useState(emptyFormInput)

  const [addingFieldTo, setAddingFieldTo] = useState<string | null>(null)
  const [fieldInput, setFieldInput] = useState(emptyFieldInput)
  const [editingFieldId, setEditingFieldId] = useState<string | null>(null)

  const [actionError, setActionError] = useState<string | null>(null)

  function token() {
    return localStorage.getItem('access_token')
  }

  useEffect(() => {
    const t = token()
    if (!t) {
      setStatus('error')
      return
    }
    setStatus('loading')
    listIntakeForms(t)
      .then((data) => {
        setForms(data)
        setStatus('ready')
      })
      .catch(() => setStatus('error'))
  }, [attempt])

  function refresh() {
    setAttempt((n) => n + 1)
  }

  async function handleCreateForm(e: FormEvent) {
    e.preventDefault()
    const t = token()
    if (!t || !createForm.title.trim()) return
    setCreating(true)
    setCreateError(null)
    try {
      const created = await createIntakeForm(t, {
        title: createForm.title.trim(),
        description: createForm.description.trim() || null,
      })
      setCreateForm(emptyFormInput)
      setShowCreate(false)
      setExpandedFormId(created.id)
      refresh()
    } catch {
      setCreateError('Could not create the form. Please try again.')
    } finally {
      setCreating(false)
    }
  }

  function startEditForm(form: IntakeForm) {
    setEditingFormId(form.id)
    setEditFormInput({ title: form.title, description: form.description ?? '' })
  }

  async function handleSaveFormEdit(e: FormEvent) {
    e.preventDefault()
    const t = token()
    if (!t || !editingFormId) return
    setActionError(null)
    try {
      await updateIntakeForm(t, editingFormId, {
        title: editFormInput.title.trim(),
        description: editFormInput.description.trim() || null,
      })
      setEditingFormId(null)
      refresh()
    } catch {
      setActionError('Could not save changes to the form.')
    }
  }

  async function handleDeleteForm(form: IntakeForm) {
    const t = token()
    if (!t) return
    if (!window.confirm(`Delete "${form.title}"? This cannot be undone.`)) return
    setActionError(null)
    try {
      await deleteIntakeForm(t, form.id)
      refresh()
    } catch {
      setActionError('Could not delete that form.')
    }
  }

  async function handleTogglePublish(form: IntakeForm) {
    const t = token()
    if (!t) return
    setActionError(null)
    try {
      if (form.is_published) await unpublishIntakeForm(t, form.id)
      else await publishIntakeForm(t, form.id)
      refresh()
    } catch {
      setActionError('Could not change the publish state.')
    }
  }

  async function handleAddField(e: FormEvent, formId: string) {
    e.preventDefault()
    const t = token()
    if (!t || !fieldInput.label.trim()) return
    setActionError(null)
    try {
      await addIntakeFormField(t, formId, {
        label: fieldInput.label.trim(),
        field_type: fieldInput.field_type,
        is_required: fieldInput.is_required,
        help_text: fieldInput.help_text.trim() || null,
        options:
          fieldInput.field_type === 'dropdown'
            ? fieldInput.optionsText.split(',').map((o) => o.trim()).filter(Boolean)
            : null,
      })
      setFieldInput(emptyFieldInput)
      setAddingFieldTo(null)
      refresh()
    } catch {
      setActionError('Could not add that field.')
    }
  }

  function startEditField(field: IntakeField) {
    setEditingFieldId(field.id)
    setFieldInput({
      label: field.label,
      field_type: field.field_type,
      is_required: field.is_required,
      help_text: field.help_text ?? '',
      optionsText: (field.options ?? []).join(', '),
    })
  }

  async function handleSaveFieldEdit(e: FormEvent, formId: string, fieldId: string) {
    e.preventDefault()
    const t = token()
    if (!t) return
    setActionError(null)
    try {
      await updateIntakeFormField(t, formId, fieldId, {
        label: fieldInput.label.trim(),
        field_type: fieldInput.field_type,
        is_required: fieldInput.is_required,
        help_text: fieldInput.help_text.trim() || null,
        options:
          fieldInput.field_type === 'dropdown'
            ? fieldInput.optionsText.split(',').map((o) => o.trim()).filter(Boolean)
            : null,
      })
      setEditingFieldId(null)
      refresh()
    } catch {
      setActionError('Could not save changes to that field.')
    }
  }

  async function handleDeleteField(formId: string, field: IntakeField) {
    const t = token()
    if (!t) return
    if (!window.confirm(`Delete field "${field.label}"?`)) return
    setActionError(null)
    try {
      await deleteIntakeFormField(t, formId, field.id)
      refresh()
    } catch {
      setActionError('Could not delete that field.')
    }
  }

  async function handleMoveField(form: IntakeForm, index: number, direction: -1 | 1) {
    const t = token()
    if (!t) return
    const targetIndex = index + direction
    if (targetIndex < 0 || targetIndex >= form.fields.length) return
    const ids = form.fields.map((f) => f.id)
    ;[ids[index], ids[targetIndex]] = [ids[targetIndex], ids[index]]
    setActionError(null)
    try {
      await reorderIntakeFormFields(t, form.id, ids)
      refresh()
    } catch {
      setActionError('Could not reorder fields.')
    }
  }

  return (
    <main className="dash-main">
      <header className="dash-topbar">
        <h1>Intake Form Builder</h1>
        <div className="topbar-actions">
          <span className="chip">
            Forms <span className="chip-badge">{forms.length}</span>
          </span>
          <button type="button" className="btn-solid" onClick={() => setShowCreate((v) => !v)}>
            <IconPlus /> New Form
          </button>
        </div>
      </header>

      {showCreate && (
        <form className="card intake-builder-form" onSubmit={handleCreateForm}>
          <label className="field">
            <span>Title</span>
            <input
              type="text"
              value={createForm.title}
              onChange={(e) => setCreateForm((f) => ({ ...f, title: e.target.value }))}
              placeholder="NDA Request…"
              autoComplete="off"
              required
            />
          </label>
          <label className="field">
            <span>Description (shown to whoever submits it)</span>
            <textarea
              rows={2}
              value={createForm.description}
              onChange={(e) => setCreateForm((f) => ({ ...f, description: e.target.value }))}
            />
          </label>
          {createError && <p className="contract-error" aria-live="polite">{createError}</p>}
          <div className="contract-actions">
            <button type="button" className="btn-ghost" onClick={() => setShowCreate(false)}>
              Cancel
            </button>
            <button type="submit" className="btn-solid" disabled={creating}>
              {creating ? 'Creating…' : 'Create Form'}
            </button>
          </div>
        </form>
      )}

      {status === 'loading' && (
        <div className="dash-state" role="status" aria-live="polite">
          <span className="dash-spinner" aria-hidden="true" />
          <p>Loading intake forms…</p>
        </div>
      )}

      {status === 'error' && (
        <div className="dash-state" role="status" aria-live="polite">
          <p>Couldn&rsquo;t reach the backend for intake forms.</p>
          <button type="button" className="btn-ghost" onClick={refresh}>
            Retry
          </button>
        </div>
      )}

      {actionError && <p className="contract-error" aria-live="polite">{actionError}</p>}

      {status === 'ready' && (
        <div className="intake-builder-list">
          {forms.map((form) => (
            <div key={form.id} className="card intake-builder-card">
              {editingFormId === form.id ? (
                <form onSubmit={handleSaveFormEdit} className="intake-builder-form-edit">
                  <label className="field">
                    <span>Title</span>
                    <input
                      value={editFormInput.title}
                      onChange={(e) => setEditFormInput((f) => ({ ...f, title: e.target.value }))}
                      required
                      autoComplete="off"
                    />
                  </label>
                  <label className="field">
                    <span>Description</span>
                    <textarea
                      rows={2}
                      value={editFormInput.description}
                      onChange={(e) => setEditFormInput((f) => ({ ...f, description: e.target.value }))}
                    />
                  </label>
                  <div className="contract-actions">
                    <button type="button" className="btn-ghost" onClick={() => setEditingFormId(null)}>
                      Cancel
                    </button>
                    <button type="submit" className="btn-solid">
                      Save
                    </button>
                  </div>
                </form>
              ) : (
                <div className="intake-builder-card-header">
                  <button
                    type="button"
                    className="intake-builder-card-title"
                    onClick={() => setExpandedFormId((id) => (id === form.id ? null : form.id))}
                    aria-expanded={expandedFormId === form.id}
                  >
                    {form.title}
                  </button>
                  <div className="intake-builder-card-badges">
                    {form.is_system && <span className="chip small">System</span>}
                    <span className={`chip small${form.is_published ? ' active' : ''}`}>
                      {form.is_published ? 'Published' : 'Draft'}
                    </span>
                  </div>
                  {!form.is_system && (
                    <div className="template-card-actions">
                      <button
                        type="button"
                        className="icon-btn"
                        onClick={() => handleTogglePublish(form)}
                        aria-label={form.is_published ? `Unpublish ${form.title}` : `Publish ${form.title}`}
                      >
                        {form.is_published ? 'Unpublish' : 'Publish'}
                      </button>
                      <button type="button" className="icon-btn" onClick={() => startEditForm(form)} aria-label={`Edit ${form.title}`}>
                        <IconEdit />
                      </button>
                      <button type="button" className="icon-btn" onClick={() => handleDeleteForm(form)} aria-label={`Delete ${form.title}`}>
                        <IconTrash />
                      </button>
                    </div>
                  )}
                </div>
              )}

              {form.description && <p className="template-description">{form.description}</p>}

              {expandedFormId === form.id && (
                <div className="intake-builder-fields">
                  {form.fields.map((field, index) =>
                    editingFieldId === field.id ? (
                      <form
                        key={field.id}
                        className="intake-builder-field-row intake-builder-field-edit"
                        onSubmit={(e) => handleSaveFieldEdit(e, form.id, field.id)}
                      >
                        <label className="field">
                          <span>Label</span>
                          <input
                            value={fieldInput.label}
                            onChange={(e) => setFieldInput((f) => ({ ...f, label: e.target.value }))}
                            required
                            autoComplete="off"
                          />
                        </label>
                        <label className="field">
                          <span>Field type</span>
                          <select
                            value={fieldInput.field_type}
                            onChange={(e) => setFieldInput((f) => ({ ...f, field_type: e.target.value as FieldType }))}
                          >
                            {Object.entries(FIELD_TYPE_LABELS).map(([value, label]) => (
                              <option key={value} value={value}>
                                {label}
                              </option>
                            ))}
                          </select>
                        </label>
                        <label className="field-checkbox">
                          <input
                            type="checkbox"
                            checked={fieldInput.is_required}
                            onChange={(e) => setFieldInput((f) => ({ ...f, is_required: e.target.checked }))}
                          />
                          <span>Required</span>
                        </label>
                        {fieldInput.field_type === 'dropdown' && (
                          <label className="field">
                            <span>Dropdown options</span>
                            <input
                              value={fieldInput.optionsText}
                              onChange={(e) => setFieldInput((f) => ({ ...f, optionsText: e.target.value }))}
                              placeholder="Option A, Option B…"
                              autoComplete="off"
                            />
                          </label>
                        )}
                        <div className="contract-actions">
                          <button type="button" className="btn-ghost" onClick={() => setEditingFieldId(null)}>
                            Cancel
                          </button>
                          <button type="submit" className="btn-solid">
                            Save
                          </button>
                        </div>
                      </form>
                    ) : (
                      <div key={field.id} className="intake-builder-field-row">
                        <div className="intake-builder-field-reorder">
                          <button
                            type="button"
                            className="icon-btn"
                            disabled={index === 0 || form.is_system}
                            onClick={() => handleMoveField(form, index, -1)}
                            aria-label={`Move ${field.label} up`}
                          >
                            <IconArrowUp />
                          </button>
                          <button
                            type="button"
                            className="icon-btn"
                            disabled={index === form.fields.length - 1 || form.is_system}
                            onClick={() => handleMoveField(form, index, 1)}
                            aria-label={`Move ${field.label} down`}
                          >
                            <IconArrowDown />
                          </button>
                        </div>
                        <span className="intake-builder-field-label">
                          {field.label}
                          {field.is_required && <span className="muted"> *</span>}
                        </span>
                        <span className="chip small">{FIELD_TYPE_LABELS[field.field_type]}</span>
                        {!form.is_system && (
                          <div className="template-card-actions">
                            <button type="button" className="icon-btn" onClick={() => startEditField(field)} aria-label={`Edit ${field.label}`}>
                              <IconEdit />
                            </button>
                            <button
                              type="button"
                              className="icon-btn"
                              onClick={() => handleDeleteField(form.id, field)}
                              aria-label={`Delete ${field.label}`}
                            >
                              <IconTrash />
                            </button>
                          </div>
                        )}
                      </div>
                    ),
                  )}
                  {form.fields.length === 0 && <p className="muted">No fields yet.</p>}

                  {!form.is_system &&
                    (addingFieldTo === form.id ? (
                      <form className="intake-builder-field-row intake-builder-field-edit" onSubmit={(e) => handleAddField(e, form.id)}>
                        <label className="field">
                          <span>Label</span>
                          <input
                            value={fieldInput.label}
                            onChange={(e) => setFieldInput((f) => ({ ...f, label: e.target.value }))}
                            placeholder="Field label…"
                            autoComplete="off"
                            required
                          />
                        </label>
                        <label className="field">
                          <span>Field type</span>
                          <select
                            value={fieldInput.field_type}
                            onChange={(e) => setFieldInput((f) => ({ ...f, field_type: e.target.value as FieldType }))}
                          >
                            {Object.entries(FIELD_TYPE_LABELS).map(([value, label]) => (
                              <option key={value} value={value}>
                                {label}
                              </option>
                            ))}
                          </select>
                        </label>
                        <label className="field-checkbox">
                          <input
                            type="checkbox"
                            checked={fieldInput.is_required}
                            onChange={(e) => setFieldInput((f) => ({ ...f, is_required: e.target.checked }))}
                          />
                          <span>Required</span>
                        </label>
                        {fieldInput.field_type === 'dropdown' && (
                          <label className="field">
                            <span>Dropdown options</span>
                            <input
                              value={fieldInput.optionsText}
                              onChange={(e) => setFieldInput((f) => ({ ...f, optionsText: e.target.value }))}
                              placeholder="Option A, Option B…"
                              autoComplete="off"
                            />
                          </label>
                        )}
                        <div className="contract-actions">
                          <button type="button" className="btn-ghost" onClick={() => setAddingFieldTo(null)}>
                            Cancel
                          </button>
                          <button type="submit" className="btn-solid">
                            Add Field
                          </button>
                        </div>
                      </form>
                    ) : (
                      <button
                        type="button"
                        className="btn-ghost"
                        onClick={() => {
                          setFieldInput(emptyFieldInput)
                          setAddingFieldTo(form.id)
                        }}
                      >
                        <IconPlus /> Add Field
                      </button>
                    ))}
                </div>
              )}
            </div>
          ))}
          {forms.length === 0 && <p className="muted">No intake forms yet.</p>}
        </div>
      )}
    </main>
  )
}

export default IntakeFormBuilder
