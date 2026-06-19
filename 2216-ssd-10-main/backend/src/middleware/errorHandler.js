const { AppError, mapSqlError } = require('../utils/errors');
const { audit } = require('../utils/audit');
const logger = require('../utils/logger');

function notFound(req, _res, next) {
  next(new AppError(404, `Route not found: ${req.method} ${req.originalUrl}`, 'ROUTE_NOT_FOUND'));
}

function shouldAuditFailure(req, status, code) {
  if (status === 401 || status === 403 || status === 404 || status === 429) return true;
  if (code === 'VALIDATION_ERROR' && /^\/api\/(auth|admin|transfer|exchange|top-up)/.test(req.originalUrl)) return true;
  return false;
}

function auditFailure(req, mapped, status) {
  const code = mapped.code || 'INTERNAL_ERROR';
  if (!shouldAuditFailure(req, status, code)) return;

  audit(req, {
    action: `security.${String(code).toLowerCase()}`,
    resourceType: 'http_request',
    resourceId: `${req.method} ${req.originalUrl}`,
    status: 'FAILURE',
    metadata: {
      method: req.method,
      path: req.originalUrl,
      status,
      code,
      message: mapped.message,
      details: mapped.details || null
    }
  });
}

function errorHandler(err, req, res, _next) {
  const mapped = mapSqlError(err);
  const status = mapped.status || 500;
  const exposeMessage = mapped instanceof AppError || status < 500;
  const payload = {
    error: {
      code: mapped.code || 'INTERNAL_ERROR',
      message: exposeMessage ? mapped.message : 'Internal server error'
    }
  };

  if (mapped.details) payload.error.details = mapped.details;

  if (status >= 500) {
    logger.error('request_failed', {
      message: mapped.message,
      stack: mapped.stack,
      code: mapped.code,
      sqlState: mapped.sqlState
    });
  }

  auditFailure(req, mapped, status);

  res.status(status).json(payload);
}

module.exports = { notFound, errorHandler };
