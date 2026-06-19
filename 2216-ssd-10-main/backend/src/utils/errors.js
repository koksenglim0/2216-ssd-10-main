class AppError extends Error {
  constructor(status, message, code = 'APP_ERROR', details = undefined) {
    super(message);
    this.name = 'AppError';
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

function mapSqlError(err) {
  if (err && [
    'ECONNREFUSED',
    'PROTOCOL_CONNECTION_LOST',
    'ER_ACCESS_DENIED_ERROR',
    'ER_BAD_DB_ERROR',
    'ENOTFOUND',
    'ETIMEDOUT'
  ].includes(err.code)) {
    return new AppError(503, 'Database is unavailable or misconfigured', 'DATABASE_UNAVAILABLE');
  }

  if (!err || err.sqlState !== '45000') return err;

  const message = err.sqlMessage || err.message || 'Database validation failed';
  const lower = message.toLowerCase();

  if (lower.includes('not found')) return new AppError(404, message, 'NOT_FOUND');
  if (lower.includes('insufficient funds')) return new AppError(409, message, 'INSUFFICIENT_FUNDS');
  if (lower.includes('limit exceeded')) return new AppError(409, message, 'LIMIT_EXCEEDED');
  if (lower.includes('already') || lower.includes('duplicate')) return new AppError(409, message, 'CONFLICT');
  if (lower.includes('admin')) return new AppError(403, message, 'FORBIDDEN');

  return new AppError(422, message, 'VALIDATION_ERROR');
}

function asyncHandler(handler) {
  return (req, res, next) => {
    Promise.resolve(handler(req, res, next)).catch(next);
  };
}

module.exports = { AppError, mapSqlError, asyncHandler };
