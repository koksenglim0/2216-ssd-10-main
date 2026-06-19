(function () {
  const redacted = '[redacted]';
  const sensitiveKeys = new Set([
    'accessToken',
    'authorization',
    'confirmPassword',
    'cookie',
    'csrfToken',
    'otpauthUrl',
    'password',
    'qrCodeDataUrl',
    'refreshToken',
    'secret',
    'token'
  ]);
  const state = loadState();
  const output = document.getElementById('responseOutput');
  const baseUrlInput = document.getElementById('baseUrl');
  const qrPreview = document.getElementById('qrPreview');

  baseUrlInput.value = state.baseUrl || '/api';
  updateStatus();
  fillStateInputs();

  document.addEventListener('submit', async (event) => {
    const form = event.target.closest('form');
    if (!form) return;

    event.preventDefault();
    const request = buildRequestFromForm(form);
    const result = await apiRequest(request.method, request.endpoint, request.body);
    captureUsefulState(result, form.dataset.stateKey);
    renderQr(result);
    fillStateInputs();
    updateStatus();
  });

  document.addEventListener('click', async (event) => {
    const button = event.target.closest('button[data-action]');
    if (!button) return;

    const action = button.dataset.action;
    if (action === 'saveBaseUrl') {
      state.baseUrl = cleanBaseUrl(baseUrlInput.value);
      saveState();
      updateStatus();
      writeOutput({ savedBaseUrl: state.baseUrl });
      return;
    }

    if (action === 'clearState') {
      localStorage.removeItem('sitwalletTesterState');
      Object.keys(state).forEach((key) => delete state[key]);
      state.baseUrl = cleanBaseUrl(baseUrlInput.value);
      saveState();
      fillStateInputs();
      updateStatus();
      writeOutput({ state: 'cleared' });
      return;
    }

    if (action === 'clearOutput') {
      output.textContent = 'No requests yet.';
      return;
    }

    await runAction(action);
  });

  async function runAction(action) {
    const actions = {
      getCsrf: ['GET', '/security/csrf-token'],
      health: ['GET', '/health'],
      registerSuccess: ['GET', '/auth/register-success'],
      me: ['GET', '/auth/me'],
      refresh: ['POST', '/auth/refresh'],
      logout: ['POST', '/auth/logout'],
      dashboard: ['GET', '/dashboard'],
      wallets: ['GET', '/wallets'],
      market: ['GET', '/market'],
      rates: ['GET', '/market/rates'],
      currencies: ['GET', '/market/currencies'],
      recipients: ['GET', '/transfer/recipients'],
      settings: ['GET', '/admin/settings'],
      users: ['GET', '/admin/users'],
      auditLogs: ['GET', '/admin/audit-logs?page=1&limit=50']
    };

    const request = actions[action];
    if (!request) return;

    const result = await apiRequest(request[0], request[1], null);
    if (action === 'getCsrf' && result.data?.csrfToken) state.csrfToken = result.data.csrfToken;
    if (action === 'logout' && result.ok) state.accessToken = '';
    captureUsefulState(result);
    fillStateInputs();
    updateStatus();
  }

  function buildRequestFromForm(form) {
    const method = form.dataset.method || 'GET';
    const data = formToObject(form);
    const pathTemplate = form.dataset.pathEndpoint;

    if (pathTemplate) {
      const endpoint = fillPathTemplate(pathTemplate, data);
      const body = method === 'GET' ? null : removePathFields(data, pathTemplate);
      return { method, endpoint, body };
    }

    if (form.dataset.queryEndpoint) {
      return {
        method: 'GET',
        endpoint: `${form.dataset.queryEndpoint}${toQuery(data)}`,
        body: null
      };
    }

    return {
      method,
      endpoint: form.dataset.endpoint,
      body: data
    };
  }

  function formToObject(form) {
    const data = {};
    for (const element of Array.from(form.elements)) {
      if (!element.name || element.disabled) continue;
      if (element.type === 'checkbox') {
        data[element.name] = element.checked;
        continue;
      }
      if (element.value === '') continue;
      data[element.name] = element.value;
    }
    return data;
  }

  function fillPathTemplate(template, data) {
    return template.replace(/\{([^}]+)\}/g, (_, key) => {
      const value = data[key] || state[key] || '';
      return encodeURIComponent(value);
    });
  }

  function removePathFields(data, template) {
    const body = { ...data };
    const matches = template.matchAll(/\{([^}]+)\}/g);
    for (const match of matches) delete body[match[1]];
    return body;
  }

  function toQuery(data) {
    const params = new URLSearchParams();
    Object.entries(data).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== '') params.set(key, value);
    });
    const text = params.toString();
    return text ? `?${text}` : '';
  }

  async function apiRequest(method, endpoint, body) {
    state.baseUrl = cleanBaseUrl(baseUrlInput.value);
    saveState();

    if (requiresAccessToken(endpoint) && !state.accessToken) {
      const result = {
        ok: false,
        skipped: true,
        request: { method, url: `${state.baseUrl}${endpoint}`, body },
        message: 'This endpoint requires login. Run Login, then Verify Login MFA, then try this request again.'
      };
      writeOutput(result);
      updateStatus();
      return result;
    }

    if (!['GET', 'HEAD', 'OPTIONS'].includes(method)) {
      await ensureCsrfToken();
    }

    const url = `${state.baseUrl}${endpoint}`;
    const headers = { Accept: 'application/json' };
    if (body !== null && body !== undefined) headers['Content-Type'] = 'application/json';
    if (state.accessToken) headers.Authorization = `Bearer ${state.accessToken}`;
    if (state.csrfToken && !['GET', 'HEAD', 'OPTIONS'].includes(method)) {
      headers['X-CSRF-Token'] = state.csrfToken;
    }

    const startedAt = new Date();
    let response;
    let data;

    try {
      response = await fetch(url, {
        method,
        headers,
        credentials: 'include',
        body: body === null || body === undefined ? undefined : JSON.stringify(body)
      });

      const text = await response.text();
      data = parseResponseText(text);
      const result = {
        ok: response.ok,
        status: response.status,
        statusText: response.statusText,
        request: { method, url, body },
        data,
        durationMs: Date.now() - startedAt.getTime()
      };
      if (response.status === 401 && data?.error?.code === 'UNAUTHENTICATED') {
        state.accessToken = '';
        saveState();
        updateStatus();
      }
      writeOutput(result);
      return result;
    } catch (error) {
      const result = {
        ok: false,
        request: { method, url, body },
        error: error.message
      };
      writeOutput(result);
      return result;
    }
  }

  function requiresAccessToken(endpoint) {
    const path = endpoint.split('?')[0];
    const publicExact = new Set([
      '/health',
      '/security/csrf-token',
      '/auth/register',
      '/auth/register-verify/setup',
      '/auth/register-verify',
      '/auth/register-password',
      '/auth/register-success',
      '/auth/login',
      '/auth/login-verify',
      '/auth/refresh',
      '/auth/logout',
      '/market',
      '/market/rates',
      '/market/currencies'
    ]);
    return !publicExact.has(path);
  }

  async function ensureCsrfToken() {
    if (state.csrfToken) return;

    const url = `${cleanBaseUrl(baseUrlInput.value)}/security/csrf-token`;
    const response = await fetch(url, {
      method: 'GET',
      headers: { Accept: 'application/json' },
      credentials: 'include'
    });
    const data = await response.json();
    state.csrfToken = data.csrfToken;
    saveState();
    updateStatus();
  }

  function parseResponseText(text) {
    if (!text) return null;
    try {
      return JSON.parse(text);
    } catch {
      return text;
    }
  }

  function captureUsefulState(result, explicitKey) {
    const data = result?.data;
    if (!data) return;

    if (explicitKey && data[explicitKey]) state[explicitKey] = data[explicitKey];
    if (data.csrfToken) state.csrfToken = data.csrfToken;
    if (data.registrationId) state.registrationId = data.registrationId;
    if (data.loginChallengeId) state.loginChallengeId = data.loginChallengeId;
    if (data.accessToken) state.accessToken = data.accessToken;
    if (data.user?.userId) state.userId = data.user.userId;
    if (data.walletId) state.walletId = data.walletId;
    if (data.recipient?.recipientId) state.recipientId = data.recipient.recipientId;
    if (data.transaction?.reference) state.reference = data.transaction.reference;
    if (data.transaction?.recipient?.recipientId) state.recipientId = data.transaction.recipient.recipientId;
    if (data.reference) state.reference = data.reference;
    if (Array.isArray(data.recipients) && data.recipients[0]?.recipient_id) {
      state.recipientId = data.recipients[0].recipient_id;
    }
    if (data.users?.[0]?.user_id) state.userId = data.users[0].user_id;

    saveState();
  }

  function renderQr(result) {
    const dataUrl = result?.data?.qrCodeDataUrl;
    if (!dataUrl || !qrPreview) return;
    qrPreview.innerHTML = '';
    const image = document.createElement('img');
    image.alt = 'TOTP QR code';
    image.src = dataUrl;
    qrPreview.appendChild(image);
  }

  function fillStateInputs() {
    document.querySelectorAll('[data-fill]').forEach((input) => {
      const key = input.dataset.fill;
      if (!input.value && state[key]) input.value = state[key];
    });
  }

  function updateStatus() {
    document.getElementById('csrfStatus').textContent = state.csrfToken ? 'CSRF: ready' : 'CSRF: none';
    document.getElementById('authStatus').textContent = state.accessToken ? 'Auth: access token stored' : 'Auth: login required';
    document.getElementById('lastReferenceStatus').textContent = state.reference ? `Last ref: ${state.reference}` : 'Last ref: none';
  }

  function writeOutput(value) {
    output.textContent = JSON.stringify(redactForDisplay(value), null, 2);
  }

  function redactForDisplay(value) {
    if (Array.isArray(value)) return value.map(redactForDisplay);
    if (!value || typeof value !== 'object') return value;

    return Object.fromEntries(Object.entries(value).map(([key, item]) => {
      if (isSensitiveKey(key)) return [key, redacted];
      return [key, redactForDisplay(item)];
    }));
  }

  function isSensitiveKey(key) {
    const normalizedKey = key.toLowerCase();
    return sensitiveKeys.has(key)
      || sensitiveKeys.has(normalizedKey)
      || normalizedKey.includes('password')
      || normalizedKey.includes('secret')
      || normalizedKey.endsWith('token');
  }

  function cleanBaseUrl(value) {
    return (value || '/api').replace(/\/+$/, '');
  }

  function loadState() {
    try {
      return JSON.parse(localStorage.getItem('sitwalletTesterState')) || {};
    } catch {
      return {};
    }
  }

  function saveState() {
    localStorage.setItem('sitwalletTesterState', JSON.stringify(state));
  }
}());
