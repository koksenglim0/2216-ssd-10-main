import { useCallback, useEffect, useMemo, useState } from 'react'
import { adminApi } from '../api/sitwallet'
import { useAuth } from '../auth/useAuth'
import PageCard from '../components/PageCard'
import StatusMessage from '../components/StatusMessage'
import { formatDate } from '../utils/formatters'

const defaultAuditFilters = {
  page: 1,
  limit: 50,
  actor: '',
  action: '',
  actionPrefix: '',
  status: '',
  resourceType: '',
  ipAddress: '',
  dateFrom: '',
  dateTo: '',
  sortBy: 'created_at',
  sortDir: 'desc',
}

const logTypes = [
  { value: '', label: 'All types' },
  { value: 'auth', label: 'Authentication' },
  { value: 'security', label: 'Security' },
  { value: 'admin', label: 'Admin changes' },
  { value: 'money', label: 'Money movement' },
  { value: 'wallet', label: 'Wallets' },
  { value: 'recipient', label: 'Recipients' },
]

function TextField({ label, name, value, onChange, placeholder, type = 'text' }) {
  return (
    <label className="grid min-w-0 gap-1 text-sm text-slate-600">
      {label}
      <input
        name={name}
        type={type}
        value={value}
        onChange={onChange}
        className="min-w-0 rounded-xl border border-slate-200 px-3 py-2"
        placeholder={placeholder}
      />
    </label>
  )
}

function SelectField({ label, name, value, onChange, children }) {
  return (
    <label className="grid min-w-0 gap-1 text-sm text-slate-600">
      {label}
      <select
        name={name}
        value={value}
        onChange={onChange}
        className="min-w-0 rounded-xl border border-slate-200 px-3 py-2"
      >
        {children}
      </select>
    </label>
  )
}

function toApiFilters(filters) {
  return Object.fromEntries(
    Object.entries({
      ...filters,
      dateFrom: filters.dateFrom ? new Date(filters.dateFrom).toISOString() : '',
      dateTo: filters.dateTo ? new Date(filters.dateTo).toISOString() : '',
    }).filter(([, value]) => value !== ''),
  )
}

function logType(action = '') {
  return action.split('.')[0] || 'system'
}

function isSuspicious(row) {
  return row.status === 'FAILURE' || ['auth', 'security'].includes(logType(row.action))
}

function metadataPreview(metadata) {
  if (!metadata) return '-'
  if (typeof metadata === 'string') {
    try {
      const parsed = JSON.parse(metadata)
      return metadataPreview(parsed)
    } catch {
      return metadata.length > 140 ? `${metadata.slice(0, 140)}...` : metadata
    }
  }
  const text = JSON.stringify(metadata)
  return text.length > 140 ? `${text.slice(0, 140)}...` : text
}

export default function Admin() {
  const { user } = useAuth()
  const [users, setUsers] = useState([])
  const [settings, setSettings] = useState([])
  const [auditLogs, setAuditLogs] = useState([])
  const [auditMeta, setAuditMeta] = useState({ total: 0, page: 1, limit: 50 })
  const [auditFilters, setAuditFilters] = useState(defaultAuditFilters)
  const [draftFilters, setDraftFilters] = useState(defaultAuditFilters)
  const [settingDrafts, setSettingDrafts] = useState({})
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(true)
  const [auditLoading, setAuditLoading] = useState(true)

  const activitySummary = useMemo(() => {
    const failures = auditLogs.filter((row) => row.status === 'FAILURE').length
    const authEvents = auditLogs.filter((row) => logType(row.action) === 'auth').length
    const securityEvents = auditLogs.filter((row) => logType(row.action) === 'security').length
    const uniqueOrigins = new Set(auditLogs.map((row) => row.ip_address).filter(Boolean)).size
    return { failures, authEvents, securityEvents, uniqueOrigins }
  }, [auditLogs])

  const loadAuditLogs = useCallback(async () => {
    setAuditLoading(true)
    setError('')

    try {
      const result = await adminApi.auditLogs(toApiFilters(auditFilters))
      setAuditLogs(result.data || [])
      setAuditMeta({
        total: result.total || 0,
        page: result.page || auditFilters.page,
        limit: result.limit || auditFilters.limit,
      })
    } catch (err) {
      setError(err.message || 'Unable to load audit logs')
    } finally {
      setAuditLoading(false)
    }
  }, [auditFilters])

  const loadAdminData = useCallback(async () => {
    setLoading(true)
    setError('')

    try {
      const userResult = await adminApi.users()
      setUsers(userResult.users || [])

      if (user?.role === 'admin') {
        const settingResult = await adminApi.settings()
        setSettings(settingResult.settings || [])
        setSettingDrafts(Object.fromEntries((settingResult.settings || []).map((setting) => [setting.setting_key, setting.setting_value])))
      }
    } catch (err) {
      setError(err.message || 'Unable to load admin data')
    } finally {
      setLoading(false)
    }
  }, [user])

  useEffect(() => {
    void Promise.resolve().then(loadAdminData)
  }, [loadAdminData])

  useEffect(() => {
    void Promise.resolve().then(loadAuditLogs)
  }, [loadAuditLogs])

  async function updateStatus(targetUserId, status, roleName) {
    setError('')
    setMessage('')

    try {
      await adminApi.updateUserStatus(targetUserId, { status, roleName })
      setMessage('User updated.')
      await loadAdminData()
      await loadAuditLogs()
    } catch (err) {
      setError(err.message || 'Unable to update user')
    }
  }

  async function updateSetting(settingKey) {
    setError('')
    setMessage('')

    try {
      await adminApi.updateSetting(settingKey, settingDrafts[settingKey])
      setMessage(`${settingKey} updated.`)
      await loadAdminData()
      await loadAuditLogs()
    } catch (err) {
      setError(err.message || 'Unable to update setting')
    }
  }

  function updateDraftFilter(event) {
    const { name, value } = event.target
    setDraftFilters((current) => ({ ...current, [name]: value, page: 1 }))
  }

  function applyFilters(event) {
    event.preventDefault()
    setAuditFilters(draftFilters)
  }

  function resetFilters() {
    setDraftFilters(defaultAuditFilters)
    setAuditFilters(defaultAuditFilters)
  }

  function changeAuditPage(direction) {
    setAuditFilters((current) => ({
      ...current,
      page: Math.max(1, current.page + direction),
    }))
    setDraftFilters((current) => ({
      ...current,
      page: Math.max(1, current.page + direction),
    }))
  }

  const lastPage = Math.max(1, Math.ceil(auditMeta.total / auditMeta.limit))

  return (
    <div className="grid min-w-0 gap-5">
      <StatusMessage type="error">{error}</StatusMessage>
      <StatusMessage type="success">{message}</StatusMessage>

      <div className="grid min-w-0 gap-3 md:grid-cols-2 xl:grid-cols-4">
        <PageCard title="Failures" eyebrow="Visible logs">
          <p className="font-display text-3xl text-slate-950">{activitySummary.failures}</p>
        </PageCard>
        <PageCard title="Auth Events" eyebrow="Visible logs">
          <p className="font-display text-3xl text-slate-950">{activitySummary.authEvents}</p>
        </PageCard>
        <PageCard title="Security Events" eyebrow="Visible logs">
          <p className="font-display text-3xl text-slate-950">{activitySummary.securityEvents}</p>
        </PageCard>
        <PageCard title="Origins" eyebrow="Visible IPs">
          <p className="font-display text-3xl text-slate-950">{activitySummary.uniqueOrigins}</p>
        </PageCard>
      </div>

      <PageCard
        title="Admin User Management"
        eyebrow={loading ? 'Loading platform data' : `${users.length} users visible`}
        action={<button onClick={() => { void loadAdminData(); void loadAuditLogs() }} className="rounded-full border border-[#ddd3bc] px-4 py-2 text-sm text-slate-700 transition hover:bg-slate-50">Refresh</button>}
      >
        <div className="max-w-full overflow-x-auto">
          <table className="w-full min-w-[820px] table-fixed border-collapse text-left">
            <thead>
              <tr className="border-b border-[#ddd3bc] text-xs uppercase tracking-[0.18em] text-slate-500">
                <th className="w-[25%] py-3 pr-4">User</th>
                <th className="w-[12%] py-3 pr-4">Role</th>
                <th className="w-[16%] py-3 pr-4">Account Status</th>
                <th className="w-[12%] py-3 pr-4">MFA</th>
                <th className="w-[18%] py-3 pr-4">Last Login</th>
                {user?.role === 'admin' ? <th className="w-[17%] py-3 pr-4">Actions</th> : null}
              </tr>
            </thead>
            <tbody>
              {users.map((row) => (
                <tr key={row.user_id} className="border-b border-[#ece4d0] last:border-0">
                  <td className="py-4 pr-4 align-top">
                    <p className="truncate font-semibold text-slate-950">{row.full_name}</p>
                    <p className="truncate text-sm text-slate-500">{row.email}</p>
                  </td>
                  <td className="py-4 pr-4 align-top text-slate-700">{row.role_name}</td>
                  <td className="py-4 pr-4 align-top text-slate-700">{row.status}</td>
                  <td className="py-4 pr-4 align-top text-slate-700">{row.mfa_enabled ? 'Enabled' : 'Pending'}</td>
                  <td className="py-4 pr-4 align-top text-slate-700">{formatDate(row.last_login_at)}</td>
                  {user?.role === 'admin' ? (
                    <td className="py-4 pr-4 align-top">
                      <div className="flex min-w-0 flex-wrap gap-2">
                        <button onClick={() => updateStatus(row.user_id, 'active', row.role_name)} className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm hover:bg-slate-50">Activate</button>
                        <button onClick={() => updateStatus(row.user_id, 'suspended', row.role_name)} className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm hover:bg-slate-50">Suspend</button>
                      </div>
                    </td>
                  ) : null}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </PageCard>

      {user?.role === 'admin' ? (
        <PageCard title="Platform Settings" eyebrow="Admin only">
          <div className="grid min-w-0 gap-3 md:grid-cols-2">
            {settings.map((setting) => (
              <div key={setting.setting_key} className="min-w-0 rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <p className="truncate text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">{setting.setting_key}</p>
                <p className="mt-1 text-sm text-slate-500">{setting.description}</p>
                <div className="mt-3 flex gap-2">
                  <input
                    className="min-w-0 flex-1 rounded-xl border border-slate-200 px-3 py-2 text-sm"
                    value={settingDrafts[setting.setting_key] || ''}
                    onChange={(event) => setSettingDrafts((current) => ({ ...current, [setting.setting_key]: event.target.value }))}
                  />
                  <button onClick={() => updateSetting(setting.setting_key)} className="rounded-xl bg-[#0b2f5b] px-4 py-2 text-sm font-semibold text-white">Save</button>
                </div>
              </div>
            ))}
          </div>
        </PageCard>
      ) : null}

      <PageCard title="Audit Center" eyebrow={`${auditMeta.total} matching events`}>
        <form className="mb-5 grid min-w-0 gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-4" onSubmit={applyFilters}>
          <div className="grid min-w-0 gap-3 md:grid-cols-2 xl:grid-cols-4">
            <TextField label="User / Email / ID" name="actor" value={draftFilters.actor} onChange={updateDraftFilter} placeholder="admin@example.com" />
            <TextField label="Origin IP" name="ipAddress" value={draftFilters.ipAddress} onChange={updateDraftFilter} placeholder="127.0.0.1" />
            <SelectField label="Log Type" name="actionPrefix" value={draftFilters.actionPrefix} onChange={updateDraftFilter}>
              {logTypes.map((type) => <option key={type.value} value={type.value}>{type.label}</option>)}
            </SelectField>
            <SelectField label="Status" name="status" value={draftFilters.status} onChange={updateDraftFilter}>
              <option value="">All statuses</option>
              <option value="SUCCESS">Success</option>
              <option value="FAILURE">Failure</option>
            </SelectField>
          </div>

          <div className="grid min-w-0 gap-3 md:grid-cols-2 xl:grid-cols-4">
            <TextField label="Action Contains" name="action" value={draftFilters.action} onChange={updateDraftFilter} placeholder="login" />
            <TextField label="Resource Type" name="resourceType" value={draftFilters.resourceType} onChange={updateDraftFilter} placeholder="http_request" />
            <TextField label="From" name="dateFrom" type="datetime-local" value={draftFilters.dateFrom} onChange={updateDraftFilter} />
            <TextField label="To" name="dateTo" type="datetime-local" value={draftFilters.dateTo} onChange={updateDraftFilter} />
          </div>

          <div className="grid min-w-0 gap-3 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto_auto]">
            <SelectField label="Sort By" name="sortBy" value={draftFilters.sortBy} onChange={updateDraftFilter}>
              <option value="created_at">Time</option>
              <option value="user_id">User</option>
              <option value="action">Type / Action</option>
              <option value="status">Status</option>
              <option value="ip_address">Origin IP</option>
              <option value="resource_type">Resource</option>
            </SelectField>
            <SelectField label="Direction" name="sortDir" value={draftFilters.sortDir} onChange={updateDraftFilter}>
              <option value="desc">Newest / Desc</option>
              <option value="asc">Oldest / Asc</option>
            </SelectField>
            <button className="self-end rounded-xl bg-[#0b2f5b] px-5 py-2.5 text-sm font-semibold text-white">Apply</button>
            <button type="button" onClick={resetFilters} className="self-end rounded-xl border border-slate-200 bg-white px-5 py-2.5 text-sm font-semibold text-slate-700">Reset</button>
          </div>
        </form>

        {auditLoading ? <p className="py-4 text-sm text-slate-500">Loading audit events...</p> : null}

        <div className="max-w-full overflow-x-auto">
          <table className="w-full min-w-[980px] table-fixed border-collapse text-left">
            <thead>
              <tr className="border-b border-[#ddd3bc] text-xs uppercase tracking-[0.18em] text-slate-500">
                <th className="w-[16%] py-3 pr-4">Type / Action</th>
                <th className="w-[16%] py-3 pr-4">Actor</th>
                <th className="w-[18%] py-3 pr-4">Origin</th>
                <th className="w-[20%] py-3 pr-4">Resource</th>
                <th className="w-[10%] py-3 pr-4">Result</th>
                <th className="w-[10%] py-3 pr-4">Time</th>
                <th className="w-[10%] py-3 pr-4">Details</th>
              </tr>
            </thead>
            <tbody>
              {auditLogs.map((row) => (
                <tr key={row.log_id} className={['border-b border-[#ece4d0] last:border-0', isSuspicious(row) ? 'bg-rose-50/45' : ''].join(' ')}>
                  <td className="py-4 pr-4 align-top">
                    <p className="truncate font-semibold text-slate-950">{logType(row.action)}</p>
                    <p className="truncate text-sm text-slate-500" title={row.action}>{row.action}</p>
                  </td>
                  <td className="py-4 pr-4 align-top">
                    <p className="truncate font-semibold text-slate-900">{row.actor_name || 'Unknown'}</p>
                    <p className="truncate text-sm text-slate-500" title={row.actor_email || row.user_id || ''}>{row.actor_email || row.user_id || '-'}</p>
                  </td>
                  <td className="py-4 pr-4 align-top">
                    <p className="truncate text-slate-700">{row.ip_address || '-'}</p>
                    <p className="truncate text-xs text-slate-400" title={row.user_agent || ''}>{row.user_agent || '-'}</p>
                  </td>
                  <td className="break-words py-4 pr-4 align-top text-slate-700">{row.resource_type || '-'} / {row.resource_id || '-'}</td>
                  <td className="py-4 pr-4 align-top">
                    <span className={[
                      'rounded-full px-3 py-1 text-xs font-semibold',
                      row.status === 'FAILURE' ? 'bg-rose-100 text-rose-800' : 'bg-emerald-100 text-emerald-800',
                    ].join(' ')}>
                      {row.status}
                    </span>
                  </td>
                  <td className="break-words py-4 pr-4 align-top text-slate-700">{formatDate(row.created_at)}</td>
                  <td className="break-words py-4 pr-4 align-top text-sm text-slate-600">{metadataPreview(row.metadata)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {!auditLoading && !auditLogs.length ? <p className="py-8 text-center text-sm text-slate-500">No audit events match the current filters.</p> : null}

        <div className="mt-4 flex items-center justify-between gap-3 text-sm text-slate-600">
          <span>Page {auditMeta.page} of {lastPage}</span>
          <div className="flex gap-2">
            <button type="button" disabled={auditMeta.page <= 1} onClick={() => changeAuditPage(-1)} className="rounded-xl border border-slate-200 px-4 py-2 disabled:cursor-not-allowed disabled:opacity-50">Previous</button>
            <button type="button" disabled={auditMeta.page >= lastPage} onClick={() => changeAuditPage(1)} className="rounded-xl border border-slate-200 px-4 py-2 disabled:cursor-not-allowed disabled:opacity-50">Next</button>
          </div>
        </div>
      </PageCard>
    </div>
  )
}
