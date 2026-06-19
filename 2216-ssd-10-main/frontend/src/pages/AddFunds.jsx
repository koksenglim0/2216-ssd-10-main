import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { topUpApi, walletApi } from '../api/sitwallet'
import PageCard from '../components/PageCard'
import StatusMessage from '../components/StatusMessage'
import { defaultCurrencies } from '../data/sitwalletData'
import { formatCurrency } from '../utils/formatters'

export default function AddFunds() {
  const navigate = useNavigate()
  const [wallets, setWallets] = useState([])
  const [form, setForm] = useState({ currency: 'SGD', amount: '100', description: '' })
  const [quote, setQuote] = useState(null)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)

  const currencies = useMemo(() => {
    const walletCurrencies = wallets.map((wallet) => wallet.currency_code)
    return [...new Set([...walletCurrencies, ...defaultCurrencies])]
  }, [wallets])

  useEffect(() => {
    let active = true

    async function loadWallets() {
      try {
        const result = await walletApi.list()
        if (active) setWallets(result.wallets || [])
      } catch (err) {
        if (active) setError(err.message || 'Unable to load wallets')
      } finally {
        if (active) setLoading(false)
      }
    }

    void Promise.resolve().then(loadWallets)
    return () => {
      active = false
    }
  }, [])

  useEffect(() => {
    let active = true

    async function loadQuote() {
      if (!form.amount || Number(form.amount) <= 0) {
        setQuote(null)
        return
      }

      try {
        const result = await topUpApi.quote({ currency: form.currency, amount: form.amount })
        if (active) setQuote(result.quote)
      } catch (err) {
        if (active) setError(err.message || 'Unable to quote top-up')
      }
    }

    void Promise.resolve().then(loadQuote)
    return () => {
      active = false
    }
  }, [form.amount, form.currency])

  function updateField(event) {
    setForm((current) => ({ ...current, [event.target.name]: event.target.value }))
  }

  async function submitTopUp(event) {
    event.preventDefault()
    setError('')
    setMessage('')
    setSubmitting(true)

    try {
      const result = await topUpApi.confirm(form)
      const reference = result.transaction.reference
      setMessage(`Top-up completed. Reference ${reference}`)
      navigate(`/transfer-success?reference=${encodeURIComponent(reference)}`)
    } catch (err) {
      setError(err.message || 'Unable to add funds')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <PageCard title="Add Funds" eyebrow="Secure top-up">
      <form className="grid gap-4 lg:grid-cols-2" onSubmit={submitTopUp}>
        <StatusMessage type="error">{error}</StatusMessage>
        <StatusMessage type="success">{message}</StatusMessage>

        <label className="grid gap-2 text-sm text-slate-600">
          Currency
          <select className="rounded-2xl border border-[#ddd3bc] px-4 py-3 text-slate-950 outline-none focus:border-slate-400" name="currency" value={form.currency} onChange={updateField}>
            {currencies.map((currency) => <option key={currency} value={currency}>{currency}</option>)}
          </select>
        </label>

        <label className="grid gap-2 text-sm text-slate-600">
          Amount to Add
          <input className="rounded-2xl border border-[#ddd3bc] px-4 py-3 text-slate-950 outline-none focus:border-slate-400" name="amount" type="number" min="0.01" step="0.01" value={form.amount} onChange={updateField} required />
        </label>

        <div className="flex flex-wrap gap-2 lg:col-span-2">
          {['100', '500', '1000'].map((amount) => (
            <button key={amount} type="button" onClick={() => setForm((current) => ({ ...current, amount }))} className="rounded-full border border-[#ddd3bc] px-4 py-2 text-sm text-slate-700 transition hover:bg-slate-50">
              +{amount}
            </button>
          ))}
        </div>

        <label className="grid gap-2 text-sm text-slate-600 lg:col-span-2">
          Description
          <input className="rounded-2xl border border-[#ddd3bc] px-4 py-3 text-slate-950 outline-none focus:border-slate-400" name="description" value={form.description} onChange={updateField} maxLength={500} placeholder="Optional note" />
        </label>

        <div className="grid gap-3 rounded-3xl bg-slate-50 p-5 lg:col-span-2 xl:grid-cols-3">
          <div>
            <p className="text-xs uppercase tracking-[0.18em] text-slate-500">Credited Amount</p>
            <p className="mt-2 font-semibold text-slate-950">{quote ? formatCurrency(quote.creditedAmount, quote.currency) : loading ? 'Loading...' : '-'}</p>
            <p className="text-sm text-slate-500">After top-up fee</p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-[0.18em] text-slate-500">Fee</p>
            <p className="mt-2 font-semibold text-slate-950">{quote ? formatCurrency(quote.feeAmount, quote.currency) : '-'}</p>
            <p className="text-sm text-slate-500">{quote ? `${quote.feePercent}% platform fee` : 'Quoted by backend'}</p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-[0.18em] text-slate-500">Daily Limit</p>
            <p className="mt-2 font-semibold text-slate-950">{quote ? formatCurrency(quote.dailyLimit, quote.currency) : '-'}</p>
            <p className="text-sm text-slate-500">Enforced by stored procedure</p>
          </div>
        </div>

        <div className="flex items-center gap-3 lg:col-span-2">
          <button disabled={submitting} className="inline-flex rounded-2xl bg-slate-950 px-5 py-3 font-medium text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60">
            {submitting ? 'Processing...' : 'Confirm Top-up'}
          </button>
        </div>
      </form>
    </PageCard>
  )
}
