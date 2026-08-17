import { apiRequest, apiUpload } from './client'
import type { IntakeForm } from './intakeForms'
import type { IntakeSubmission } from './intakeSubmissions'

export async function listPublishedIntakeForms(token: string): Promise<IntakeForm[]> {
  return apiRequest<IntakeForm[]>('/client-intake/forms', { token })
}

export async function getPublishedIntakeForm(token: string, formId: string): Promise<IntakeForm> {
  return apiRequest<IntakeForm>(`/client-intake/forms/${formId}`, { token })
}

export interface SubmitIntakeFormFile {
  fieldId: string
  file: File
}

/** answers: non-file field_id -> value (blank optional fields should be omitted, not sent as ''). */
export async function submitIntakeForm(
  token: string,
  formId: string,
  answers: Record<string, string>,
  files: SubmitIntakeFormFile[],
): Promise<IntakeSubmission> {
  const form = new FormData()
  form.append('answers_json', JSON.stringify(answers))
  for (const { fieldId, file } of files) {
    form.append('file_field_ids', fieldId)
    form.append('files', file)
  }
  return apiUpload<IntakeSubmission>(`/client-intake/forms/${formId}/submit`, form, token)
}

export async function listMyIntakeSubmissions(token: string): Promise<IntakeSubmission[]> {
  return apiRequest<IntakeSubmission[]>('/client-intake/submissions', { token })
}

export async function getMyIntakeSubmission(token: string, submissionId: string): Promise<IntakeSubmission> {
  return apiRequest<IntakeSubmission>(`/client-intake/submissions/${submissionId}`, { token })
}
