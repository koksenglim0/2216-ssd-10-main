import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { exchangeApi, marketApi, walletApi } from '../api/sitwallet'
import PageCard from '../components/PageCard'
import StatusMessage from '../components/StatusMessage'
import { defaultCurrencies } from '../data/sitwalletData'
import { formatCurrency, formatDecimal } from '../utils/formatters'

export default function Exchange() {
  const navigate = useNavigate()
  const [wallets, setWallets] = useState([])
  const [market, setMarket] = useState({ currencies: [], rates: [] })
  const [form, setForm] = useState({ fromCurrency: 'SGD', toCurrency: 'USD', amount: '100' })
  const [quote, setQuote] = useState(null)
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const currencies = useMemo(() => {
    const active = market.currencies.map((currency) => currency.currency_code)
    const walletCurrencies = wallets.map((wallet) => wallet.currency_code)
    return [...new Set([...walletCurrencies, ...active, ...defaultCurrencies])]
  }, [market.currencies, wallets])

  useEffect(() => {
    let active = true

    async function load() {
      try {
        const [walletResult, marketResult] = await Promise.all([
          walletApi.list(),
          marketApi.all(),
        ])
        if (!active) return
        setWallets(walletResult.wallets || [])
        setMarket(marketResult)
      } catch (err) {
        if (active) setError(err.message || 'Unable to load exchange data')
      }
    }

    void Promise.resolve().then(load)
    return () => {
      active = false
    }
  }, [])

  useEffect(() => {
    let active = true

    async function loadQuote() {
      if (!form.amount || Number(form.amount) <= 0 || form.fromCurrency === form.toCurrency) {
        setQuote(null)
        return
      }

      try {
        const result = await exchangeApi.quote(form)
        if (active) setQuote(result.quote)
      } catch (err) {
        if (active) {
          setQuote(null)
          setError(err.message || 'Unable to quote exchange')
        }
      }
    }

    void Promise.resolve().then(loadQuote)
    return () => {
      active = false
    }
  }, [form])

  function updateField(event) {
    setForm((current) => ({ ...current, [event.target.name]: event.target.value }))
  }

  async function submitExchange(event) {
    event.preventDefault()
    setError('')
    setSubmitting(true)

    try {
      const result = await exchangeApi.confirm(form)
      navigate(`/transfer-success?reference=${encodeURIComponent(result.transaction.reference)}`)
    } catch (err) {
      setError(err.message || 'Unable to complete exchange')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="grid gap-5 xl:grid-cols-12">
      <PageCard title="Currency Exchange" className="xl:col-span-8">
        <form className="grid gap-5" onSubmit={submitExchange}>
          <StatusMessage type="error">{error}</StatusMessage>
          <p className="text-slate-500">Swap currencies instantly using backend-quoted rates and fee settings.</p>

          <div className="grid gap-4 md:grid-cols-3">
            <label className="grid gap-2 text-sm text-slate-600">
              You Sell
              <input className="rounded-2xl border border-[#ddd3bc] px-4 py-3 text-slate-950 outline-none focus:border-slate-400" name="amount" type="number" min="0.01" step="0.01" value={form.amount} onChange={updateField} required />
            </label>
            <label className="grid gap-2 text-sm text-slate-600">
              From
              <select className="rounded-2xl border border-[#ddd3bc] px-4 py-3 text-slate-950 outline-none focus:border-slate-400" name="fromCurrency" value={form.fromCurrency} onChange={updateField}>
                {currencies.map((currency) => <option key={currency} value={currency}>{currency}</option>)}
              </select>
            </label>
            <label className="grid gap-2 text-sm text-slate-600">
              To
              <select className="rounded-2xl border border-[#ddd3bc] px-4 py-3 text-slate-950 outline-none focus:border-slate-400" name="toCurrency" value={form.toCurrency} onChange={updateField}>
                {currencies.map((currency) => <option key={currency} value={currency}>{currency}</option>)}
              </select>
            </label>
          </div>

          <div className="flex flex-wrap gap-2">
            <span className="rounded-full bg-[#f4efe0] px-4 py-2 text-sm text-slate-700">Rate: {quote ? formatDecimal(quote.exchangeRate, 6) : '-'}</span>
            <span className="rounded-full bg-[#f4efe0] px-4 py-2 text-sm text-slate-700">Fee: {quote ? formatCurrency(quote.feeAmount, quote.fromCurrency) : '-'}</span>
            <span className="rounded-full bg-[#f4efe0] px-4 py-2 text-sm text-slate-700">Receive: {quote ? formatCurrency(quote.targetAmount, quote.toCurrency) : '-'}</span>
          </div>

          <button disabled={submitting || !quote} className="inline-flex w-fit rounded-2xl bg-slate-950 px-5 py-3 font-medium text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60">
            {submitting ? 'Exchanging...' : 'Confirm Exchange'}
          </button>
        </form>
      </PageCard>

      <PageCard title="Market Trends" className="xl:col-span-4">
        <div className="grid gap-3">
          <div className="flex items-center justify-between rounded-2xl bg-slate-50 px-4 py-3">
            <span className="font-semibold text-slate-950">24h High</span>
            <span className="text-slate-700">{quote ? formatDecimal(quote.high24h, 6) : '-'}</span>
          </div>
          <div className="flex items-center justify-between rounded-2xl bg-slate-50 px-4 py-3">
            <span className="font-semibold text-slate-950">24h Low</span>
            <span className="text-slate-700">{quote ? formatDecimal(quote.low24h, 6) : '-'}</span>
          </div>
          <div className="flex items-center justify-between rounded-2xl bg-slate-50 px-4 py-3">
            <span className="font-semibold text-slate-950">24h Change</span>
            <span className="text-slate-700">{quote ? `${formatDecimal(quote.change24hPct, 4)}%` : '-'}</span>
          </div>
        </div>
      </PageCard>
    </div>
  )
}
