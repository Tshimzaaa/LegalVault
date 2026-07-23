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
    rings: number[]
  }
  keyDeadlines: { title: string; deadline: string; flagColor: string }[]
  financialSummary: {
    billableHours: number
    sparkline: number[]
  }
  tasks: { title: string; deadline: string }[]
  recentDocuments: { title: string; subtitle: string }[]
  recentCommunications: { text: string }[]
}

export async function getDashboardSummary(token: string): Promise<DashboardSummary> {
  return apiRequest<DashboardSummary>('/dashboard/summary', { token })
}
