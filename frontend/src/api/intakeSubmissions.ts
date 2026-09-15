import { apiRequest } from './client'

export type SubmissionStatus = 'submitted' | 'in_review' | 'resolved' | 'converted' | 'declined'

export interface IntakeSubmissionAnswer {
  id: string
  field_id: string
  value: string | null
  original_filename: string | null
  content_type: string | null
}

export interface IntakeSubmission {
  id: string
  org_id: string
  form_id: string
  submitted_by: string
  status: SubmissionStatus
  converted_contract_id: string | null
  created_at: string
  updated_at: string
  answers: IntakeSubmissionAnswer[]
}

export async function listIntakeSubmissions(token: string): Promise<IntakeSubmission[]> {
  return apiRequest<IntakeSubmission[]>('/intake-submissions', { token })
}

export async function listMyIntakeSubmissions(token: string): Promise<IntakeSubmission[]> {
  return apiRequest<IntakeSubmission[]>('/intake-submissions/mine', { token })
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
    token,
    body: { status },
  })
}

export async function convertIntakeSubmission(
  token: string,
  submissionId: string,
  contractTitle?: string,
): Promise<IntakeSubmission> {
  return apiRequest<IntakeSubmission>(`/intake-submissions/${submissionId}/convert`, {
    method: 'POST',
    token,
    body: { contract_title: contractTitle ?? null },
  })
}
