const { query } = require('../config/db');
const { AppError } = require('../utils/errors');
const { verifyJwt } = require('../utils/tokens');

async function requireAuth(req, _res, next) {
  try {
    const header = req.get('authorization') || '';
    const match = header.match(/^Bearer\s+(.+)$/i);

    if (!match) {
      throw new AppError(401, 'Missing bearer token', 'UNAUTHENTICATED');
    }

    const payload = verifyJwt(match[1]);
    if (payload.type !== 'access') {
      throw new AppError(401, 'Invalid token type', 'UNAUTHENTICATED');
    }

    const rows = await query(
      `SELECT user_id, full_name, email, role_name, status, primary_currency
       FROM users
       WHERE user_id = ?`,
      [payload.sub]
    );

    const user = rows[0];
    if (!user || user.status !== 'active') {
      throw new AppError(401, 'Account is not active', 'UNAUTHENTICATED');
    }

    req.user = {
      userId: user.user_id,
      fullName: user.full_name,
      email: user.email,
      role: user.role_name,
      primaryCurrency: user.primary_currency
    };

    return next();
  } catch (err) {
    return next(err);
  }
}

function requireRoles(...allowedRoles) {
  return (req, _res, next) => {
    if (!req.user) return next(new AppError(401, 'Authentication required', 'UNAUTHENTICATED'));
    if (!allowedRoles.includes(req.user.role)) {
      return next(new AppError(403, 'Insufficient role permission', 'FORBIDDEN'));
    }
    return next();
  };
}

module.exports = { requireAuth, requireRoles };
