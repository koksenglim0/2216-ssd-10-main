const { query, rawQuery, callProcedure } = require('../config/db');
const { AppError } = require('../utils/errors');
const { calculateConversion, formatMoney } = require('../utils/money');
const { randomReference } = require('../utils/crypto');

async function getPlatformSetting(key) {
  const rows = await query(
    `SELECT setting_value
     FROM platform_settings
     WHERE setting_key = ?`,
    [key]
  );
  if (!rows[0]) throw new AppError(500, `Missing platform setting: ${key}`, 'CONFIG_ERROR');
  return rows[0].setting_value;
}

async function getExchangeRate(fromCurrency, toCurrency) {
  if (fromCurrency === toCurrency) {
    return {
      from_currency: fromCurrency,
      to_currency: toCurrency,
      rate: '1.0000000000',
      high_24h: '1.0000000000',
      low_24h: '1.0000000000',
      change_24h_pct: '0.0000'
    };
  }

  const rows = await query(
    `SELECT from_currency, to_currency, rate, high_24h, low_24h, change_24h_pct, updated_at
     FROM exchange_rates
     WHERE from_currency = ? AND to_currency = ?`,
    [fromCurrency, toCurrency]
  );

  if (!rows[0]) throw new AppError(404, 'Exchange rate not found', 'RATE_NOT_FOUND');
  return rows[0];
}

async function listCurrencies() {
  return query(
    `SELECT currency_code, currency_name, symbol, decimal_places, rate_to_usd,
            high_24h_to_usd, low_24h_to_usd, change_24h_pct, updated_at
     FROM currencies
     WHERE is_active = 1
     ORDER BY currency_code`
  );
}

async function listExchangeRates() {
  return query(
    `SELECT from_currency, to_currency, rate, high_24h, low_24h, change_24h_pct, updated_at
     FROM exchange_rates
     ORDER BY from_currency, to_currency`
  );
}

async function getDashboard(userId) {
  const rows = await rawQuery('CALL sp_get_dashboard(?)', [userId]);
  return {
    summary: rows[0]?.[0] || null,
    wallets: rows[1] || [],
    recentTransactions: rows[2] || [],
    exchangeRates: rows[3] || []
  };
}

async function listWallets(userId) {
  return query(
    `SELECT w.wallet_id, w.currency_code, c.currency_name, c.symbol, w.balance, w.is_active, w.updated_at
     FROM wallets w
     JOIN currencies c ON c.currency_code = w.currency_code
     WHERE w.user_id = ? AND w.is_active = 1
     ORDER BY w.currency_code`,
    [userId]
  );
}

async function createWallet(userId, currency) {
  const rows = await callProcedure('sp_create_wallet', [userId, currency]);
  return rows[0];
}

async function topUpQuote(currency, amount) {
  const feePercent = await getPlatformSetting('top_up_fee_percent');
  const calculation = calculateConversion(amount, feePercent, '1');
  const dailyLimit = await getPlatformSetting('daily_top_up_limit');

  return {
    currency,
    amount: formatMoney(amount),
    feePercent,
    feeAmount: calculation.feeAmount,
    creditedAmount: calculation.netSourceAmount,
    dailyLimit
  };
}

async function performTopUp(userId, { currency, amount, description }) {
  const reference = randomReference('TOP');
  const rows = await callProcedure('sp_top_up', [
    userId,
    currency,
    amount,
    description || null,
    reference
  ]);
  return rows[0];
}

async function conversionQuote(kind, { fromCurrency, toCurrency, amount }) {
  if (kind === 'exchange' && fromCurrency === toCurrency) {
    throw new AppError(422, 'Exchange currencies must differ', 'VALIDATION_ERROR');
  }

  const settingKey = kind === 'transfer' ? 'transfer_fee_percent' : 'exchange_fee_percent';
  const feePercent = await getPlatformSetting(settingKey);
  const rate = await getExchangeRate(fromCurrency, toCurrency);
  const calculation = calculateConversion(amount, feePercent, rate.rate);

  return {
    kind,
    fromCurrency,
    toCurrency,
    sourceAmount: calculation.sourceAmount,
    feePercent,
    feeAmount: calculation.feeAmount,
    netSourceAmount: calculation.netSourceAmount,
    exchangeRate: rate.rate,
    targetAmount: calculation.targetAmount,
    high24h: rate.high_24h,
    low24h: rate.low_24h,
    change24hPct: rate.change_24h_pct
  };
}

async function performExchange(userId, { fromCurrency, toCurrency, amount }) {
  const reference = randomReference('EXC');
  const rows = await callProcedure('sp_exchange', [
    userId,
    fromCurrency,
    toCurrency,
    amount,
    reference
  ]);
  return rows[0];
}

async function addRecipient(userId, { recipientEmail, nickname }) {
  const rows = await callProcedure('sp_add_recipient', [userId, recipientEmail, nickname || null]);
  return rows[0];
}

async function listRecipients(userId) {
  return query(
    `SELECT r.recipient_id, r.recipient_user_id, u.full_name, u.email, r.nickname, r.created_at
     FROM recipients r
     JOIN users u ON u.user_id = r.recipient_user_id
     WHERE r.owner_user_id = ?
     ORDER BY COALESCE(r.nickname, u.full_name), u.email`,
    [userId]
  );
}

async function getRecipient(userId, recipientId) {
  const rows = await query(
    `SELECT r.recipient_id, r.recipient_user_id, u.full_name, u.email, r.nickname
     FROM recipients r
     JOIN users u ON u.user_id = r.recipient_user_id
     WHERE r.owner_user_id = ? AND r.recipient_id = ?`,
    [userId, recipientId]
  );
  if (!rows[0]) throw new AppError(404, 'Recipient not found', 'RECIPIENT_NOT_FOUND');
  return rows[0];
}

async function transferReview(userId, body) {
  const recipient = await getRecipient(userId, body.recipientId);
  const quote = await conversionQuote('transfer', body);
  return { recipient, quote, description: body.description || '' };
}

async function performTransfer(userId, body) {
  const recipient = await getRecipient(userId, body.recipientId);
  const reference = randomReference('TRF');
  const rows = await callProcedure('sp_transfer', [
    userId,
    recipient.recipient_user_id,
    body.fromCurrency,
    body.toCurrency,
    body.amount,
    body.description || null,
    reference
  ]);
  return {
    ...rows[0],
    recipient: {
      recipientId: recipient.recipient_id,
      fullName: recipient.full_name,
      email: recipient.email,
      nickname: recipient.nickname
    }
  };
}

async function getHistory(userId, filters) {
  const offset = (filters.page - 1) * filters.limit;
  const params = [userId, userId, userId];
  const where = [
    `(t.initiated_by_user_id = ? OR t.sender_user_id = ? OR t.recipient_user_id = ?)`
  ];

  if (filters.type) {
    where.push('t.transaction_type = ?');
    params.push(filters.type);
  }

  if (filters.currency) {
    where.push('(t.debit_currency = ? OR t.credit_currency = ? OR t.fee_currency = ?)');
    params.push(filters.currency, filters.currency, filters.currency);
  }

  const countRows = await query(
    `SELECT COUNT(*) AS total
     FROM transactions t
     WHERE ${where.join(' AND ')}`,
    params
  );

  const rows = await query(
    `SELECT t.transaction_id, t.reference, t.transaction_type, t.status,
            t.sender_user_id, sender.full_name AS sender_name, sender.email AS sender_email,
            t.recipient_user_id, recipient.full_name AS recipient_name, recipient.email AS recipient_email,
            t.debit_currency, t.debit_amount, t.credit_currency, t.credit_amount,
            t.fee_currency, t.fee_amount, t.exchange_rate, t.description, t.created_at
     FROM transactions t
     LEFT JOIN users sender ON sender.user_id = t.sender_user_id
     LEFT JOIN users recipient ON recipient.user_id = t.recipient_user_id
     WHERE ${where.join(' AND ')}
     ORDER BY t.created_at DESC
     LIMIT ? OFFSET ?`,
    [...params, filters.limit, offset]
  );

  return {
    page: filters.page,
    limit: filters.limit,
    total: Number(countRows[0]?.total || 0),
    data: rows
  };
}

async function getTransactionByReference(userId, reference) {
  const rows = await query(
    `SELECT t.transaction_id, t.reference, t.transaction_type, t.status,
            t.sender_user_id, sender.full_name AS sender_name, sender.email AS sender_email,
            t.recipient_user_id, recipient.full_name AS recipient_name, recipient.email AS recipient_email,
            t.debit_currency, t.debit_amount, t.credit_currency, t.credit_amount,
            t.fee_currency, t.fee_amount, t.exchange_rate, t.description, t.created_at
     FROM transactions t
     LEFT JOIN users sender ON sender.user_id = t.sender_user_id
     LEFT JOIN users recipient ON recipient.user_id = t.recipient_user_id
     WHERE t.reference = ?
       AND (t.initiated_by_user_id = ? OR t.sender_user_id = ? OR t.recipient_user_id = ?)`,
    [reference, userId, userId, userId]
  );

  if (!rows[0]) throw new AppError(404, 'Transaction not found', 'TRANSACTION_NOT_FOUND');
  return rows[0];
}

async function getPlatformSettings() {
  return query(
    `SELECT setting_key, setting_value, setting_unit, description, updated_at
     FROM platform_settings
     ORDER BY setting_key`
  );
}

async function updatePlatformSetting(adminUserId, settingKey, settingValue) {
  const rows = await callProcedure('sp_update_platform_setting', [
    adminUserId,
    settingKey,
    settingValue
  ]);
  return rows[0];
}

async function updateExchangeRate(adminUserId, fromCurrency, toCurrency, body) {
  const high24h = body.high24h || body.rate;
  const low24h = body.low24h || body.rate;
  const change24hPct = body.change24hPct || '0';

  const result = await query(
    `UPDATE exchange_rates
     SET rate = ?, high_24h = ?, low_24h = ?, change_24h_pct = ?,
         source = 'admin', updated_by = ?, updated_at = CURRENT_TIMESTAMP
     WHERE from_currency = ? AND to_currency = ?`,
    [body.rate, high24h, low24h, change24hPct, adminUserId, fromCurrency, toCurrency]
  );

  if (result.affectedRows === 0) throw new AppError(404, 'Exchange rate not found', 'RATE_NOT_FOUND');
  return getExchangeRate(fromCurrency, toCurrency);
}

async function listUsers(filters = {}) {
  const params = [];
  const where = [];

  if (filters.status) {
    where.push('status = ?');
    params.push(filters.status);
  }

  const clause = where.length ? `WHERE ${where.join(' AND ')}` : '';
  return query(
    `SELECT user_id, full_name, email, phone_number, role_name, status,
            primary_currency, mfa_enabled, created_at, last_login_at
     FROM users
     ${clause}
     ORDER BY created_at DESC
     LIMIT 200`,
    params
  );
}

async function updateUserStatus(adminUserId, userId, { status, roleName }) {
  const params = [status];
  let roleSql = '';

  if (roleName) {
    roleSql = ', role_name = ?';
    params.push(roleName);
  }

  params.push(userId);
  const result = await query(
    `UPDATE users
     SET status = ? ${roleSql}, updated_at = CURRENT_TIMESTAMP
     WHERE user_id = ?`,
    params
  );

  if (result.affectedRows === 0) throw new AppError(404, 'User not found', 'USER_NOT_FOUND');

  await callProcedure('sp_log_audit', [
    adminUserId,
    'admin.user.update',
    'user',
    userId,
    'SUCCESS',
    null,
    null,
    JSON.stringify({ status, roleName: roleName || null })
  ]);

  const rows = await query(
    `SELECT user_id, full_name, email, role_name, status, updated_at
     FROM users
     WHERE user_id = ?`,
    [userId]
  );
  return rows[0];
}

async function listAuditLogs(filters) {
  const page = filters.page || 1;
  const limit = filters.limit || 50;
  const offset = (page - 1) * limit;
  const params = [];
  const where = [];

  if (filters.userId) {
    where.push('al.user_id = ?');
    params.push(filters.userId);
  }

  if (filters.actor) {
    where.push('(u.email LIKE ? OR u.full_name LIKE ? OR al.user_id LIKE ?)');
    const actor = `%${filters.actor}%`;
    params.push(actor, actor, actor);
  }

  if (filters.action) {
    where.push('al.action LIKE ?');
    params.push(`%${filters.action}%`);
  }

  if (filters.actionPrefix) {
    where.push('al.action LIKE ?');
    params.push(`${filters.actionPrefix}.%`);
  }

  if (filters.status) {
    where.push('al.status = ?');
    params.push(filters.status);
  }

  if (filters.resourceType) {
    where.push('al.resource_type = ?');
    params.push(filters.resourceType);
  }

  if (filters.ipAddress) {
    where.push('al.ip_address LIKE ?');
    params.push(`${filters.ipAddress}%`);
  }

  if (filters.dateFrom) {
    where.push('al.created_at >= ?');
    params.push(new Date(filters.dateFrom));
  }

  if (filters.dateTo) {
    where.push('al.created_at <= ?');
    params.push(new Date(filters.dateTo));
  }

  const clause = where.length ? `WHERE ${where.join(' AND ')}` : '';
  const sortColumns = {
    created_at: 'al.created_at',
    action: 'al.action',
    status: 'al.status',
    user_id: 'al.user_id',
    ip_address: 'al.ip_address',
    resource_type: 'al.resource_type'
  };
  const sortColumn = sortColumns[filters.sortBy] || sortColumns.created_at;
  const sortDir = filters.sortDir === 'asc' ? 'ASC' : 'DESC';

  const countRows = await query(
    `SELECT COUNT(*) AS total
     FROM audit_logs al
     LEFT JOIN users u ON u.user_id = al.user_id
     ${clause}`,
    params
  );

  const rows = await query(
    `SELECT al.log_id, al.user_id, u.full_name AS actor_name, u.email AS actor_email,
            al.action, al.resource_type, al.resource_id, al.status,
            al.ip_address, al.user_agent, al.metadata, al.created_at
     FROM audit_logs al
     LEFT JOIN users u ON u.user_id = al.user_id
     ${clause}
     ORDER BY ${sortColumn} ${sortDir}, al.log_id ${sortDir}
     LIMIT ? OFFSET ?`,
    [...params, limit, offset]
  );

  return { page, limit, total: Number(countRows[0]?.total || 0), data: rows };
}

module.exports = {
  listCurrencies,
  listExchangeRates,
  getDashboard,
  listWallets,
  createWallet,
  topUpQuote,
  performTopUp,
  conversionQuote,
  performExchange,
  addRecipient,
  listRecipients,
  transferReview,
  performTransfer,
  getHistory,
  getTransactionByReference,
  getPlatformSettings,
  updatePlatformSetting,
  updateExchangeRate,
  listUsers,
  updateUserStatus,
  listAuditLogs
};
