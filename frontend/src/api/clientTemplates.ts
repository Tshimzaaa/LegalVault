import { apiRequest } from './client'
import type { Template, TemplateDownload } from './templates'

export async function listClientTemplates(token: string): Promise<Template[]> {
  return apiRequest<Template[]>('/client-templates', { token })
}

export async function downloadClientTemplate(token: string, templateId: string): Promise<TemplateDownload> {
  return apiRequest<TemplateDownload>(`/client-templates/${templateId}/download`, { token })
}
