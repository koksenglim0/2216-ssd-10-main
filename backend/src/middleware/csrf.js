const crypto = require('crypto');
const { env } = require('../config/env');
const { AppError } = require('../utils/errors');

function csrfCookieOptions() {
  return {
    httpOnly: false,
    secure: env.security.cookieSecure,
    sameSite: 'strict',
    domain: env.security.cookieDomain,
    path: '/'
  };
}

function issueCsrfToken(_req, res) {
  const token = crypto.randomBytes(32).toString('hex');
  res.cookie(env.security.csrfCookieName, token, csrfCookieOptions());
  res.json({ csrfToken: token });
}

function csrfProtection(req, _res, next) {
  if (!env.security.csrfEnabled) return next();
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) return next();

  const cookieToken = req.cookies?.[env.security.csrfCookieName];
  const headerToken = req.get('x-csrf-token');

  if (!cookieToken || !headerToken || cookieToken !== headerToken) {
    return next(new AppError(403, 'Invalid or missing CSRF token', 'CSRF_INVALID'));
  }

  return next();
}

module.exports = { issueCsrfToken, csrfProtection };
