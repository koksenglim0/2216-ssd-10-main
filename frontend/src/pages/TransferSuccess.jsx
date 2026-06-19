import { useCallback } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { historyApi } from '../api/sitwallet'
import PageCard from '../components/PageCard'
import StatusMessage from '../components/StatusMessage'
import { useAsyncData } from '../hooks/useAsyncData'
import { formatCurrency, formatDate, transactionLabel } from '../utils/formatters'

export default function TransferSuccess() {
  const [searchParams] = useSearchParams()
  const reference = searchParams.get('reference')
  const loadReceipt = useCallback(() => (reference ? historyApi.detail(reference) : Promise.resolve(null)), [reference])
  const { data, error, loading } = useAsyncData(loadReceipt)
  const transaction = data?.transaction

  return (
    <PageCard title="Transaction complete" eyebrow="Success">
      <div className="grid gap-4 text-center">
        <StatusMessage type="error">{error}</StatusMessage>
        {!reference ? <StatusMessage type="warning">No reference was provided for this receipt.</StatusMessage> : null}
        {loading && reference ? <p className="text-slate-600">Loading receipt...</p> : null}

        <div className="grid gap-2 rounded-3xl bg-slate-50 p-6">
          <p className="text-xs uppercase tracking-[0.18em] text-slate-500">{transaction?.transaction_type || 'Transaction'}</p>
          <p className="font-display text-3xl text-slate-950">{transaction ? transactionLabel(transaction) : 'Money movement recorded'}</p>
          {transaction ? (
            <>
              {transaction.debit_currency ? <p className="text-slate-600">Debited: {formatCurrency(transaction.debit_amount, transaction.debit_currency)}</p> : null}
              {transaction.credit_currency ? <p className="text-slate-600">Credited: {formatCurrency(transaction.credit_amount, transaction.credit_currency)}</p> : null}
              <p className="text-slate-600">Fee: {formatCurrency(transaction.fee_amount, transaction.fee_currency || transaction.debit_currency)}</p>
              <p className="text-slate-600">Status: {transaction.status}</p>
              <p className="text-slate-600">Date: {formatDate(transaction.created_at)}</p>
            </>
          ) : null}
          <p className="text-slate-600">Reference: {reference || '-'}</p>
        </div>
        <div className="flex flex-wrap justify-center gap-3">
          <button onClick={() => window.print()} className="rounded-2xl border border-[#ddd3bc] px-5 py-3 text-slate-700 transition hover:bg-slate-50">Print Receipt</button>
          <Link to="/dashboard" className="rounded-2xl bg-slate-950 px-5 py-3 font-medium text-white transition hover:bg-slate-800">Return to Dashboard</Link>
        </div>
      </div>
    </PageCard>
  )
}
