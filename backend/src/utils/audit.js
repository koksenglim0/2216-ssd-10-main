const { callProcedure } = require('../config/db');
const logger = require('./logger');

async function audit(req, options) {
  try {
    await callProcedure('sp_log_audit', [
      options.userId || req.user?.userId || null,
      options.action,
      options.resourceType || null,
      options.resourceId || null,
      options.status || 'SUCCESS',
      req.ip || null,
      req.get('user-agent') || null,
      JSON.stringify(options.metadata || {})
    ]);
  } catch (err) {
    logger.warn('audit_log_failed', { message: err.message, action: options.action });
  }
}

module.exports = { audit };
