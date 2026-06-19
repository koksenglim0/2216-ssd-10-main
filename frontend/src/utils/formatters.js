const dateFormatter = new Intl.DateTimeFormat(undefined, {
  dateStyle: 'medium',
  timeStyle: 'short',
})

export function formatCurrency(amount, currency = 'USD') {
  const number = Number(amount || 0)

  try {
    return new Intl.NumberFormat(undefined, {
      style: 'currency',
      currency,
      maximumFractionDigits: 2,
    }).format(number)
  } catch {
    return `${currency} ${number.toFixed(2)}`
  }
}

export function formatDecimal(value, digits = 4) {
  const number = Number(value || 0)
  return number.toLocaleString(undefined, {
    maximumFractionDigits: digits,
  })
}

export function formatDate(value) {
  if (!value) return '-'
  return dateFormatter.format(new Date(value))
}

export function transactionLabel(transaction, viewerUserId) {
  if (transaction.description) return transaction.description
  if (transaction.transaction_type === 'TOP_UP') return 'Wallet top-up'
  if (transaction.transaction_type === 'EXCHANGE') return `${transaction.debit_currency} to ${transaction.credit_currency} exchange`
  if (transaction.transaction_type === 'TRANSFER') {
    if (viewerUserId && transaction.recipient_user_id === viewerUserId) {
      return transaction.sender_name ? `Transfer from ${transaction.sender_name}` : 'Transfer received'
    }
    return transaction.recipient_name ? `Transfer to ${transaction.recipient_name}` : 'Money transfer'
  }
  return transaction.reference
}

export function transactionAmount(transaction, viewerUserId) {
  if (transaction.transaction_type === 'TOP_UP') {
    return `+ ${formatCurrency(transaction.credit_amount, transaction.credit_currency)}`
  }

  if (transaction.transaction_type === 'EXCHANGE') {
    return `${formatCurrency(transaction.debit_amount, transaction.debit_currency)} -> ${formatCurrency(transaction.credit_amount, transaction.credit_currency)}`
  }

  if (transaction.transaction_type === 'TRANSFER' && viewerUserId && transaction.recipient_user_id === viewerUserId) {
    return `+ ${formatCurrency(transaction.credit_amount, transaction.credit_currency)}`
  }

  return `- ${formatCurrency(transaction.debit_amount, transaction.debit_currency)}`
}
