const { Router } = require('express');
const { z } = require('zod');
const { validate } = require('../middleware/validate');
const { requireAuth, requireRoles } = require('../middleware/auth');
const schemas = require('./schemas');
const walletService = require('../services/walletService');
const { asyncHandler } = require('../utils/errors');
const { audit } = require('../utils/audit');

const router = Router();

const rateParams = z.object({
  fromCurrency: schemas.currency,
  toCurrency: schemas.currency
});

const settingParams = z.object({
  settingKey: z.string().trim().min(1).max(80)
});

const userParams = z.object({
  userId: schemas.uuid
});

const auditQuery = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  userId: schemas.uuid.optional(),
  actor: z.string().trim().max(255).optional(),
  action: z.string().trim().max(80).optional(),
  actionPrefix: z.enum(['auth', 'security', 'admin', 'money', 'wallet', 'recipient']).optional(),
  status: z.enum(['SUCCESS', 'FAILURE']).optional(),
  resourceType: z.string().trim().max(80).optional(),
  ipAddress: z.string().trim().max(45).optional(),
  dateFrom: z.string().datetime().optional(),
  dateTo: z.string().datetime().optional(),
  sortBy: z.enum(['created_at', 'action', 'status', 'user_id', 'ip_address', 'resource_type']).default('created_at'),
  sortDir: z.enum(['asc', 'desc']).default('desc')
});

router.use(requireAuth);

router.get('/settings', requireRoles('admin'), asyncHandler(async (_req, res) => {
  res.json({ settings: await walletService.getPlatformSettings() });
}));

router.put(
  '/settings/:settingKey',
  requireRoles('admin'),
  validate(settingParams, 'params'),
  validate(schemas.settingUpdate),
  asyncHandler(async (req, res) => {
    const setting = await walletService.updatePlatformSetting(
      req.user.userId,
      req.params.settingKey,
      req.body.settingValue
    );
    await audit(req, {
      action: 'admin.setting.update',
      resourceType: 'platform_setting',
      resourceId: req.params.settingKey,
      metadata: setting
    });
    res.json({ setting });
  })
);

router.put(
  '/rates/:fromCurrency/:toCurrency',
  requireRoles('admin'),
  validate(rateParams, 'params'),
  validate(schemas.rateUpdate),
  asyncHandler(async (req, res) => {
    const rate = await walletService.updateExchangeRate(
      req.user.userId,
      req.params.fromCurrency,
      req.params.toCurrency,
      req.body
    );
    await audit(req, {
      action: 'admin.rate.update',
      resourceType: 'exchange_rate',
      resourceId: `${req.params.fromCurrency}-${req.params.toCurrency}`,
      metadata: rate
    });
    res.json({ rate });
  })
);

router.get('/users', requireRoles('admin', 'support'), validate(schemas.userListQuery, 'query'), asyncHandler(async (req, res) => {
  res.json({ users: await walletService.listUsers(req.query) });
}));

router.patch(
  '/users/:userId/status',
  requireRoles('admin'),
  validate(userParams, 'params'),
  validate(schemas.userStatusUpdate),
  asyncHandler(async (req, res) => {
    const user = await walletService.updateUserStatus(req.user.userId, req.params.userId, req.body);
    res.json({ user });
  })
);

router.get('/audit-logs', requireRoles('admin', 'support'), validate(auditQuery, 'query'), asyncHandler(async (req, res) => {
  res.json(await walletService.listAuditLogs(req.query));
}));

module.exports = router;
