# SITWallet API Guide

Base URL in local frontend development: `/api` through the Vite proxy.
Direct backend URL for API tools on the same machine: `http://127.0.0.1:5000/api`.

The backend manual tester is disabled by default. Set `EXPOSE_MANUAL_TESTER=true` only for intentional local debugging; keep it disabled in shared or deployed environments.

All JSON requests should include:

```http
Content-Type: application/json
```

For authenticated endpoints:

```http
Authorization: Bearer <accessToken>
```

Dashboard, wallets, top-up, exchange, transfer, history, and admin endpoints require this token. In the React frontend, sign in with password and MFA before using those sections.

For unsafe methods (`POST`, `PUT`, `PATCH`, `DELETE`), first call `GET /api/security/csrf-token`, keep the returned cookie, and send the returned token as:

```http
X-CSRF-Token: <csrfToken>
```

## Auth and Registration

### Get CSRF Token

`GET /api/security/csrf-token`

Response:

```json
{
  "csrfToken": "hex-token"
}
```

### Start Registration

`POST /api/auth/register`

Body:

```json
{
  "fullName": "Jane Tan",
  "email": "jane@example.com"
}
```

Response:

```json
{
  "registrationId": "uuid",
  "nextStep": "register-verify"
}
```

### Setup MFA QR

`POST /api/auth/register-verify/setup`

Body:

```json
{
  "registrationId": "uuid",
  "phoneNumber": "+6591234567"
}
```

Response includes `qrCodeDataUrl` for display and `otpauthUrl` for authenticator apps.

### Verify Registration MFA

`POST /api/auth/register-verify`

Body:

```json
{
  "registrationId": "uuid",
  "code": "123456"
}
```

### Complete Registration

`POST /api/auth/register-password`

Body:

```json
{
  "registrationId": "uuid",
  "password": "StrongPassword!123",
  "confirmPassword": "StrongPassword!123",
  "primaryCurrency": "SGD",
  "termsAccepted": true
}
```

Response gives the first wallet ID and frontend next links.

### Login

`POST /api/auth/login`

Body:

```json
{
  "email": "jane@example.com",
  "password": "StrongPassword!123"
}
```

Response:

```json
{
  "loginChallengeId": "uuid",
  "expiresInSeconds": 300,
  "mfaRequired": true
}
```

### Verify Login MFA

`POST /api/auth/login-verify`

Body:

```json
{
  "loginChallengeId": "uuid",
  "code": "123456"
}
```

Response:

```json
{
  "accessToken": "jwt",
  "tokenType": "Bearer",
  "user": {
    "userId": "uuid",
    "fullName": "Jane Tan",
    "email": "jane@example.com",
    "role": "customer",
    "primaryCurrency": "SGD"
  }
}
```

The refresh token is set as an HTTP-only cookie.

### Refresh Session

`POST /api/auth/refresh`

Body can be empty if the browser has the refresh cookie.

### Logout

`POST /api/auth/logout`

Revokes the refresh token cookie.

### Current User

`GET /api/auth/me`

Returns the authenticated user profile.

## Dashboard

### Dashboard Summary

`GET /api/dashboard`

Returns:

- `summary`: total estimated balance in the user's primary currency
- `wallets`: all active wallets and balances
- `recentTransactions`: latest 10 transactions
- `exchangeRates`: seeded/admin-updated rates

## Wallets

### List Wallets

`GET /api/wallets`

### Create Wallet

`POST /api/wallets`

Body:

```json
{
  "currency": "USD"
}
```

Wallet creation is idempotent per user/currency.

## Market Rates

### Full Market

`GET /api/market`

Returns `currencies` and all currency-pair `rates`.

### Rates Only

`GET /api/market/rates`

### Currencies Only

`GET /api/market/currencies`

## Add Funds

### Top-up Quote

`GET /api/top-up/quote?currency=SGD&amount=100`

Response:

```json
{
  "quote": {
    "currency": "SGD",
    "amount": "100.00000000",
    "feePercent": "0.30000000",
    "feeAmount": "0.30000000",
    "creditedAmount": "99.70000000",
    "dailyLimit": "5000.00000000"
  }
}
```

### Confirm Top-up

`POST /api/top-up`

Body:

```json
{
  "currency": "SGD",
  "amount": "100",
  "description": "Test top-up"
}
```

The stored procedure enforces the daily top-up limit and credits the net amount after fees.

## Exchange

### Exchange Quote

`GET /api/exchange/quote?fromCurrency=SGD&toCurrency=USD&amount=100`

### Confirm Exchange

`POST /api/exchange`

Body:

```json
{
  "fromCurrency": "SGD",
  "toCurrency": "USD",
  "amount": "100"
}
```

Response includes `reference`, `exchange_rate`, `fee_amount`, and `bought_amount`.

## Send Money

### Transfer Quote

`GET /api/transfer/quote?fromCurrency=SGD&toCurrency=USD&amount=100`

### List Recipients

`GET /api/transfer/recipients`

### Add Recipient

`POST /api/transfer/recipient`

Body:

```json
{
  "recipientEmail": "alex@example.com",
  "nickname": "Alex"
}
```

The backend verifies that the recipient is a registered active user.

### Transfer Review

`POST /api/transfer/review`

Body:

```json
{
  "recipientId": "uuid",
  "fromCurrency": "SGD",
  "toCurrency": "USD",
  "amount": "100",
  "description": "Dinner"
}
```

Returns recipient details and the final fee/conversion quote.

### Confirm Transfer

`POST /api/transfer`

Body:

```json
{
  "recipientId": "uuid",
  "fromCurrency": "SGD",
  "toCurrency": "USD",
  "amount": "100",
  "description": "Dinner",
  "confirm": true
}
```

The stored procedure debits the sender, creates the recipient wallet if needed, credits the converted net amount, and writes an immutable transaction row.

## History

### Transaction History

`GET /api/history?page=1&limit=25&type=TRANSFER&currency=SGD`

Filters are optional. `type` can be `TOP_UP`, `TRANSFER`, or `EXCHANGE`.

### Transaction Detail

`GET /api/history/:reference`

## Admin and RBAC

Admin endpoints require `role = admin`. Audit log and user listing allow `admin` and `support`.

### List Settings

`GET /api/admin/settings`

### Update Setting

`PUT /api/admin/settings/:settingKey`

Body:

```json
{
  "settingValue": "0.50"
}
```

Valid seeded setting keys:

- `exchange_fee_percent`
- `transfer_fee_percent`
- `top_up_fee_percent`
- `daily_top_up_limit`

### Update Exchange Rate

`PUT /api/admin/rates/:fromCurrency/:toCurrency`

Body:

```json
{
  "rate": "1.3513513514",
  "high24h": "1.3600000000",
  "low24h": "1.3400000000",
  "change24hPct": "0.12"
}
```

### List Users

`GET /api/admin/users`

### Update User Status or Role

`PATCH /api/admin/users/:userId/status`

Body:

```json
{
  "status": "suspended",
  "roleName": "customer"
}
```

### Audit Logs

`GET /api/admin/audit-logs?page=1&limit=50`

Optional filters:

- `actor`: matches user email, full name, or user ID
- `userId`: exact user UUID
- `ipAddress`: origin IP prefix
- `action`: action substring, such as `login`
- `actionPrefix`: one of `auth`, `security`, `admin`, `money`, `wallet`, `recipient`
- `status`: `SUCCESS` or `FAILURE`
- `resourceType`: exact resource type, such as `http_request`
- `dateFrom`, `dateTo`: ISO datetime bounds
- `sortBy`: `created_at`, `action`, `status`, `user_id`, `ip_address`, or `resource_type`
- `sortDir`: `asc` or `desc`

The response includes `total` for pagination and actor fields when the audit row maps to a known user.

## Standard Error Shape

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Request validation failed",
    "details": [
      {
        "path": "amount",
        "message": "Amount must be greater than zero"
      }
    ]
  }
}
```
