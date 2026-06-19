const { Router } = require('express');
const { validate } = require('../middleware/validate');
const { requireAuth } = require('../middleware/auth');
const { moneyMovementLimiter } = require('../middleware/rateLimits');
const schemas = require('./schemas');
const walletService = require('../services/walletService');
const { asyncHandler } = require('../utils/errors');
const { audit } = require('../utils/audit');

const router = Router();

router.use(requireAuth);

router.get('/quote', validate(schemas.quoteQuery, 'query'), asyncHandler(async (req, res) => {
  res.json({ quote: await walletService.conversionQuote('exchange', req.query) });
}));

router.post('/', moneyMovementLimiter, validate(schemas.exchange), asyncHandler(async (req, res) => {
  const transaction = await walletService.performExchange(req.user.userId, req.body);
  await audit(req, {
    action: 'money.exchange',
    resourceType: 'transaction',
    resourceId: transaction.transaction_id,
    metadata: transaction
  });
  res.status(201).json({ transaction });
}));

module.exports = router;
