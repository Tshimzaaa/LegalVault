import { apiRequest } from './client'

export interface KnowledgeArticle {
  id: string
  firm_id: string
  title: string
  category: string
  content: string
  is_published: boolean
  created_at: string
  updated_at: string
}

export interface CreateKnowledgeArticlePayload {
  title: string
  category: string
  content: string
  is_published?: boolean
}

export interface UpdateKnowledgeArticlePayload {
  title?: string
  category?: string
  content?: string
  is_published?: boolean
}

export async function listKnowledgeArticles(token: string): Promise<KnowledgeArticle[]> {
  return apiRequest<KnowledgeArticle[]>('/knowledge-articles', { token })
}

export async function getKnowledgeArticle(token: string, articleId: string): Promise<KnowledgeArticle> {
  return apiRequest<KnowledgeArticle>(`/knowledge-articles/${articleId}`, { token })
}

export async function createKnowledgeArticle(
  token: string,
  payload: CreateKnowledgeArticlePayload,
): Promise<KnowledgeArticle> {
  return apiRequest<KnowledgeArticle>('/knowledge-articles', { method: 'POST', body: payload, token })
}

export async function updateKnowledgeArticle(
  token: string,
  articleId: string,
  payload: UpdateKnowledgeArticlePayload,
): Promise<KnowledgeArticle> {
  return apiRequest<KnowledgeArticle>(`/knowledge-articles/${articleId}`, { method: 'PATCH', body: payload, token })
}

export async function deleteKnowledgeArticle(token: string, articleId: string): Promise<void> {
  return apiRequest<void>(`/knowledge-articles/${articleId}`, { method: 'DELETE', token })
}
