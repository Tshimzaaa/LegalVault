import { apiRequest, BASE_URL } from './client'

export type FieldType = 'text' | 'textarea' | 'number' | 'date' | 'dropdown' | 'checkbox' | 'file'

export interface IntakeField {
  id: string
  form_id: string
  label: string
  key: string | null
  field_type: FieldType
  is_required: boolean
  help_text: string | null
  options: string[] | null
  display_order: number
}

export interface IntakeForm {
  id: string
  org_id: string
  title: string
  description: string | null
  is_published: boolean
  is_system: boolean
  created_at: string
  updated_at: string
  fields: IntakeField[]
}

export interface IntakeFormCreateInput {
  title: string
  description?: string | null
}

export interface IntakeFormUpdateInput {
  title?: string
  description?: string | null
}

export interface IntakeFormFieldInput {
  label: string
  field_type: FieldType
  is_required?: boolean
  help_text?: string | null
  options?: string[] | null
}

export async function listIntakeForms(token: string): Promise<IntakeForm[]> {
  return apiRequest<IntakeForm[]>('/intake-forms', { token })
}

export async function getIntakeForm(token: string, formId: string): Promise<IntakeForm> {
  return apiRequest<IntakeForm>(`/intake-forms/${formId}`, { token })
}

export async function createIntakeForm(token: string, input: IntakeFormCreateInput): Promise<IntakeForm> {
  return apiRequest<IntakeForm>('/intake-forms', { method: 'POST', token, body: input })
}

export async function updateIntakeForm(token: string, formId: string, input: IntakeFormUpdateInput): Promise<IntakeForm> {
  return apiRequest<IntakeForm>(`/intake-forms/${formId}`, { method: 'PATCH', token, body: input })
}

export async function deleteIntakeForm(token: string, formId: string): Promise<void> {
  return apiRequest<void>(`/intake-forms/${formId}`, { method: 'DELETE', token })
}

export async function publishIntakeForm(token: string, formId: string): Promise<IntakeForm> {
  return apiRequest<IntakeForm>(`/intake-forms/${formId}/publish`, { method: 'POST', token })
}

export async function unpublishIntakeForm(token: string, formId: string): Promise<IntakeForm> {
  return apiRequest<IntakeForm>(`/intake-forms/${formId}/unpublish`, { method: 'POST', token })
}

export async function addIntakeFormField(token: string, formId: string, input: IntakeFormFieldInput): Promise<IntakeField> {
  return apiRequest<IntakeField>(`/intake-forms/${formId}/fields`, { method: 'POST', token, body: input })
}

export async function updateIntakeFormField(
  token: string,
  formId: string,
  fieldId: string,
  input: Partial<IntakeFormFieldInput>,
): Promise<IntakeField> {
  return apiRequest<IntakeField>(`/intake-forms/${formId}/fields/${fieldId}`, { method: 'PATCH', token, body: input })
}

export async function deleteIntakeFormField(token: string, formId: string, fieldId: string): Promise<void> {
  return apiRequest<void>(`/intake-forms/${formId}/fields/${fieldId}`, { method: 'DELETE', token })
}

export async function reorderIntakeFormFields(token: string, formId: string, fieldIds: string[]): Promise<IntakeForm> {
  return apiRequest<IntakeForm>(`/intake-forms/${formId}/fields/reorder`, {
    method: 'PATCH',
    token,
    body: { field_ids: fieldIds },
  })
}

export async function submitIntakeForm(
  token: string,
  formId: string,
  answers: Record<string, string>,
): Promise<{ id: string; status: string }> {
  const formData = new FormData()
  formData.append('answers_json', JSON.stringify(answers))
  const res = await fetch(`${BASE_URL}/intake-forms/${formId}/submit`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: formData,
  })
  if (!res.ok) {
    const data = await res.json().catch(() => null)
    throw new Error(data?.detail || `Submit failed (${res.status})`)
  }
  return res.json()
}
