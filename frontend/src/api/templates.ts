import { apiRequest, BASE_URL, ApiError } from './client'

export interface Template {
  id: string
  firm_id: string
  title: string
  description: string | null
  category: string
  original_filename: string
  content_type: string
  version: number
  created_at: string
}

export interface UpdateTemplatePayload {
  title?: string
  description?: string | null
  category?: string
}

export interface TemplateDownload {
  download_url: string
  expires_in_seconds: number
}

export async function listTemplates(token: string): Promise<Template[]> {
  return apiRequest<Template[]>('/templates', { token })
}

export async function downloadTemplate(token: string, templateId: string): Promise<TemplateDownload> {
  return apiRequest<TemplateDownload>(`/templates/${templateId}/download`, { token })
}

export async function updateTemplate(
  token: string,
  templateId: string,
  payload: UpdateTemplatePayload,
): Promise<Template> {
  return apiRequest<Template>(`/templates/${templateId}`, { method: 'PATCH', body: payload, token })
}

export async function uploadTemplate(
  token: string,
  fields: { title: string; description?: string; category: string; file: File },
): Promise<Template> {
  const form = new FormData()
  form.append('title', fields.title)
  if (fields.description) form.append('description', fields.description)
  form.append('category', fields.category)
  form.append('file', fields.file)

  const res = await fetch(`${BASE_URL}/templates`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: form,
  })

  if (!res.ok) {
    const errorData = await res.json().catch(() => null)
    throw new ApiError(res.status, errorData?.detail || `Request failed (${res.status})`)
  }

  return res.json()
}
