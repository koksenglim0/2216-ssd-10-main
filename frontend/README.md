# SITWallet Frontend

React/Vite client for SITWallet. It is intentionally a browser UI only: authentication, MFA, CSRF, RBAC, audit logging, money movement, and persistence are enforced by the Express/MySQL backend.

## Local Development

```bash
npm install
npm run dev
```

The dev server runs on `http://localhost:5173` and proxies `/api` to the backend configured by `VITE_API_PROXY_TARGET`.

Copy `.env.example` when you need custom local ports:

```env
VITE_API_BASE_URL=/api
VITE_API_PROXY_TARGET=http://127.0.0.1:5000
```

## Checks

```bash
npm run lint
npm run build
npm audit --omit=dev
```

## Structure

- `src/api`: API transport and typed-by-purpose endpoint wrappers.
- `src/auth`: session provider and auth hook.
- `src/components`: shared shell, route guards, cards, and status UI.
- `src/pages`: feature pages, kept close to their workflows.
- `src/utils`: formatting helpers.

Access tokens are stored in `sessionStorage` for tab-scoped browser state. Refresh tokens stay in backend-issued HTTP-only cookies.
