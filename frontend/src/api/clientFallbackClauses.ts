import { apiRequest } from './client'
import type { FallbackClause } from './fallbackClauses'

export type { FallbackClause }

export async function listClientFallbackClauses(token: string): Promise<FallbackClause[]> {
  return apiRequest<FallbackClause[]>('/client-fallback-clauses', { token })
}
