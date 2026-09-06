import { apiRequest } from './client'

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
  firm_id: string
  title: string
  description: string | null
  is_published: boolean
  is_system: boolean
  created_at: string
  updated_at: string
  fields: IntakeField[]
}

export interface CreateIntakeFormPayload {
  title: string
  description?: string | null
}

export interface UpdateIntakeFormPayload {
  title?: string
  description?: string | null
  is_published?: boolean
}

export interface CreateIntakeFieldPayload {
  label: string
  field_type: FieldType
  is_required?: boolean
  help_text?: string | null
  options?: string[] | null
}

export interface UpdateIntakeFieldPayload {
  label?: string
  field_type?: FieldType
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

export async function createIntakeForm(token: string, payload: CreateIntakeFormPayload): Promise<IntakeForm> {
  return apiRequest<IntakeForm>('/intake-forms', { method: 'POST', body: payload, token })
}

export async function updateIntakeForm(
  token: string,
  formId: string,
  payload: UpdateIntakeFormPayload,
): Promise<IntakeForm> {
  return apiRequest<IntakeForm>(`/intake-forms/${formId}`, { method: 'PATCH', body: payload, token })
}

export async function deleteIntakeForm(token: string, formId: string): Promise<void> {
  return apiRequest<void>(`/intake-forms/${formId}`, { method: 'DELETE', token })
}

export async function createIntakeField(
  token: string,
  formId: string,
  payload: CreateIntakeFieldPayload,
): Promise<IntakeField> {
  return apiRequest<IntakeField>(`/intake-forms/${formId}/fields`, { method: 'POST', body: payload, token })
}

export async function updateIntakeField(
  token: string,
  formId: string,
  fieldId: string,
  payload: UpdateIntakeFieldPayload,
): Promise<IntakeField> {
  return apiRequest<IntakeField>(`/intake-forms/${formId}/fields/${fieldId}`, {
    method: 'PATCH',
    body: payload,
    token,
  })
}

export async function deleteIntakeField(token: string, formId: string, fieldId: string): Promise<void> {
  return apiRequest<void>(`/intake-forms/${formId}/fields/${fieldId}`, { method: 'DELETE', token })
}

export async function reorderIntakeFields(
  token: string,
  formId: string,
  fieldIds: string[],
): Promise<IntakeField[]> {
  return apiRequest<IntakeField[]>(`/intake-forms/${formId}/fields/reorder`, {
    method: 'POST',
    body: { field_ids: fieldIds },
    token,
  })
}
