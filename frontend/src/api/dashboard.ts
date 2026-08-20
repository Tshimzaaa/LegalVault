import { apiRequest } from './client'

export interface DashboardSummary {
  activeCases: {
    count: number
    totalValue: string
    progressPercent: number
  }
  contractStatus: {
    total: number
    breakdown: { label: string; count: number; color: string }[]
  }
  keyDeadlines: { title: string; deadline: string; flagColor: string }[]
  tasks: { title: string; deadline: string }[]
  recentDocuments: { title: string; subtitle: string }[]
  recentCommunications: { text: string }[]
}

export async function getDashboardSummary(token: string): Promise<DashboardSummary> {
  return apiRequest<DashboardSummary>('/dashboard/summary', { token })
}
