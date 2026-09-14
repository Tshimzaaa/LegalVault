import { apiRequest } from './client'

export interface FallbackClause {
  id: string
  org_id: string
  name: string
  category: string
  description: string
  content: string
  pre_approved: boolean
  created_at: string
}

export interface CreateFallbackClausePayload {
  name: string
  category: string
  description: string
  content: string
  pre_approved: boolean
}

export type UpdateFallbackClausePayload = Partial<CreateFallbackClausePayload>

export async function listFallbackClauses(token: string): Promise<FallbackClause[]> {
  return apiRequest<FallbackClause[]>('/fallback-clauses', { token })
}

export async function createFallbackClause(token: string, payload: CreateFallbackClausePayload): Promise<FallbackClause> {
  return apiRequest<FallbackClause>('/fallback-clauses', { method: 'POST', body: payload, token })
}

export async function updateFallbackClause(
  token: string,
  clauseId: string,
  payload: UpdateFallbackClausePayload,
): Promise<FallbackClause> {
  return apiRequest<FallbackClause>(`/fallback-clauses/${clauseId}`, { method: 'PATCH', body: payload, token })
}

export async function deleteFallbackClause(token: string, clauseId: string): Promise<void> {
  return apiRequest<void>(`/fallback-clauses/${clauseId}`, { method: 'DELETE', token })
}
