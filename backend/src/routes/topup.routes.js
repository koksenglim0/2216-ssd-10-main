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

router.get('/quote', validate(schemas.topUpQuoteQuery, 'query'), asyncHandler(async (req, res) => {
  res.json({ quote: await walletService.topUpQuote(req.query.currency, req.query.amount) });
}));

router.post('/', moneyMovementLimiter, validate(schemas.topUp), asyncHandler(async (req, res) => {
  const transaction = await walletService.performTopUp(req.user.userId, req.body);
  await audit(req, {
    action: 'money.top_up',
    resourceType: 'transaction',
    resourceId: transaction.transaction_id,
    metadata: transaction
  });
  res.status(201).json({ transaction });
}));

module.exports = router;
