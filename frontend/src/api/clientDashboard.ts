import { apiRequest } from './client'

export interface ContractBreakdown {
  total: number
  signed: number
  pending: number
  expired: number
}

export interface RecentAction {
  text: string
  occurred_at: string
}

export interface ClientDashboardSummary {
  openMatters: number
  contractBreakdown: ContractBreakdown
  recentActions: RecentAction[]
}

export async function getClientDashboardSummary(token: string): Promise<ClientDashboardSummary> {
  return apiRequest<ClientDashboardSummary>('/client-dashboard/summary', { token })
}
