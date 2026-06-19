const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '..', '..', '.env') });
dotenv.config();

function bool(value, fallback = false) {
  if (value === undefined || value === null || value === '') return fallback;
  return ['1', 'true', 'yes', 'on'].includes(String(value).toLowerCase());
}

function int(value, fallback) {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function list(value, fallback = []) {
  if (!value) return fallback;
  return String(value)
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

function decodedSecretLength(value) {
  if (/^[a-f0-9]{64}$/i.test(value)) return Buffer.from(value, 'hex').length;
  return Buffer.from(value || '', 'base64').length;
}

const env = {
  nodeEnv: process.env.NODE_ENV || 'development',
  host: process.env.HOST || '127.0.0.1',
  port: int(process.env.PORT, 5000),
  corsOrigins: list(process.env.CORS_ORIGIN, [
    'http://localhost:5173',
    'http://127.0.0.1:5173'
  ]),
  trustProxy: bool(process.env.TRUST_PROXY, false),
  maxBodyBytes: process.env.MAX_BODY_BYTES || '200kb',
  exposeManualTester: bool(process.env.EXPOSE_MANUAL_TESTER, false),
  allowLoopbackCors: bool(process.env.ALLOW_LOOPBACK_CORS, false),

  db: {
    host: process.env.DB_HOST || 'localhost',
    port: int(process.env.DB_PORT, 3306),
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'sitwallet',
    connectionLimit: int(process.env.DB_CONNECTION_LIMIT, 10)
  },

  jwt: {
    secret: process.env.JWT_SECRET || '',
    issuer: process.env.JWT_ISSUER || 'sitwallet-api',
    audience: process.env.JWT_AUDIENCE || 'sitwallet-web',
    accessTtl: process.env.ACCESS_TOKEN_TTL || '15m',
    refreshTtlDays: int(process.env.REFRESH_TOKEN_TTL_DAYS, 7)
  },

  security: {
    bcryptRounds: int(process.env.BCRYPT_ROUNDS, 12),
    encryptionKey: process.env.APP_ENCRYPTION_KEY || '',
    csrfEnabled: bool(process.env.CSRF_ENABLED, true),
    csrfCookieName: process.env.CSRF_COOKIE_NAME || 'sitwallet_csrf',
    cookieSecure: bool(process.env.COOKIE_SECURE, false),
    cookieDomain: process.env.COOKIE_DOMAIN || undefined,
    totpIssuer: process.env.TOTP_ISSUER || 'SITWallet'
  }
};

function assertRuntimeSecrets() {
  if (env.nodeEnv === 'test') return;

  if (!env.jwt.secret || env.jwt.secret.length < 32) {
    throw new Error('JWT_SECRET must be set to at least 32 characters.');
  }

  if (!env.security.encryptionKey) {
    throw new Error('APP_ENCRYPTION_KEY must be set. See .env.example.');
  }

  if (decodedSecretLength(env.security.encryptionKey) !== 32) {
    throw new Error('APP_ENCRYPTION_KEY must be a 32-byte base64 or 64-character hex value.');
  }
}

module.exports = { env, assertRuntimeSecrets };
