import { apiRequest } from './client'
import type { KnowledgeArticle } from './knowledgeArticles'

export async function listPublishedArticles(token: string): Promise<KnowledgeArticle[]> {
  return apiRequest<KnowledgeArticle[]>('/client-knowledge-articles', { token })
}

export async function getPublishedArticle(token: string, articleId: string): Promise<KnowledgeArticle> {
  return apiRequest<KnowledgeArticle>(`/client-knowledge-articles/${articleId}`, { token })
}
