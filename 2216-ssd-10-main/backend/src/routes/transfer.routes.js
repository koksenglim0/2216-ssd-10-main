const { Router } = require('express');
const { validate } = require('../middleware/validate');
const { requireAuth } = require('../middleware/auth');
const { moneyMovementLimiter } = require('../middleware/rateLimits');
const schemas = require('./schemas');
const walletService = require('../services/walletService');
const { asyncHandler } = require('../utils/errors');
const transferController = require('../controllers/transferController');

const router = Router();

router.use(requireAuth);

router.get('/quote', validate(schemas.quoteQuery, 'query'), asyncHandler(async (req, res) => {
  res.json({ quote: await walletService.conversionQuote('transfer', req.query) });
}));

router.get('/recipients', asyncHandler(async (req, res) => {
  res.json({ recipients: await walletService.listRecipients(req.user.userId) });
}));

router.post('/recipient', validate(schemas.addRecipient), asyncHandler(transferController.addRecipient));

router.post('/review', validate(schemas.transferReview), asyncHandler(transferController.reviewTransfer));

router.post('/', moneyMovementLimiter, validate(schemas.transfer), asyncHandler(transferController.confirmTransfer));

module.exports = router;
