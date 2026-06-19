import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { transferApi, walletApi } from '../api/sitwallet'
import PageCard from '../components/PageCard'
import StatusMessage from '../components/StatusMessage'
import { defaultCurrencies } from '../data/sitwalletData'
import { formatCurrency, formatDecimal } from '../utils/formatters'

export default function SendMoney() {
  const navigate = useNavigate()
  const [wallets, setWallets] = useState([])
  const [recipients, setRecipients] = useState([])
  const [form, setForm] = useState({
    recipientId: '',
    fromCurrency: 'SGD',
    toCurrency: 'SGD',
    amount: '100',
    description: '',
  })
  const [recipientForm, setRecipientForm] = useState({ recipientEmail: '', nickname: '' })
  const [quote, setQuote] = useState(null)
  const [review, setReview] = useState(null)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const currencies = useMemo(() => {
    const walletCurrencies = wallets.map((wallet) => wallet.currency_code)
    return [...new Set([...walletCurrencies, ...defaultCurrencies])]
  }, [wallets])

  async function loadRecipients() {
    const result = await transferApi.recipients()
    setRecipients(result.recipients || [])
    if (!form.recipientId && result.recipients?.[0]) {
      setForm((current) => ({ ...current, recipientId: result.recipients[0].recipient_id }))
    }
  }

  useEffect(() => {
    let active = true

    async function load() {
      try {
        const [walletResult, recipientResult] = await Promise.all([
          walletApi.list(),
          transferApi.recipients(),
        ])
        if (!active) return
        setWallets(walletResult.wallets || [])
        setRecipients(recipientResult.recipients || [])
        if (recipientResult.recipients?.[0]) {
          setForm((current) => ({ ...current, recipientId: recipientResult.recipients[0].recipient_id }))
        }
      } catch (err) {
        if (active) setError(err.message || 'Unable to load transfer data')
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
      if (!form.amount || Number(form.amount) <= 0) {
        setQuote(null)
        return
      }

      try {
        const result = await transferApi.quote({
          fromCurrency: form.fromCurrency,
          toCurrency: form.toCurrency,
          amount: form.amount,
        })
        if (active) setQuote(result.quote)
      } catch (err) {
        if (active) {
          setQuote(null)
          setError(err.message || 'Unable to quote transfer')
        }
      }
    }

    void Promise.resolve().then(loadQuote)
    return () => {
      active = false
    }
  }, [form.amount, form.fromCurrency, form.toCurrency])

  function updateField(event) {
    setReview(null)
    setForm((current) => ({ ...current, [event.target.name]: event.target.value }))
  }

  function updateRecipientField(event) {
    setRecipientForm((current) => ({ ...current, [event.target.name]: event.target.value }))
  }

  async function addRecipient(event) {
    event.preventDefault()
    setError('')
    setMessage('')

    try {
      const result = await transferApi.addRecipient(recipientForm)
      await loadRecipients()
      setRecipientForm({ recipientEmail: '', nickname: '' })
      setForm((current) => ({ ...current, recipientId: result.recipient?.recipient_id || current.recipientId }))
      setMessage('Recipient added.')
    } catch (err) {
      setError(err.message || 'Unable to add recipient')
    }
  }

  async function reviewTransfer(event) {
    event.preventDefault()
    setError('')
    setMessage('')
    setSubmitting(true)

    try {
      const result = await transferApi.review(form)
      setReview(result)
      setMessage('Transfer reviewed. Confirm when ready.')
    } catch (err) {
      setError(err.message || 'Unable to review transfer')
    } finally {
      setSubmitting(false)
    }
  }

  async function confirmTransfer() {
    setError('')
    setSubmitting(true)

    try {
      const result = await transferApi.confirm({ ...form, confirm: true })
      navigate(`/transfer-success?reference=${encodeURIComponent(result.transaction.reference)}`)
    } catch (err) {
      setError(err.message || 'Unable to send money')
    } finally {
      setSubmitting(false)
    }
  }

  const selectedRecipient = recipients.find((recipient) => recipient.recipient_id === form.recipientId)

  return (
    <div className="grid gap-5 xl:grid-cols-12">
      <PageCard title="How much would you like to send?" eyebrow="Transfer review" className="xl:col-span-8">
        <form className="grid gap-4" onSubmit={reviewTransfer}>
          <StatusMessage type="error">{error}</StatusMessage>
          <StatusMessage type="success">{message}</StatusMessage>

          <label className="grid gap-2 text-sm text-slate-600">
            Recipient
            <select className="rounded-2xl border border-[#ddd3bc] px-4 py-3 text-slate-950 outline-none focus:border-slate-400" name="recipientId" value={form.recipientId} onChange={updateField} required>
              <option value="">Select recipient</option>
              {recipients.map((recipient) => (
                <option key={recipient.recipient_id} value={recipient.recipient_id}>
                  {recipient.nickname || recipient.full_name} ({recipient.email})
                </option>
              ))}
            </select>
          </label>

          <div className="grid gap-4 md:grid-cols-3">
            <label className="grid gap-2 text-sm text-slate-600">
              You Send
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

          <label className="grid gap-2 text-sm text-slate-600">
            Description
            <input className="rounded-2xl border border-[#ddd3bc] px-4 py-3 text-slate-950 outline-none focus:border-slate-400" name="description" value={form.description} onChange={updateField} maxLength={500} placeholder="Optional note" />
          </label>

          <div className="flex flex-wrap gap-2">
            <span className="rounded-full bg-[#f4efe0] px-4 py-2 text-sm text-slate-700">Rate: {quote ? formatDecimal(quote.exchangeRate, 6) : '-'}</span>
            <span className="rounded-full bg-[#f4efe0] px-4 py-2 text-sm text-slate-700">Fee: {quote ? formatCurrency(quote.feeAmount, quote.fromCurrency) : '-'}</span>
            <span className="rounded-full bg-[#f4efe0] px-4 py-2 text-sm text-slate-700">Recipient gets: {quote ? formatCurrency(quote.targetAmount, quote.toCurrency) : '-'}</span>
          </div>

          {review ? (
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
              <p className="font-semibold text-slate-950">Reviewed transfer</p>
              <p>Recipient: {review.recipient.nickname || review.recipient.full_name} ({review.recipient.email})</p>
              <p>Amount: {formatCurrency(review.quote.sourceAmount, review.quote.fromCurrency)} to {formatCurrency(review.quote.targetAmount, review.quote.toCurrency)}</p>
            </div>
          ) : null}

          <div className="flex flex-wrap gap-3">
            <button disabled={submitting || !form.recipientId} className="inline-flex w-fit rounded-2xl bg-slate-950 px-5 py-3 font-medium text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60">
              {submitting ? 'Reviewing...' : 'Review Transfer'}
            </button>
            <button type="button" disabled={submitting || !review} onClick={confirmTransfer} className="inline-flex w-fit rounded-2xl border border-slate-300 px-5 py-3 font-medium text-slate-800 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50">
              Confirm Send
            </button>
          </div>
        </form>
      </PageCard>

      <PageCard title="Recipients" className="xl:col-span-4">
        <form className="mb-4 grid gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-4" onSubmit={addRecipient}>
          <input className="rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-[#0b2f5b]" name="recipientEmail" type="email" value={recipientForm.recipientEmail} onChange={updateRecipientField} placeholder="recipient@example.com" required />
          <input className="rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-[#0b2f5b]" name="nickname" value={recipientForm.nickname} onChange={updateRecipientField} placeholder="Nickname" maxLength={120} />
          <button className="rounded-xl bg-[#0b2f5b] px-4 py-2 text-sm font-semibold text-white">Add Recipient</button>
        </form>

        <div className="grid gap-3">
          {recipients.length ? recipients.map((recipient) => (
            <button key={recipient.recipient_id} type="button" onClick={() => setForm((current) => ({ ...current, recipientId: recipient.recipient_id }))} className={[
              'rounded-2xl border px-4 py-3 text-left transition',
              selectedRecipient?.recipient_id === recipient.recipient_id ? 'border-[#0b2f5b] bg-sky-50' : 'border-[#ece4d0] bg-white hover:bg-slate-50',
            ].join(' ')}>
              <p className="font-semibold text-slate-950">{recipient.nickname || recipient.full_name}</p>
              <p className="text-sm text-slate-500">{recipient.email}</p>
            </button>
          )) : (
            <p className="text-sm text-slate-500">Add a registered SITWallet user before sending money.</p>
          )}
        </div>
      </PageCard>
    </div>
  )
}
