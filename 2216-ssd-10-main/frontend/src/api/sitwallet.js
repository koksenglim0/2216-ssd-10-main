import { api } from './http'

export const authApi = {
  registerStart: (body) => api.post('/auth/register', body, { auth: false }),
  registerMfaSetup: (body) => api.post('/auth/register-verify/setup', body, { auth: false }),
  registerMfaVerify: (body) => api.post('/auth/register-verify', body, { auth: false }),
  registerPassword: (body) => api.post('/auth/register-password', body, { auth: false }),
  login: (body) => api.post('/auth/login', body, { auth: false }),
  loginVerify: (body) => api.post('/auth/login-verify', body, { auth: false }),
  me: () => api.get('/auth/me'),
  refresh: () => api.refreshSession(),
  logout: () => api.post('/auth/logout', {}),
}

export const walletApi = {
  dashboard: () => api.get('/dashboard'),
  list: () => api.get('/wallets'),
  create: (currency) => api.post('/wallets', { currency }),
}

export const marketApi = {
  all: () => api.get('/market'),
  currencies: () => api.get('/market/currencies'),
  rates: () => api.get('/market/rates'),
}

export const topUpApi = {
  quote: (query) => api.get('/top-up/quote', { query }),
  confirm: (body) => api.post('/top-up', body),
}

export const exchangeApi = {
  quote: (query) => api.get('/exchange/quote', { query }),
  confirm: (body) => api.post('/exchange', body),
}

export const transferApi = {
  quote: (query) => api.get('/transfer/quote', { query }),
  recipients: () => api.get('/transfer/recipients'),
  addRecipient: (body) => api.post('/transfer/recipient', body),
  review: (body) => api.post('/transfer/review', body),
  confirm: (body) => api.post('/transfer', body),
}

export const historyApi = {
  list: (query) => api.get('/history', { query }),
  detail: (reference) => api.get(`/history/${encodeURIComponent(reference)}`),
}

export const adminApi = {
  settings: () => api.get('/admin/settings'),
  updateSetting: (settingKey, settingValue) => api.put(`/admin/settings/${encodeURIComponent(settingKey)}`, { settingValue }),
  users: (query) => api.get('/admin/users', { query }),
  updateUserStatus: (userId, body) => api.patch(`/admin/users/${encodeURIComponent(userId)}/status`, body),
  auditLogs: (query) => api.get('/admin/audit-logs', { query }),
  updateRate: (fromCurrency, toCurrency, body) => api.put(`/admin/rates/${fromCurrency}/${toCurrency}`, body),
}
