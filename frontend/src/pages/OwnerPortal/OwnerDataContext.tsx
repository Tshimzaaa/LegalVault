import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import {
  getInquirySummary,
  getOrganization,
  getPlatformMetrics,
  getSystemHealth,
  listOrganizations,
} from '../../api/owner'
import type { InquirySummary, OrganizationDetail, PlatformMetrics, SystemHealth } from '../../api/owner'
import type { LoadState } from './ownerUtils'

interface OwnerData {
  token: string | null
  orgs: OrganizationDetail[]
  setOrgs: React.Dispatch<React.SetStateAction<OrganizationDetail[]>>
  orgsStatus: LoadState
  reloadOrgs: () => void
  metrics: PlatformMetrics | null
  metricsStatus: LoadState
  health: SystemHealth | null
  healthStatus: LoadState
  reloadHealth: () => void
  summary: InquirySummary | null
  refreshSummary: () => void
}

const OwnerDataContext = createContext<OwnerData | null>(null)

const SUMMARY_POLL_MS = 60000

export function OwnerDataProvider({ children }: { children: ReactNode }) {
  const token = localStorage.getItem('access_token')

  const [orgs, setOrgs] = useState<OrganizationDetail[]>([])
  const [orgsStatus, setOrgsStatus] = useState<LoadState>('loading')
  const [metrics, setMetrics] = useState<PlatformMetrics | null>(null)
  const [metricsStatus, setMetricsStatus] = useState<LoadState>('loading')
  const [health, setHealth] = useState<SystemHealth | null>(null)
  const [healthStatus, setHealthStatus] = useState<LoadState>('loading')
  const [summary, setSummary] = useState<InquirySummary | null>(null)

  const reloadOrgs = useCallback(() => {
    const t = localStorage.getItem('access_token')
    if (!t) {
      setOrgsStatus('error')
      return
    }
    listOrganizations(t)
      .then((summaries) => Promise.all(summaries.map((s) => getOrganization(t, s.id))))
      .then((details) => {
        setOrgs(details)
        setOrgsStatus('ready')
      })
      .catch(() => setOrgsStatus('error'))
  }, [])

  const loadMetrics = useCallback(() => {
    const t = localStorage.getItem('access_token')
    if (!t) {
      setMetricsStatus('error')
      return
    }
    setMetricsStatus('loading')
    getPlatformMetrics(t, 24)
      .then((data) => {
        setMetrics(data)
        setMetricsStatus('ready')
      })
      .catch(() => setMetricsStatus('error'))
  }, [])

  const reloadHealth = useCallback(() => {
    const t = localStorage.getItem('access_token')
    if (!t) {
      setHealthStatus('error')
      return
    }
    setHealthStatus('loading')
    getSystemHealth(t, 24)
      .then((data) => {
        setHealth(data)
        setHealthStatus('ready')
      })
      .catch(() => setHealthStatus('error'))
    loadMetrics()
  }, [loadMetrics])

  const refreshSummary = useCallback(() => {
    const t = localStorage.getItem('access_token')
    if (!t) return
    getInquirySummary(t)
      .then(setSummary)
      .catch(() => {})
  }, [])

  useEffect(() => {
    reloadOrgs()
    reloadHealth()
  }, [reloadOrgs, reloadHealth])

  useEffect(() => {
    refreshSummary()
    const id = window.setInterval(() => {
      if (!document.hidden) refreshSummary()
    }, SUMMARY_POLL_MS)
    return () => window.clearInterval(id)
  }, [refreshSummary])

  const value = useMemo(
    () => ({
      token,
      orgs,
      setOrgs,
      orgsStatus,
      reloadOrgs,
      metrics,
      metricsStatus,
      health,
      healthStatus,
      reloadHealth,
      summary,
      refreshSummary,
    }),
    [token, orgs, orgsStatus, reloadOrgs, metrics, metricsStatus, health, healthStatus, reloadHealth, summary, refreshSummary],
  )

  return <OwnerDataContext.Provider value={value}>{children}</OwnerDataContext.Provider>
}

// eslint-disable-next-line react-refresh/only-export-components
export function useOwnerData(): OwnerData {
  const ctx = useContext(OwnerDataContext)
  if (!ctx) throw new Error('useOwnerData must be used inside OwnerDataProvider')
  return ctx
}
