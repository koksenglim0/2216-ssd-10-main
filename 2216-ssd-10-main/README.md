# SITWallet

Secure SITWallet implementation using a Node.js/Express backend, MySQL stored procedures, and an integrated React/Vite frontend.

## Quick Start

1. Install backend dependencies:

```bash
cd backend
npm install
```

2. Create `backend/.env` from `backend/.env.example` and set real secrets.

3. Create tables, seed hardcoded rates, and install stored procedures:

```bash
npm run db:migrate
```

4. Start the API from the `backend` folder:

```bash
npm run dev
```

The API listens on `127.0.0.1:5000` by default. Keep it behind the Vite proxy locally and behind an internal Docker network or reverse proxy in deployment.

5. Install and start the React frontend:

```bash
cd ../frontend
npm install
npm run dev
```

The React app listens on `http://localhost:5173` by default and proxies `/api` to `http://127.0.0.1:5000`.

The original backend manual tester is disabled by default. Set `EXPOSE_MANUAL_TESTER=true` only for local debugging if you intentionally want `http://localhost:5000/` to serve it.

Protected actions such as Dashboard, Wallets, Top-up, Exchange, Transfer, History, and Admin require a completed `Login` plus `Verify Login MFA` flow first. The tester stores the returned access token in browser local storage and uses it for those requests.

If requests return `DATABASE_UNAVAILABLE`, check that MySQL is running, `.env` has the correct `DB_USER` and `DB_PASSWORD`, and `npm run db:migrate` has been run.

## Important Docs

- API contract for frontend developers: [docs/API.md](docs/API.md)
- Full SQL schema and procedures: [docs/SCHEMA.md](docs/SCHEMA.md)
- Database bootstrap file: [backend/sql/001_schema.sql](backend/sql/001_schema.sql)
- Manual browser tester source: [backend/public/index.html](backend/public/index.html)
- Frontend/backend integration map: [docs/FRONTEND_BACKEND_INTEGRATION.md](docs/FRONTEND_BACKEND_INTEGRATION.md)

## Security Controls Included

- TOTP MFA for registration and login
- bcrypt password hashing
- AES-256-GCM encryption for TOTP secrets at rest
- JWT access tokens plus hashed refresh tokens
- RBAC roles: `customer`, `support`, `admin`
- CSRF double-submit token for unsafe HTTP methods
- Helmet, strict JSON body size, CORS allow-listing, rate limiting
- Stored procedures for wallet creation, top-up, transfer, exchange, dashboard, recipients, and audit logging
- Immutable transaction ledger rows and audit log rows

