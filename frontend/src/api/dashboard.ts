const BASE_URL = 'http://127.0.0.1:8000'

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
  const res = await fetch(`${BASE_URL}/dashboard/summary`, {
    headers: { Authorization: `Bearer ${token}` },
  })

  if (!res.ok) {
    throw new Error('Failed to load dashboard data')
  }

  return res.json()
}
