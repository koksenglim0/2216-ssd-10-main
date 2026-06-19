import { useCallback } from 'react'
import { Link } from 'react-router-dom'
import { walletApi } from '../api/sitwallet'
import { useAuth } from '../auth/useAuth'
import PageCard from '../components/PageCard'
import StatusMessage from '../components/StatusMessage'
import { useAsyncData } from '../hooks/useAsyncData'
import { formatCurrency, formatDate, formatDecimal, transactionAmount, transactionLabel } from '../utils/formatters'

function StatCard({ label, value, delta }) {
  return (
    <div className="rounded-[1.35rem] border border-[#18395f] bg-[#0b2f5b] px-6 py-5 text-white shadow-[0_18px_45px_rgba(11,47,91,0.24)]">
      <p className="text-[10px] font-semibold uppercase tracking-[0.26em] text-sky-200/80">{label}</p>
      <div className="mt-3 flex flex-wrap items-end gap-3">
        <p className="font-display text-4xl font-semibold leading-none text-white">{value}</p>
        <span className="rounded-full bg-white/10 px-3 py-1 text-xs font-medium text-sky-100/90 ring-1 ring-white/10">{delta}</span>
      </div>

      <div className="mt-7 flex flex-wrap gap-3">
        <Link to="/send-money" className="inline-flex min-w-[180px] items-center justify-center rounded-xl bg-white px-5 py-3 font-semibold text-[#0b2f5b] shadow-sm transition hover:bg-slate-50">
          Quick Send
        </Link>
        <Link to="/exchange" className="inline-flex min-w-[180px] items-center justify-center rounded-xl border border-white/25 bg-transparent px-5 py-3 font-semibold text-white transition hover:bg-white/10">
          Exchange
        </Link>
      </div>
    </div>
  )
}

function QuickAction({ label, to }) {
  return (
    <Link to={to} className="flex min-h-[72px] flex-col items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-3 py-3 text-sm font-semibold text-slate-700 shadow-sm shadow-slate-900/5 transition hover:border-[#0b2f5b]/20 hover:text-[#0b2f5b]">
      <span>{label}</span>
    </Link>
  )
}

function WalletCard({ wallet, index }) {
  const progress = `${Math.min(100, 35 + (index * 18))}%`

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm shadow-slate-900/5">
      <div className="flex items-start gap-3">
        <div className="grid h-10 w-10 place-items-center rounded-lg bg-slate-100 font-semibold text-[#0b2f5b]">{wallet.currency_code.slice(0, 1)}</div>
        <div className="min-w-0">
          <p className="font-semibold text-slate-900">{wallet.currency_name}</p>
          <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-500">{wallet.currency_code}</p>
        </div>
      </div>

      <div className="mt-4">
        <p className="text-sm text-slate-500">Available Balance</p>
        <p className="mt-1 font-display text-2xl font-semibold text-slate-950">{formatCurrency(wallet.balance, wallet.currency_code)}</p>
      </div>

      <div className="mt-4 h-1.5 rounded-full bg-slate-100">
        <div className="h-1.5 rounded-full bg-[#0b2f5b]" style={{ width: progress }} />
      </div>
    </div>
  )
}

function TxRow({ transaction, viewerUserId }) {
  const typeLabels = {
    TOP_UP: 'TOP',
    EXCHANGE: 'FX',
    TRANSFER: 'SEND',
  }

  return (
    <div className="flex min-w-0 items-start gap-4 border-b border-slate-100 px-5 py-4 last:border-0">
      <div
        className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-slate-100 px-1 text-center text-[10px] font-bold leading-none text-[#0b2f5b]"
        title={transaction.transaction_type}
      >
        {typeLabels[transaction.transaction_type] || 'TX'}
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate font-semibold text-slate-900">{transactionLabel(transaction, viewerUserId)}</p>
        <p className="text-sm text-slate-500">{formatDate(transaction.created_at)}</p>
      </div>
      <div className="min-w-0 max-w-[45%] text-right">
        <p className="truncate font-semibold text-slate-900">{transactionAmount(transaction, viewerUserId)}</p>
        <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-slate-400">{transaction.status}</p>
      </div>
    </div>
  )
}

export default function Dashboard() {
  const { user } = useAuth()
  const loadDashboard = useCallback(() => walletApi.dashboard(), [])
  const { data, error, loading } = useAsyncData(loadDashboard)
  const wallets = data?.wallets || []
  const transactions = data?.recentTransactions || []
  const primaryCurrency = data?.summary?.primary_currency || wallets[0]?.currency_code || 'SGD'
  const totalBalance = formatCurrency(data?.summary?.total_estimated_balance || 0, primaryCurrency)
  const rates = (data?.exchangeRates || []).slice(0, 4)

  if (loading) return <PageCard title="Dashboard">Loading wallet data...</PageCard>

  return (
    <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_250px]">
      <div className="grid gap-5">
        <StatusMessage type="error">{error}</StatusMessage>

        <div className="grid gap-5 xl:grid-cols-[minmax(0,1.6fr)_minmax(250px,0.72fr)]">
          <StatCard label="Total Estimated Balance" value={totalBalance} delta={`${wallets.length} active wallet${wallets.length === 1 ? '' : 's'}`} />

          <PageCard title="Quick Actions">
            <div className="grid grid-cols-2 gap-3">
              <QuickAction label="Send" to="/send-money" />
              <QuickAction label="Add" to="/add-funds" />
              <QuickAction label="Exchange" to="/exchange" />
              <QuickAction label="History" to="/history" />
            </div>
          </PageCard>
        </div>

        <div className="flex items-center justify-between gap-4 px-1">
          <h3 className="font-display text-xl font-semibold text-slate-900">Your Wallets</h3>
          <Link to="/add-funds" className="text-sm font-semibold text-[#0b2f5b] hover:underline">Add funds</Link>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          {wallets.length ? wallets.map((wallet, index) => (
            <WalletCard key={wallet.wallet_id || wallet.currency_code} wallet={wallet} index={index} />
          )) : (
            <PageCard className="md:col-span-3">No active wallets yet.</PageCard>
          )}
        </div>

        <div className="grid gap-5 xl:grid-cols-[minmax(0,1.35fr)_minmax(280px,0.65fr)]">
          <PageCard title="Recent Transactions" className="overflow-hidden">
            <div className="-mx-5 -mb-5">
              {transactions.length ? transactions.map((transaction) => (
                <TxRow key={transaction.reference} transaction={transaction} viewerUserId={user?.userId} />
              )) : (
                <div className="px-5 py-8 text-sm text-slate-500">No transactions yet.</div>
              )}
              <Link to="/history" className="block border-t border-slate-100 px-5 py-3 text-center text-sm font-semibold text-[#0b2f5b]">View All History</Link>
            </div>
          </PageCard>

          <div className="grid gap-5">
            <PageCard title="Exchange Rates" eyebrow="Rates">
              <div className="grid gap-4">
                {rates.map((rate) => (
                  <div key={`${rate.from_currency}-${rate.to_currency}`} className="flex items-center justify-between border-b border-slate-100 pb-3 last:border-0 last:pb-0">
                    <div>
                      <p className="font-semibold text-slate-900">1 {rate.from_currency} / {rate.to_currency}</p>
                      <p className="text-sm text-slate-500">{rate.from_currency} to {rate.to_currency}</p>
                    </div>
                    <div className="text-right">
                      <p className="font-semibold text-slate-900">{formatDecimal(rate.rate, 6)}</p>
                      <p className="text-sm font-medium text-sky-700">{formatDecimal(rate.change_24h_pct, 4)}%</p>
                    </div>
                  </div>
                ))}

                <Link to="/exchange" className="rounded-xl border border-slate-300 bg-slate-50 px-4 py-3 text-center font-semibold text-slate-800 transition hover:bg-slate-100">
                  Currency Converter
                </Link>
              </div>
            </PageCard>

            <PageCard title="Secure Mode">
              <div className="rounded-2xl border border-sky-200 bg-sky-50 px-4 py-4 text-sky-900">
                <p className="font-semibold">Your session uses MFA, CSRF protection, refresh-token rotation, and audit logging.</p>
              </div>
            </PageCard>
          </div>
        </div>
      </div>
    </div>
  )
}
