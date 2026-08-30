import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import './Integrations.css'
import { IconSignedContract, IconLayers, IconFolder, IconGear, IconPlus, IconTrash } from '../../components/icons'
import { listIntegrations, updateIntegration, disableIntegration, deleteIntegration } from '../../api/integrations'
import type { Integration, IntegrationProvider } from '../../api/integrations'
import { ApiError } from '../../api/client'
import PermissionError from '../../components/PermissionError'
import type { User } from '../../api/auth'

type LoadState = 'loading' | 'error' | 'ready'

const providerMeta: Record<IntegrationProvider, { name: string; category: string; description: string; icon: React.ReactNode }> = {
  signinghub: {
    name: 'SigningHub',
    category: 'E-Signature',
    description: 'Send and track documents for electronic signature.',
    icon: <IconSignedContract />,
  },
  trackado: {
    name: 'Trackado',
    category: 'E-Signature',
    description: 'Alternative e-signature engine for select agreement types.',
    icon: <IconSignedContract />,
  },
  contract_express: {
    name: 'Contract Express',
    category: 'Document Assembly',
    description: 'Dynamic assembly engine used to generate template-based agreements.',
    icon: <IconLayers />,
  },
  cloud_storage: {
    name: 'Cloud Storage',
    category: 'Storage',
    description: 'Sync signed contracts and matter documents to your corporate cloud drive.',
    icon: <IconFolder />,
  },
}

interface CredentialRow {
  key: string
  value: string
}

interface IntegrationsProps {
  user: User
}

function Integrations({ user }: IntegrationsProps) {
  const [integrations, setIntegrations] = useState<Integration[]>([])
  const [status, setStatus] = useState<LoadState>('loading')
  const [attempt, setAttempt] = useState(0)
  const [actionError, setActionError] = useState<string | null>(null)

  const [configuringProvider, setConfiguringProvider] = useState<IntegrationProvider | null>(null)
  const [credentialRows, setCredentialRows] = useState<CredentialRow[]>([{ key: '', value: '' }])
  const [enableOnSave, setEnableOnSave] = useState(true)
  const [saving, setSaving] = useState(false)
  const [busyProvider, setBusyProvider] = useState<IntegrationProvider | null>(null)

  const token = localStorage.getItem('access_token')

  useEffect(() => {
    if (user.role !== 'admin') return
    let cancelled = false
    setStatus('loading')
    if (!token) {
      setStatus('error')
      return
    }
    listIntegrations(token)
      .then((data) => {
        if (cancelled) return
        setIntegrations(data)
        setStatus('ready')
      })
      .catch(() => {
        if (cancelled) return
        setStatus('error')
      })
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [attempt])

  if (user.role !== 'admin') {
    return (
      <main className="dash-main">
        <header className="dash-topbar">
          <h1>Integrations</h1>
        </header>
        <div className="dash-state">
          <PermissionError message="Only firm admins can view or configure integrations." />
        </div>
      </main>
    )
  }

  function replaceIntegration(updated: Integration) {
    setIntegrations((prev) => prev.map((i) => (i.provider === updated.provider ? updated : i)))
  }

  function startConfigure(provider: IntegrationProvider) {
    setConfiguringProvider(provider)
    setCredentialRows([{ key: '', value: '' }])
    setEnableOnSave(true)
    setActionError(null)
  }

  function updateRow(index: number, field: 'key' | 'value', value: string) {
    setCredentialRows((prev) => prev.map((row, i) => (i === index ? { ...row, [field]: value } : row)))
  }

  async function handleSaveCredentials(e: FormEvent) {
    e.preventDefault()
    if (!token || !configuringProvider) return
    const credentials = Object.fromEntries(
      credentialRows.filter((row) => row.key.trim()).map((row) => [row.key.trim(), row.value]),
    )
    setSaving(true)
    setActionError(null)
    try {
      const updated = await updateIntegration(token, configuringProvider, credentials, enableOnSave)
      replaceIntegration(updated)
      setConfiguringProvider(null)
    } catch (err) {
      setActionError(err instanceof ApiError && err.status === 403 ? err.message : 'Could not save credentials. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  async function handleDisable(provider: IntegrationProvider) {
    if (!token) return
    setBusyProvider(provider)
    setActionError(null)
    try {
      replaceIntegration(await disableIntegration(token, provider))
    } catch (err) {
      setActionError(err instanceof ApiError && err.status === 403 ? err.message : 'Could not disable that integration.')
    } finally {
      setBusyProvider(null)
    }
  }

  async function handleRemove(provider: IntegrationProvider) {
    if (!token) return
    if (!window.confirm(`Remove ${providerMeta[provider].name}? Its stored credentials will be deleted.`)) return
    setBusyProvider(provider)
    setActionError(null)
    try {
      replaceIntegration(await deleteIntegration(token, provider))
    } catch (err) {
      setActionError(err instanceof ApiError && err.status === 403 ? err.message : 'Could not remove that integration.')
    } finally {
      setBusyProvider(null)
    }
  }

  const configuredCount = integrations.filter((i) => i.is_configured && i.is_enabled).length

  return (
    <main className="dash-main">
      <header className="dash-topbar">
        <h1>Integrations</h1>
        <div className="topbar-actions">
          <span className="chip">
            <IconGear /> Configured <span className="chip-badge">{configuredCount}</span>
          </span>
        </div>
      </header>

      {status === 'loading' && (
        <div className="dash-state" role="status" aria-live="polite">
          <span className="dash-spinner" aria-hidden="true" />
          <p>Loading integrations…</p>
        </div>
      )}

      {status === 'error' && (
        <div className="dash-state">
          <p>Couldn&rsquo;t reach the backend for integrations.</p>
          <button type="button" className="btn-ghost" onClick={() => setAttempt((n) => n + 1)}>
            Retry
          </button>
        </div>
      )}

      {actionError && <p className="matter-error" aria-live="polite">{actionError}</p>}

      {status === 'ready' && (
        <section className="integrations-grid">
          {integrations.map((integration) => {
            const meta = providerMeta[integration.provider]
            const badgeLabel = !integration.is_configured
              ? 'Not Configured'
              : integration.is_enabled
                ? 'Configured'
                : 'Disabled'
            const badgeColor = integration.is_configured && integration.is_enabled ? '#22c55e' : '#9ca3af'

            return (
              <div key={integration.provider} className="card integration-card">
                <div className="integration-card-header">
                  <span className="template-icon">{meta.icon}</span>
                  <span className="status-badge" style={{ color: badgeColor, background: `${badgeColor}22` }}>
                    {badgeLabel}
                  </span>
                </div>
                <span className="template-name">{meta.name}</span>
                <span className="template-category">{meta.category}</span>
                <p className="template-description">{meta.description}</p>

                {configuringProvider === integration.provider ? (
                  <form className="integration-config-form" onSubmit={handleSaveCredentials}>
                    {credentialRows.map((row, index) => (
                      <div className="field-row integration-credential-row" key={index}>
                        <label className="field">
                          <span>Key</span>
                          <input
                            value={row.key}
                            onChange={(e) => updateRow(index, 'key', e.target.value)}
                            placeholder="api_key…"
                            autoComplete="off"
                            spellCheck={false}
                          />
                        </label>
                        <label className="field">
                          <span>Value</span>
                          <input
                            value={row.value}
                            onChange={(e) => updateRow(index, 'value', e.target.value)}
                            type="password"
                            placeholder="secret value…"
                            autoComplete="off"
                          />
                        </label>
                      </div>
                    ))}
                    <button
                      type="button"
                      className="btn-ghost integration-add-row"
                      onClick={() => setCredentialRows((prev) => [...prev, { key: '', value: '' }])}
                    >
                      <IconPlus /> Add Field
                    </button>
                    <label className="intake-required-checkbox">
                      <input type="checkbox" checked={enableOnSave} onChange={(e) => setEnableOnSave(e.target.checked)} />
                      <span>Enable after saving</span>
                    </label>
                    <div className="matter-actions">
                      <button type="button" className="btn-ghost" onClick={() => setConfiguringProvider(null)}>
                        Cancel
                      </button>
                      <button type="submit" className="btn-solid" disabled={saving}>
                        {saving ? 'Saving…' : 'Save'}
                      </button>
                    </div>
                  </form>
                ) : (
                  <div className="integration-actions">
                    <button
                      type="button"
                      className="btn-ghost template-use-btn"
                      onClick={() => startConfigure(integration.provider)}
                    >
                      Configure
                    </button>
                    {integration.is_configured && integration.is_enabled && (
                      <button
                        type="button"
                        className="btn-ghost template-use-btn"
                        disabled={busyProvider === integration.provider}
                        onClick={() => handleDisable(integration.provider)}
                      >
                        Disable
                      </button>
                    )}
                    {integration.is_configured && (
                      <button
                        type="button"
                        className="icon-btn"
                        disabled={busyProvider === integration.provider}
                        onClick={() => handleRemove(integration.provider)}
                        aria-label={`Remove ${meta.name}`}
                      >
                        <IconTrash />
                      </button>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </section>
      )}
    </main>
  )
}

export default Integrations
