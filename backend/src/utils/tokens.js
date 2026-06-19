const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const { env } = require('../config/env');
const { query } = require('../config/db');
const { sha256 } = require('./crypto');
const { AppError } = require('./errors');

function createAccessToken(user) {
  return jwt.sign(
    {
      sub: user.user_id,
      role: user.role_name,
      type: 'access'
    },
    env.jwt.secret,
    {
      algorithm: 'HS256',
      issuer: env.jwt.issuer,
      audience: env.jwt.audience,
      expiresIn: env.jwt.accessTtl
    }
  );
}

async function createRefreshToken(user) {
  const tokenId = crypto.randomUUID();
  const token = jwt.sign(
    {
      sub: user.user_id,
      role: user.role_name,
      type: 'refresh',
      jti: tokenId
    },
    env.jwt.secret,
    {
      algorithm: 'HS256',
      issuer: env.jwt.issuer,
      audience: env.jwt.audience,
      expiresIn: `${env.jwt.refreshTtlDays}d`
    }
  );

  await query(
    `INSERT INTO refresh_tokens (token_id, user_id, token_hash, expires_at)
     VALUES (?, ?, ?, DATE_ADD(UTC_TIMESTAMP(), INTERVAL ? DAY))`,
    [tokenId, user.user_id, sha256(token), env.jwt.refreshTtlDays]
  );

  return token;
}

function verifyJwt(token) {
  try {
    return jwt.verify(token, env.jwt.secret, {
      algorithms: ['HS256'],
      issuer: env.jwt.issuer,
      audience: env.jwt.audience
    });
  } catch {
    throw new AppError(401, 'Invalid or expired token', 'UNAUTHENTICATED');
  }
}

function refreshCookieOptions() {
  return {
    httpOnly: true,
    secure: env.security.cookieSecure,
    sameSite: 'strict',
    domain: env.security.cookieDomain,
    path: '/api/auth',
    maxAge: env.jwt.refreshTtlDays * 24 * 60 * 60 * 1000
  };
}

function setRefreshCookie(res, token) {
  res.cookie('sitwallet_refresh', token, refreshCookieOptions());
}

function clearRefreshCookie(res) {
  res.clearCookie('sitwallet_refresh', {
    ...refreshCookieOptions(),
    maxAge: undefined
  });
}

module.exports = {
  createAccessToken,
  createRefreshToken,
  verifyJwt,
  setRefreshCookie,
  clearRefreshCookie
};
