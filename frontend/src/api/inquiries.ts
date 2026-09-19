import { apiRequest } from './client'

export type InquiryKind = 'contact' | 'access_request'
export type InquiryStatus = 'new' | 'in_progress' | 'onboarded' | 'closed'

export interface SubmitInquiryPayload {
  kind: InquiryKind
  name: string
  email: string
  phone?: string | null
  organization_name?: string | null
  message?: string | null
  consent: boolean
  /** Honeypot. Rendered hidden on the form and always sent empty by real visitors. */
  website?: string
}

export async function submitInquiry(payload: SubmitInquiryPayload): Promise<{ message: string }> {
  return apiRequest<{ message: string }>('/inquiries', {
    method: 'POST',
    body: payload,
    skipAuthRedirect: true,
  })
}
