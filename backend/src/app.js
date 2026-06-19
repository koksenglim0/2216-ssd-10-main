const path = require('path');
const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const { env } = require('./config/env');
const { pool } = require('./config/db');
const { globalLimiter } = require('./middleware/rateLimits');
const { issueCsrfToken, csrfProtection } = require('./middleware/csrf');
const { notFound, errorHandler } = require('./middleware/errorHandler');

const authRoutes = require('./routes/auth.routes');
const walletRoutes = require('./routes/wallet.routes');
const dashboardRoutes = require('./routes/dashboard.routes');
const marketRoutes = require('./routes/market.routes');
const topUpRoutes = require('./routes/topup.routes');
const exchangeRoutes = require('./routes/exchange.routes');
const transferRoutes = require('./routes/transfer.routes');
const historyRoutes = require('./routes/history.routes');
const adminRoutes = require('./routes/admin.routes');

function normalizeOrigin(origin) {
  if (!origin) return '';
  if (origin === 'null') return 'null';

  try {
    const parsed = new URL(origin);
    return `${parsed.protocol}//${parsed.host}`;
  } catch {
    return String(origin).replace(/\/+$/, '');
  }
}

function isConfiguredCorsOrigin(origin) {
  const normalizedOrigin = normalizeOrigin(origin);
  return env.corsOrigins.some((allowedOrigin) => normalizeOrigin(allowedOrigin) === normalizedOrigin);
}

function isLoopbackOrigin(origin) {
  if (env.nodeEnv === 'production' || !env.allowLoopbackCors) return false;
  if (origin === 'null') return true;

  try {
    const parsed = new URL(origin);
    const hostname = parsed.hostname.replace(/^\[|\]$/g, '').toLowerCase();
    return ['http:', 'https:'].includes(parsed.protocol)
      && (
        hostname === 'localhost'
        || hostname === '127.0.0.1'
        || hostname === '::1'
        || hostname.endsWith('.localhost')
      );
  } catch {
    return false;
  }
}

function isAllowedCorsOrigin(origin) {
  return !origin || isConfiguredCorsOrigin(origin) || isLoopbackOrigin(origin);
}

function createApp() {
  const app = express();

  app.set('trust proxy', env.trustProxy);

  app.use(helmet({
    crossOriginResourcePolicy: { policy: 'same-site' },
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'"],
        styleSrc: ["'self'"],
        imgSrc: ["'self'", 'data:'],
        connectSrc: ["'self'"],
        objectSrc: ["'none'"],
        baseUri: ["'self'"],
        frameAncestors: ["'none'"]
      }
    }
  }));

  app.use(cors({
    origin(origin, callback) {
      if (isAllowedCorsOrigin(origin)) return callback(null, true);
      return callback(null, false);
    },
    credentials: true
  }));

  app.use(cookieParser());
  app.use(express.json({ limit: env.maxBodyBytes }));
  app.use(globalLimiter);

  if (env.exposeManualTester) {
    app.use(express.static(path.join(__dirname, '..', 'public')));
  }

  app.get('/api/health', async (_req, res) => {
    try {
      await pool.query('SELECT 1');
      res.json({ status: 'ok', database: 'connected' });
    } catch {
      res.status(503).json({ status: 'error', database: 'unreachable' });
    }
  });

  app.get('/api/security/csrf-token', issueCsrfToken);

  app.use(csrfProtection);

  app.use('/api/auth', authRoutes);
  app.use('/api/wallets', walletRoutes);
  app.use('/api/dashboard', dashboardRoutes);
  app.use('/api/market', marketRoutes);
  app.use('/api/top-up', topUpRoutes);
  app.use('/api/exchange', exchangeRoutes);
  app.use('/api/transfer', transferRoutes);
  app.use('/api/history', historyRoutes);
  app.use('/api/admin', adminRoutes);

  app.use(notFound);
  app.use(errorHandler);

  return app;
}

module.exports = { createApp, isAllowedCorsOrigin, isLoopbackOrigin };
