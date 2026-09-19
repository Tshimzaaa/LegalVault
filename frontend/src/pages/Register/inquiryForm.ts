import { ApiError } from '../../api/client'

/** Maps a failed inquiry submission to a message a visitor can act on. */
export function inquiryErrorMessage(err: unknown): string {
  if (err instanceof ApiError) {
    if (err.status === 429) return 'Too many requests. Please try again later.'
    if (err.status === 422) return 'Some of your details look invalid. Please check the fields and try again.'
    if (err.status >= 500) return 'Something went wrong on our side. Please try again in a moment.'
    return err.message && !err.message.includes('[object') ? err.message : 'We could not send your request. Please try again.'
  }
  return 'We could not reach the server. Check your connection and try again.'
}

export const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export interface InquiryFields {
  name: string
  email: string
  phone: string
  organization: string
  message: string
}

export type InquiryFieldErrors = Partial<Record<keyof InquiryFields | 'consent', string>>

/** Client-side mirror of the API limits, so visitors get per-field feedback. */
export function validateInquiry(
  f: InquiryFields,
  opts: { orgRequired: boolean; messageRequired: boolean; consent: boolean },
): InquiryFieldErrors {
  const e: InquiryFieldErrors = {}
  const name = f.name.trim()
  if (name.length < 2) e.name = 'Enter your name (at least 2 characters).'
  else if (name.length > 150) e.name = 'Name must be 150 characters or fewer.'
  if (!EMAIL_PATTERN.test(f.email.trim())) e.email = 'Enter a valid email address.'
  if (f.phone.trim().length > 30) e.phone = 'Phone number must be 30 characters or fewer.'
  const org = f.organization.trim()
  if (opts.orgRequired && !org) e.organization = 'Enter your firm or organization name.'
  else if (org.length > 150) e.organization = 'Name must be 150 characters or fewer.'
  const msg = f.message.trim()
  if (opts.messageRequired && !msg) e.message = 'Tell us how we can help.'
  else if (msg.length > 5000) e.message = 'Message must be 5000 characters or fewer.'
  if (!opts.consent) e.consent = 'Please confirm you agree to be contacted.'
  return e
}
