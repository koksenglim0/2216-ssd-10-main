# Frontend and Backend Integration Map

## Runtime Shape

- `frontend` is a Vite React app. In development, Vite proxies `/api` to the backend using `VITE_API_PROXY_TARGET`.
- `backend` is an Express API. It owns authentication, MFA, CSRF token issuing, rate limiting, RBAC, audit logging, and all MySQL access. It binds to `HOST=127.0.0.1` by default and should not be published directly to end users.
- MySQL remains the source of truth. Money movement writes are still performed by stored procedures.

## Frontend Modules

| Area | Files | Depends on |
| --- | --- | --- |
| API transport | `frontend/src/api/http.js` | Browser `fetch`, CSRF endpoint, refresh cookie |
| API endpoint wrappers | `frontend/src/api/sitwallet.js` | `http.js`, documented backend routes |
| Session provider | `frontend/src/auth/AuthContext.jsx` | `authApi`, access token helpers |
| Session consumer hook | `frontend/src/auth/useAuth.js` | `authContextValue.js` |
| Route protection | `frontend/src/components/ProtectedRoute.jsx` | `useAuth`, React Router |
| App shell/navigation | `frontend/src/components/AppShell.jsx`, `Sidebar.jsx`, `Topbar.jsx` | `useAuth`, route maps |
| Page workflows | `frontend/src/pages/*.jsx` | Role-specific API wrappers |
| Formatting | `frontend/src/utils/formatters.js` | Browser `Intl` APIs |

## API Flow

1. The frontend calls `GET /api/security/csrf-token` before unsafe methods and stores the token in memory.
2. Registration follows the backend sequence:
   - `POST /api/auth/register`
   - `POST /api/auth/register-verify/setup`
   - `POST /api/auth/register-verify`
   - `POST /api/auth/register-password`
3. Login follows password then TOTP challenge:
   - `POST /api/auth/login`
   - `POST /api/auth/login-verify`
4. Access tokens are kept in `sessionStorage`; refresh tokens remain in backend-issued HTTP-only cookies.
5. Authenticated requests send `Authorization: Bearer <accessToken>`.
6. A `401` response triggers one refresh attempt via `POST /api/auth/refresh`, then retries the original request.

## Docker-Ready Boundaries

- Frontend container: set `VITE_API_BASE_URL` to the public API origin or `/api` behind a reverse proxy.
- Backend container: set database and secret env vars from `backend/.env.example`. Use `HOST=0.0.0.0` inside Docker only when the container is reachable through an internal network or reverse proxy, not by publishing `5000` publicly.
- Database container: run `backend/sql/001_schema.sql` before using the app.
- Cookies should use `COOKIE_SECURE=true` behind HTTPS in non-local deployments.
- Keep `EXPOSE_MANUAL_TESTER=false` outside intentional local API debugging.
- Keep `ALLOW_LOOPBACK_CORS=false` unless you are deliberately testing from alternate local frontend ports.
