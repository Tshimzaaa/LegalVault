import { apiRequest } from './client'

export interface SearchResultItem {
  id: string
  title: string
  subtitle: string | null
}

export interface SearchResponse {
  contracts: SearchResultItem[]
  staff: SearchResultItem[]
  documents: SearchResultItem[]
}

export async function search(token: string, query: string): Promise<SearchResponse> {
  return apiRequest<SearchResponse>(`/search?q=${encodeURIComponent(query)}`, { token })
}
