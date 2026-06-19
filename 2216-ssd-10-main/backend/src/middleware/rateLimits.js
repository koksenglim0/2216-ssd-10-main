const rateLimit = require('express-rate-limit');
const { audit } = require('../utils/audit');

function rateLimitHandler(action, message, code) {
  return (req, res, _next, options) => {
    audit(req, {
      action,
      resourceType: 'http_request',
      resourceId: `${req.method} ${req.originalUrl}`,
      status: 'FAILURE',
      metadata: {
        method: req.method,
        path: req.originalUrl,
        code,
        limit: options.limit,
        windowMs: options.windowMs
      }
    });

    res.status(options.statusCode).json({
      error: {
        code,
        message
      }
    });
  };
}

const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 300,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  handler: rateLimitHandler('security.rate_limit.global', 'Too many requests, please try again later.', 'RATE_LIMITED')
});

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  handler: rateLimitHandler('security.rate_limit.auth', 'Too many authentication attempts, please try again later.', 'AUTH_RATE_LIMITED')
});

const moneyMovementLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 30,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  handler: rateLimitHandler('security.rate_limit.money', 'Too many money movement requests, please slow down.', 'MONEY_RATE_LIMITED')
});

module.exports = { globalLimiter, authLimiter, moneyMovementLimiter };
