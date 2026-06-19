const { Router } = require('express');
const { validate } = require('../middleware/validate');
const { requireAuth } = require('../middleware/auth');
const schemas = require('./schemas');
const walletService = require('../services/walletService');
const { asyncHandler } = require('../utils/errors');

const router = Router();

router.get('/', requireAuth, validate(schemas.pagination, 'query'), asyncHandler(async (req, res) => {
  res.json(await walletService.getHistory(req.user.userId, req.query));
}));

router.get('/:reference', requireAuth, asyncHandler(async (req, res) => {
  res.json({ transaction: await walletService.getTransactionByReference(req.user.userId, req.params.reference) });
}));

module.exports = router;
