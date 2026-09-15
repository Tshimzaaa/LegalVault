import { apiRequest, BASE_URL } from './client'

export interface StatusBreakdownItem {
  status: string
  label: string
  count: number
}

export interface StaffWorkloadItem {
  user_id: string
  name: string
  active_contracts: number
  total_contracts: number
  open_tasks: number
  overdue_tasks: number
}

export interface ReportingOverview {
  total_contracts: number
  status_breakdown: StatusBreakdownItem[]
  staff_workload: StaffWorkloadItem[]
  unassigned_active_contracts: number
  open_tasks: number
  overdue_tasks: number
  upcoming_deadlines_7_days: number
}

export async function getReportingOverview(token: string): Promise<ReportingOverview> {
  return apiRequest<ReportingOverview>('/reporting/overview', { token })
}

/** Downloads the org's contracts as a CSV file directly (not JSON, so this bypasses apiRequest). */
export async function downloadContractsCsv(token: string): Promise<void> {
  const res = await fetch(`${BASE_URL}/reporting/contracts/export`, {
    headers: { Authorization: `Bearer ${token}` },
  })
  if (!res.ok) throw new Error(`Export failed (${res.status})`)

  const blob = await res.blob()
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = 'contracts.csv'
  a.click()
  URL.revokeObjectURL(url)
}
