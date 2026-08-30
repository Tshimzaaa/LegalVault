import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import './IntakeFormBuilder.css'
import { IconPlus, IconEdit, IconTrash, IconArrowUp, IconArrowDown, IconChevron } from '../../components/icons'
import {
  listIntakeForms,
  createIntakeForm,
  updateIntakeForm,
  deleteIntakeForm,
  createIntakeField,
  updateIntakeField,
  deleteIntakeField,
  reorderIntakeFields,
} from '../../api/intakeForms'
import type { IntakeForm, IntakeField, FieldType } from '../../api/intakeForms'
import { ApiError } from '../../api/client'
import PermissionError from '../../components/PermissionError'
import type { User } from '../../api/auth'

type LoadState = 'loading' | 'error' | 'ready'

const fieldTypeLabel: Record<FieldType, string> = {
  text: 'Text',
  textarea: 'Long Text',
  number: 'Number',
  date: 'Date',
  dropdown: 'Dropdown',
  checkbox: 'Checkbox',
  file: 'File Upload',
}

const fieldTypeOptions: FieldType[] = ['text', 'textarea', 'number', 'date', 'dropdown', 'checkbox', 'file']

function permissionOrGenericMessage(e: unknown, fallback: string): string {
  return e instanceof ApiError && e.status === 403 ? e.message : fallback
}

interface IntakeFormBuilderProps {
  user: User
}

function IntakeFormBuilder({ user }: IntakeFormBuilderProps) {
  const [forms, setForms] = useState<IntakeForm[]>([])
  const [status, setStatus] = useState<LoadState>('loading')
  const [attempt, setAttempt] = useState(0)
  const token = localStorage.getItem('access_token')

  const [showNewForm, setShowNewForm] = useState(false)
  const [newTitle, setNewTitle] = useState('')
  const [newDescription, setNewDescription] = useState('')
  const [creatingForm, setCreatingForm] = useState(false)
  const [createFormError, setCreateFormError] = useState<string | null>(null)

  const [expandedFormId, setExpandedFormId] = useState<string | null>(null)
  const [editingFormId, setEditingFormId] = useState<string | null>(null)
  const [editTitle, setEditTitle] = useState('')
  const [editDescription, setEditDescription] = useState('')
  const [formSaving, setFormSaving] = useState(false)
  const [formActionError, setFormActionError] = useState<string | null>(null)

  const [addFieldFormId, setAddFieldFormId] = useState<string | null>(null)
  const [newFieldLabel, setNewFieldLabel] = useState('')
  const [newFieldType, setNewFieldType] = useState<FieldType>('text')
  const [newFieldRequired, setNewFieldRequired] = useState(false)
  const [newFieldHelp, setNewFieldHelp] = useState('')
  const [newFieldOptions, setNewFieldOptions] = useState('')
  const [addingField, setAddingField] = useState(false)
  const [fieldActionError, setFieldActionError] = useState<string | null>(null)

  const [editingFieldId, setEditingFieldId] = useState<string | null>(null)
  const [editFieldLabel, setEditFieldLabel] = useState('')
  const [editFieldType, setEditFieldType] = useState<FieldType>('text')
  const [editFieldRequired, setEditFieldRequired] = useState(false)
  const [editFieldHelp, setEditFieldHelp] = useState('')
  const [editFieldOptions, setEditFieldOptions] = useState('')
  const [fieldSaving, setFieldSaving] = useState(false)

  const [reorderingFormId, setReorderingFormId] = useState<string | null>(null)

  useEffect(() => {
    if (user.role !== 'admin') return
    let cancelled = false
    setStatus('loading')

    if (!token) {
      setStatus('error')
      return
    }

    listIntakeForms(token)
      .then((data) => {
        if (cancelled) return
        setForms(data)
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

  if (user.role !== 'admin') {
    return (
      <main className="dash-main">
        <header className="dash-topbar">
          <h1>Intake Forms</h1>
        </header>
        <div className="dash-state">
          <PermissionError message="Only firm admins can build intake forms." />
        </div>
      </main>
    )
  }

  function replaceForm(updated: IntakeForm) {
    setForms((prev) => prev.map((f) => (f.id === updated.id ? updated : f)))
  }

  async function handleCreateForm(e: FormEvent) {
    e.preventDefault()
    if (!token || !newTitle) return
    setCreateFormError(null)
    setCreatingForm(true)
    try {
      const created = await createIntakeForm(token, { title: newTitle, description: newDescription || null })
      setForms((prev) => [created, ...prev])
      setNewTitle('')
      setNewDescription('')
      setShowNewForm(false)
    } catch (err) {
      setCreateFormError(permissionOrGenericMessage(err, 'Could not create the form. Please try again.'))
    } finally {
      setCreatingForm(false)
    }
  }

  function startEditForm(form: IntakeForm) {
    setEditingFormId(form.id)
    setEditTitle(form.title)
    setEditDescription(form.description ?? '')
    setFormActionError(null)
  }

  async function handleSaveFormEdit(e: FormEvent) {
    e.preventDefault()
    if (!token || !editingFormId) return
    setFormSaving(true)
    setFormActionError(null)
    try {
      const updated = await updateIntakeForm(token, editingFormId, {
        title: editTitle,
        description: editDescription || null,
      })
      replaceForm(updated)
      setEditingFormId(null)
    } catch (err) {
      setFormActionError(permissionOrGenericMessage(err, 'Could not save changes. Please try again.'))
    } finally {
      setFormSaving(false)
    }
  }

  async function handleTogglePublish(form: IntakeForm) {
    if (!token) return
    setFormActionError(null)
    try {
      const updated = await updateIntakeForm(token, form.id, { is_published: !form.is_published })
      replaceForm(updated)
    } catch (err) {
      setFormActionError(permissionOrGenericMessage(err, 'Could not update publish status. Please try again.'))
    }
  }

  async function handleDeleteForm(form: IntakeForm) {
    if (!token) return
    if (!window.confirm(`Delete "${form.title}"? This cannot be undone.`)) return
    setFormActionError(null)
    try {
      await deleteIntakeForm(token, form.id)
      setForms((prev) => prev.filter((f) => f.id !== form.id))
      if (expandedFormId === form.id) setExpandedFormId(null)
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) {
        setFormActionError('This form already has submissions and can’t be deleted.')
      } else {
        setFormActionError(permissionOrGenericMessage(err, 'Could not delete the form. Please try again.'))
      }
    }
  }

  function startAddField(formId: string) {
    setAddFieldFormId(formId)
    setNewFieldLabel('')
    setNewFieldType('text')
    setNewFieldRequired(false)
    setNewFieldHelp('')
    setNewFieldOptions('')
    setFieldActionError(null)
  }

  function parseOptions(raw: string): string[] | null {
    const opts = raw
      .split(',')
      .map((o) => o.trim())
      .filter(Boolean)
    return opts.length > 0 ? opts : null
  }

  async function handleAddField(e: FormEvent, form: IntakeForm) {
    e.preventDefault()
    if (!token || !newFieldLabel) return
    setAddingField(true)
    setFieldActionError(null)
    try {
      const created = await createIntakeField(token, form.id, {
        label: newFieldLabel,
        field_type: newFieldType,
        is_required: newFieldRequired,
        help_text: newFieldHelp || null,
        options: newFieldType === 'dropdown' ? parseOptions(newFieldOptions) : null,
      })
      replaceForm({ ...form, fields: [...form.fields, created] })
      setAddFieldFormId(null)
    } catch (err) {
      setFieldActionError(permissionOrGenericMessage(err, 'Could not add the field. Please try again.'))
    } finally {
      setAddingField(false)
    }
  }

  function startEditField(field: IntakeField) {
    setEditingFieldId(field.id)
    setEditFieldLabel(field.label)
    setEditFieldType(field.field_type)
    setEditFieldRequired(field.is_required)
    setEditFieldHelp(field.help_text ?? '')
    setEditFieldOptions((field.options ?? []).join(', '))
    setFieldActionError(null)
  }

  async function handleSaveFieldEdit(e: FormEvent, form: IntakeForm) {
    e.preventDefault()
    if (!token || !editingFieldId) return
    setFieldSaving(true)
    setFieldActionError(null)
    try {
      const updated = await updateIntakeField(token, form.id, editingFieldId, {
        label: editFieldLabel,
        field_type: editFieldType,
        is_required: editFieldRequired,
        help_text: editFieldHelp || null,
        options: editFieldType === 'dropdown' ? parseOptions(editFieldOptions) : null,
      })
      replaceForm({ ...form, fields: form.fields.map((f) => (f.id === updated.id ? updated : f)) })
      setEditingFieldId(null)
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) {
        setFieldActionError('This field already has responses — its type can’t be changed, but the label and help text still can.')
      } else {
        setFieldActionError(permissionOrGenericMessage(err, 'Could not save changes. Please try again.'))
      }
    } finally {
      setFieldSaving(false)
    }
  }

  async function handleDeleteField(form: IntakeForm, field: IntakeField) {
    if (!token) return
    if (!window.confirm(`Delete field "${field.label}"?`)) return
    setFieldActionError(null)
    try {
      await deleteIntakeField(token, form.id, field.id)
      replaceForm({ ...form, fields: form.fields.filter((f) => f.id !== field.id) })
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) {
        setFieldActionError('This field already has responses and can’t be deleted.')
      } else {
        setFieldActionError(permissionOrGenericMessage(err, 'Could not delete the field. Please try again.'))
      }
    }
  }

  async function handleMoveField(form: IntakeForm, index: number, direction: -1 | 1) {
    if (!token) return
    const targetIndex = index + direction
    if (targetIndex < 0 || targetIndex >= form.fields.length) return

    const reordered = [...form.fields]
    const [moved] = reordered.splice(index, 1)
    reordered.splice(targetIndex, 0, moved)

    const previousFields = form.fields
    replaceForm({ ...form, fields: reordered })
    setReorderingFormId(form.id)
    setFieldActionError(null)
    try {
      await reorderIntakeFields(token, form.id, reordered.map((f) => f.id))
    } catch (err) {
      replaceForm({ ...form, fields: previousFields })
      setFieldActionError(permissionOrGenericMessage(err, 'Could not reorder fields. Please try again.'))
    } finally {
      setReorderingFormId(null)
    }
  }

  return (
    <main className="dash-main">
      <header className="dash-topbar">
        <h1>Intake Forms</h1>
        <div className="topbar-actions">
          <span className="chip">
            Forms <span className="chip-badge">{forms.length}</span>
          </span>
          <button type="button" className="btn-solid" onClick={() => setShowNewForm((v) => !v)}>
            <IconPlus /> New Form
          </button>
        </div>
      </header>

      {showNewForm && (
        <form className="card intake-new-form-card" onSubmit={handleCreateForm}>
          <div className="field-row">
            <label className="field">
              <span>Title</span>
              <input
                type="text"
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                placeholder="New Client Intake…"
                autoComplete="off"
              />
            </label>
            <label className="field">
              <span>Description</span>
              <input
                type="text"
                value={newDescription}
                onChange={(e) => setNewDescription(e.target.value)}
                placeholder="Optional summary shown to clients…"
                autoComplete="off"
              />
            </label>
          </div>
          <div className="matter-actions">
            <button type="button" className="btn-ghost" onClick={() => setShowNewForm(false)}>
              Cancel
            </button>
            <button type="submit" className="btn-solid" disabled={creatingForm}>
              {creatingForm ? 'Creating…' : 'Create Form'}
            </button>
          </div>
          {createFormError && <p className="matter-error" aria-live="polite">{createFormError}</p>}
        </form>
      )}

      {status === 'loading' && (
        <div className="dash-state" role="status" aria-live="polite">
          <span className="dash-spinner" aria-hidden="true" />
          <p>Loading intake forms…</p>
        </div>
      )}

      {status === 'error' && (
        <div className="dash-state">
          <p>Couldn&rsquo;t reach the backend for intake forms.</p>
          <button type="button" className="btn-ghost" onClick={() => setAttempt((n) => n + 1)}>
            Retry
          </button>
        </div>
      )}

      {formActionError && <p className="matter-error" aria-live="polite">{formActionError}</p>}

      {status === 'ready' && (
        <section className="intake-form-list">
          {forms.map((form) => {
            const expanded = expandedFormId === form.id
            return (
              <div key={form.id} className="card intake-form-card">
                {editingFormId === form.id ? (
                  <form onSubmit={handleSaveFormEdit} className="intake-form-edit-form">
                    <label className="field">
                      <span>Title</span>
                      <input
                        value={editTitle}
                        onChange={(e) => setEditTitle(e.target.value)}
                        required
                        autoComplete="off"
                      />
                    </label>
                    <label className="field">
                      <span>Description</span>
                      <input value={editDescription} onChange={(e) => setEditDescription(e.target.value)} autoComplete="off" />
                    </label>
                    <div className="matter-actions">
                      <button type="button" className="btn-ghost" onClick={() => setEditingFormId(null)}>
                        Cancel
                      </button>
                      <button type="submit" className="btn-solid" disabled={formSaving}>
                        {formSaving ? 'Saving…' : 'Save'}
                      </button>
                    </div>
                  </form>
                ) : (
                  <div className="intake-form-header">
                    <button
                      type="button"
                      className="intake-form-header-toggle"
                      onClick={() => setExpandedFormId(expanded ? null : form.id)}
                    >
                      <span className={`intake-form-chevron${expanded ? ' expanded' : ''}`}>
                        <IconChevron />
                      </span>
                      <span className="intake-form-title-block">
                        <span className="intake-form-title-row">
                          <span className="intake-form-title">{form.title}</span>
                          <span className={`status-badge${form.is_published ? ' published' : ''}`}>
                            {form.is_published ? 'Published' : 'Draft'}
                          </span>
                        </span>
                        {form.description && <span className="muted intake-form-description">{form.description}</span>}
                      </span>
                    </button>
                    <div className="intake-form-actions">
                      <button
                        type="button"
                        className="btn-ghost intake-publish-btn"
                        onClick={() => handleTogglePublish(form)}
                      >
                        {form.is_published ? 'Unpublish' : 'Publish'}
                      </button>
                      <button
                        type="button"
                        className="icon-btn"
                        onClick={() => startEditForm(form)}
                        aria-label={`Edit ${form.title}`}
                      >
                        <IconEdit />
                      </button>
                      <button
                        type="button"
                        className="icon-btn"
                        onClick={() => handleDeleteForm(form)}
                        aria-label={`Delete ${form.title}`}
                      >
                        <IconTrash />
                      </button>
                    </div>
                  </div>
                )}

                {expanded && (
                  <div className="intake-fields-panel">
                    {fieldActionError && <p className="matter-error" aria-live="polite">{fieldActionError}</p>}
                    {form.fields.length === 0 && <p className="muted">No fields yet — add the first one below.</p>}
                    <ul className="intake-fields-list">
                      {form.fields.map((field, index) =>
                        editingFieldId === field.id ? (
                          <li key={field.id} className="intake-field-row intake-field-edit">
                            <form onSubmit={(e) => handleSaveFieldEdit(e, form)} className="intake-field-edit-form">
                              <div className="field-row">
                                <label className="field">
                                  <span>Label</span>
                                  <input
                                    value={editFieldLabel}
                                    onChange={(e) => setEditFieldLabel(e.target.value)}
                                    required
                                    autoComplete="off"
                                  />
                                </label>
                                <label className="field">
                                  <span>Type</span>
                                  <select
                                    value={editFieldType}
                                    onChange={(e) => setEditFieldType(e.target.value as FieldType)}
                                  >
                                    {fieldTypeOptions.map((t) => (
                                      <option key={t} value={t}>
                                        {fieldTypeLabel[t]}
                                      </option>
                                    ))}
                                  </select>
                                </label>
                              </div>
                              <label className="field">
                                <span>Help text</span>
                                <input
                                  value={editFieldHelp}
                                  onChange={(e) => setEditFieldHelp(e.target.value)}
                                  autoComplete="off"
                                />
                              </label>
                              {editFieldType === 'dropdown' && (
                                <label className="field">
                                  <span>Options (comma-separated)</span>
                                  <input
                                    value={editFieldOptions}
                                    onChange={(e) => setEditFieldOptions(e.target.value)}
                                    placeholder="Yes, No…"
                                    autoComplete="off"
                                  />
                                </label>
                              )}
                              <label className="intake-required-checkbox">
                                <input
                                  type="checkbox"
                                  checked={editFieldRequired}
                                  onChange={(e) => setEditFieldRequired(e.target.checked)}
                                />
                                <span>Required</span>
                              </label>
                              <div className="matter-actions">
                                <button type="button" className="btn-ghost" onClick={() => setEditingFieldId(null)}>
                                  Cancel
                                </button>
                                <button type="submit" className="btn-solid" disabled={fieldSaving}>
                                  {fieldSaving ? 'Saving…' : 'Save'}
                                </button>
                              </div>
                            </form>
                          </li>
                        ) : (
                          <li key={field.id} className="intake-field-row">
                            <div className="intake-field-reorder">
                              <button
                                type="button"
                                className="icon-btn"
                                disabled={index === 0 || reorderingFormId === form.id}
                                onClick={() => handleMoveField(form, index, -1)}
                                aria-label={`Move ${field.label} up`}
                              >
                                <IconArrowUp />
                              </button>
                              <button
                                type="button"
                                className="icon-btn"
                                disabled={index === form.fields.length - 1 || reorderingFormId === form.id}
                                onClick={() => handleMoveField(form, index, 1)}
                                aria-label={`Move ${field.label} down`}
                              >
                                <IconArrowDown />
                              </button>
                            </div>
                            <div className="intake-field-info">
                              <span className="intake-field-label">{field.label}</span>
                              <span className="intake-field-badges">
                                <span className="chip small">{fieldTypeLabel[field.field_type]}</span>
                                {field.is_required && <span className="chip small intake-required-badge">Required</span>}
                              </span>
                              {field.help_text && <span className="muted intake-field-help">{field.help_text}</span>}
                            </div>
                            <div className="intake-field-actions">
                              <button
                                type="button"
                                className="icon-btn"
                                onClick={() => startEditField(field)}
                                aria-label={`Edit ${field.label}`}
                              >
                                <IconEdit />
                              </button>
                              <button
                                type="button"
                                className="icon-btn"
                                onClick={() => handleDeleteField(form, field)}
                                aria-label={`Delete ${field.label}`}
                              >
                                <IconTrash />
                              </button>
                            </div>
                          </li>
                        ),
                      )}
                    </ul>

                    {addFieldFormId === form.id ? (
                      <form onSubmit={(e) => handleAddField(e, form)} className="card intake-add-field-form">
                        <div className="field-row">
                          <label className="field">
                            <span>Label</span>
                            <input
                              value={newFieldLabel}
                              onChange={(e) => setNewFieldLabel(e.target.value)}
                              placeholder="Company Name…"
                              autoComplete="off"
                            />
                          </label>
                          <label className="field">
                            <span>Type</span>
                            <select value={newFieldType} onChange={(e) => setNewFieldType(e.target.value as FieldType)}>
                              {fieldTypeOptions.map((t) => (
                                <option key={t} value={t}>
                                  {fieldTypeLabel[t]}
                                </option>
                              ))}
                            </select>
                          </label>
                        </div>
                        <label className="field">
                          <span>Help text</span>
                          <input
                            value={newFieldHelp}
                            onChange={(e) => setNewFieldHelp(e.target.value)}
                            placeholder="Optional guidance shown under the field…"
                            autoComplete="off"
                          />
                        </label>
                        {newFieldType === 'dropdown' && (
                          <label className="field">
                            <span>Options (comma-separated)</span>
                            <input
                              value={newFieldOptions}
                              onChange={(e) => setNewFieldOptions(e.target.value)}
                              placeholder="Yes, No…"
                              autoComplete="off"
                            />
                          </label>
                        )}
                        <label className="intake-required-checkbox">
                          <input
                            type="checkbox"
                            checked={newFieldRequired}
                            onChange={(e) => setNewFieldRequired(e.target.checked)}
                          />
                          <span>Required</span>
                        </label>
                        <div className="matter-actions">
                          <button type="button" className="btn-ghost" onClick={() => setAddFieldFormId(null)}>
                            Cancel
                          </button>
                          <button type="submit" className="btn-solid" disabled={addingField}>
                            {addingField ? 'Adding…' : 'Add Field'}
                          </button>
                        </div>
                      </form>
                    ) : (
                      <button type="button" className="btn-ghost" onClick={() => startAddField(form.id)}>
                        <IconPlus /> Add Field
                      </button>
                    )}
                  </div>
                )}
              </div>
            )
          })}
          {forms.length === 0 && <p className="muted">No intake forms yet. Create one to get started.</p>}
        </section>
      )}
    </main>
  )
}

export default IntakeFormBuilder
