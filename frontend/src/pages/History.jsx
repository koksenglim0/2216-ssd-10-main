import { useEffect, useState } from 'react'
import PageCard from '../components/PageCard'
import StatusMessage from '../components/StatusMessage'
import { historyApi } from '../api/sitwallet'
import { useAuth } from '../auth/useAuth'
import { defaultCurrencies } from '../data/sitwalletData'
import { formatDate, transactionAmount, transactionLabel } from '../utils/formatters'

function toCsv(rows, viewerUserId) {
  const headers = ['Reference', 'Type', 'Status', 'Date', 'Description', 'Amount']
  const body = rows.map((row) => [
    row.reference,
    row.transaction_type,
    row.status,
    formatDate(row.created_at),
    transactionLabel(row, viewerUserId),
    transactionAmount(row, viewerUserId),
  ])
  return [headers, ...body]
    .map((line) => line.map((value) => `"${String(value || '').replaceAll('"', '""')}"`).join(','))
    .join('\n')
}

export default function History() {
  const { user } = useAuth()
  const [filters, setFilters] = useState({ page: 1, limit: 25, type: '', currency: '' })
  const [data, setData] = useState({ data: [], total: 0, page: 1, limit: 25 })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let active = true

    async function load() {
      setLoading(true)
      setError('')

      try {
        const result = await historyApi.list(filters)
        if (active) setData(result)
      } catch (err) {
        if (active) setError(err.message || 'Unable to load history')
      } finally {
        if (active) setLoading(false)
      }
    }

    void Promise.resolve().then(load)
    return () => {
      active = false
    }
  }, [filters])

  function updateFilter(event) {
    setFilters((current) => ({ ...current, [event.target.name]: event.target.value, page: 1 }))
  }

  function exportCsv() {
    const blob = new Blob([toCsv(data.data || [], user?.userId)], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = 'sitwallet-history.csv'
    link.click()
    URL.revokeObjectURL(url)
  }

  return (
    <PageCard
      title="Transaction History"
      eyebrow="View and manage all your financial activities"
      action={
        <div className="flex flex-wrap gap-2">
          <button onClick={exportCsv} className="rounded-full border border-[#ddd3bc] px-4 py-2 text-sm text-slate-700 transition hover:bg-slate-50">Export CSV</button>
          <button onClick={() => window.print()} className="rounded-full border border-[#ddd3bc] px-4 py-2 text-sm text-slate-700 transition hover:bg-slate-50">Print Report</button>
        </div>
      }
    >
      <div className="mb-4 grid gap-3 md:grid-cols-3">
        <label className="grid gap-2 text-sm text-slate-600">
          Type
          <select name="type" value={filters.type} onChange={updateFilter} className="rounded-xl border border-slate-200 px-3 py-2">
            <option value="">All</option>
            <option value="TOP_UP">Top-up</option>
            <option value="TRANSFER">Transfer</option>
            <option value="EXCHANGE">Exchange</option>
          </select>
        </label>
        <label className="grid gap-2 text-sm text-slate-600">
          Currency
          <select name="currency" value={filters.currency} onChange={updateFilter} className="rounded-xl border border-slate-200 px-3 py-2">
            <option value="">All</option>
            {defaultCurrencies.map((currency) => <option key={currency} value={currency}>{currency}</option>)}
          </select>
        </label>
      </div>

      <StatusMessage type="error">{error}</StatusMessage>
      {loading ? <p className="py-6 text-sm text-slate-500">Loading transactions...</p> : null}

      <div className="overflow-x-auto">
        <table className="min-w-full border-collapse text-left">
          <thead>
            <tr className="border-b border-[#ddd3bc] text-xs uppercase tracking-[0.18em] text-slate-500">
              <th className="py-3 pr-4">Transaction</th>
              <th className="py-3 pr-4">Status</th>
              <th className="py-3 pr-4">Date & Time</th>
              <th className="py-3 pr-4">Amount</th>
            </tr>
          </thead>
          <tbody>
            {(data.data || []).map((row) => (
              <tr key={row.reference} className="border-b border-[#ece4d0] last:border-0">
                <td className="py-4 pr-4 align-top">
                  <p className="font-semibold text-slate-950">{transactionLabel(row, user?.userId)}</p>
                  <p className="text-sm text-slate-500">{row.reference} / {row.transaction_type}</p>
                </td>
                <td className="py-4 pr-4 align-top text-slate-700">{row.status}</td>
                <td className="py-4 pr-4 align-top text-slate-700">{formatDate(row.created_at)}</td>
                <td className="py-4 pr-4 align-top text-slate-950">{transactionAmount(row, user?.userId)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {!loading && !data.data?.length ? <p className="py-8 text-center text-sm text-slate-500">No transactions found.</p> : null}
    </PageCard>
  )
}
