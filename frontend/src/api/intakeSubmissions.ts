import { apiRequest } from './client'

export type SubmissionStatus = 'submitted' | 'in_review' | 'resolved' | 'converted' | 'declined'

export interface IntakeAnswer {
  id: string
  field_id: string
  value: string | null
  original_filename: string | null
  content_type: string | null
}

export interface IntakeSubmission {
  id: string
  firm_id: string
  form_id: string
  client_id: string
  contact_id: string
  status: SubmissionStatus
  converted_matter_id: string | null
  created_at: string
  updated_at: string
  answers: IntakeAnswer[]
}

export interface IntakeAnswerDownload {
  download_url: string
  expires_in_seconds: number
}

export async function listIntakeSubmissions(token: string): Promise<IntakeSubmission[]> {
  return apiRequest<IntakeSubmission[]>('/intake-submissions', { token })
}

export async function getIntakeSubmission(token: string, submissionId: string): Promise<IntakeSubmission> {
  return apiRequest<IntakeSubmission>(`/intake-submissions/${submissionId}`, { token })
}

export async function updateIntakeSubmissionStatus(
  token: string,
  submissionId: string,
  status: SubmissionStatus,
): Promise<IntakeSubmission> {
  return apiRequest<IntakeSubmission>(`/intake-submissions/${submissionId}/status`, {
    method: 'PATCH',
    body: { status },
    token,
  })
}

export async function convertIntakeSubmission(
  token: string,
  submissionId: string,
  matterTitle?: string,
): Promise<IntakeSubmission> {
  return apiRequest<IntakeSubmission>(`/intake-submissions/${submissionId}/convert`, {
    method: 'POST',
    body: { matter_title: matterTitle || undefined },
    token,
  })
}

export async function getIntakeAnswerDownloadUrl(
  token: string,
  submissionId: string,
  answerId: string,
): Promise<IntakeAnswerDownload> {
  return apiRequest<IntakeAnswerDownload>(`/intake-submissions/${submissionId}/answers/${answerId}/download`, {
    token,
  })
}
