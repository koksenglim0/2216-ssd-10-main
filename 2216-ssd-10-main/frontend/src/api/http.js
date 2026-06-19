const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '/api'
const ACCESS_TOKEN_KEY = 'sitwallet.accessToken'

let accessToken = sessionStorage.getItem(ACCESS_TOKEN_KEY) || ''
let csrfToken = ''
let refreshPromise = null

export class ApiError extends Error {
  constructor(message, { status, code, details } = {}) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.code = code
    this.details = details
  }
}

export function getAccessToken() {
  return accessToken
}

export function setAccessToken(token) {
  accessToken = token || ''

  if (accessToken) {
    sessionStorage.setItem(ACCESS_TOKEN_KEY, accessToken)
  } else {
    sessionStorage.removeItem(ACCESS_TOKEN_KEY)
  }
}

function makeUrl(path, query) {
  const normalizedPath = path.startsWith('/') ? path : `/${path}`
  const base = API_BASE_URL.endsWith('/') ? API_BASE_URL.slice(0, -1) : API_BASE_URL
  const url = new URL(`${base}${normalizedPath}`, window.location.origin)

  Object.entries(query || {}).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') {
      url.searchParams.set(key, value)
    }
  })

  return url.toString()
}

async function readResponse(response) {
  if (response.status === 204) return null

  const text = await response.text()
  if (!text) return null

  try {
    return JSON.parse(text)
  } catch {
    return text
  }
}

function toApiError(response, payload) {
  const error = payload?.error || {}
  const detailMessage = Array.isArray(error.details) && error.details.length
    ? error.details.map((detail) => `${detail.path || 'field'}: ${detail.message}`).join('; ')
    : ''
  const message = detailMessage
    ? `${error.message || 'Request failed'}: ${detailMessage}`
    : error.message || response.statusText || 'Request failed'

  return new ApiError(message, {
    status: response.status,
    code: error.code,
    details: error.details,
  })
}

async function ensureCsrfToken() {
  if (csrfToken) return csrfToken

  const response = await fetch(makeUrl('/security/csrf-token'), {
    credentials: 'include',
    headers: { Accept: 'application/json' },
  })
  const payload = await readResponse(response)

  if (!response.ok) {
    throw toApiError(response, payload)
  }

  csrfToken = payload.csrfToken
  return csrfToken
}

async function refreshSession() {
  if (!refreshPromise) {
    refreshPromise = (async () => {
      const payload = await apiRequest('/auth/refresh', {
        method: 'POST',
        skipRefresh: true,
        auth: false,
      })
      setAccessToken(payload.accessToken)
      return payload
    })().finally(() => {
      refreshPromise = null
    })
  }

  return refreshPromise
}

export async function apiRequest(path, options = {}) {
  const {
    method = 'GET',
    body,
    query,
    auth = true,
    skipRefresh = false,
    headers = {},
  } = options

  const upperMethod = method.toUpperCase()
  const hasBody = body !== undefined && body !== null

  if (auth && !accessToken && !skipRefresh) {
    await refreshSession()
  }

  const requestHeaders = {
    Accept: 'application/json',
    ...headers,
  }

  if (hasBody) {
    requestHeaders['Content-Type'] = 'application/json'
  }

  if (auth && accessToken) {
    requestHeaders.Authorization = `Bearer ${accessToken}`
  }

  if (!['GET', 'HEAD', 'OPTIONS'].includes(upperMethod)) {
    requestHeaders['X-CSRF-Token'] = await ensureCsrfToken()
  }

  const response = await fetch(makeUrl(path, query), {
    method: upperMethod,
    credentials: 'include',
    headers: requestHeaders,
    body: hasBody ? JSON.stringify(body) : undefined,
  })
  const payload = await readResponse(response)

  if (response.ok) return payload

  if (response.status === 401 && auth && !skipRefresh) {
    try {
      await refreshSession()
      return apiRequest(path, { ...options, skipRefresh: true })
    } catch {
      setAccessToken('')
    }
  }

  if (response.status === 403 && payload?.error?.code === 'CSRF_INVALID') {
    csrfToken = ''
  }

  throw toApiError(response, payload)
}

export const api = {
  get: (path, options) => apiRequest(path, { ...options, method: 'GET' }),
  post: (path, body, options) => apiRequest(path, { ...options, method: 'POST', body }),
  put: (path, body, options) => apiRequest(path, { ...options, method: 'PUT', body }),
  patch: (path, body, options) => apiRequest(path, { ...options, method: 'PATCH', body }),
  delete: (path, options) => apiRequest(path, { ...options, method: 'DELETE' }),
  refreshSession,
}
