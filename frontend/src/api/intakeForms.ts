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
  org_id: string
  title: string
  description: string | null
  is_published: boolean
  is_system: boolean
  created_at: string
  updated_at: string
  fields: IntakeField[]
}

// Read-only: there's no form builder — every org has exactly the one system-seeded
// request form (see backend/app/modules/intake/system_forms.py). Staff only ever read
// it, to label answers in the submission-triage views.

export async function listIntakeForms(token: string): Promise<IntakeForm[]> {
  return apiRequest<IntakeForm[]>('/intake-forms', { token })
}

export async function getIntakeForm(token: string, formId: string): Promise<IntakeForm> {
  return apiRequest<IntakeForm>(`/intake-forms/${formId}`, { token })
}
