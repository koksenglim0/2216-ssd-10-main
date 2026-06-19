const { Router } = require('express');
const { validate } = require('../middleware/validate');
const { requireAuth } = require('../middleware/auth');
const { asyncHandler } = require('../utils/errors');
const schemas = require('./schemas');
const walletService = require('../services/walletService');
const { audit } = require('../utils/audit');

const router = Router();

router.use(requireAuth);

router.get('/', asyncHandler(async (req, res) => {
  res.json({ wallets: await walletService.listWallets(req.user.userId) });
}));

router.post('/', validate(schemas.walletCreate), asyncHandler(async (req, res) => {
  const wallet = await walletService.createWallet(req.user.userId, req.body.currency);
  await audit(req, {
    action: 'wallet.create',
    resourceType: 'wallet',
    resourceId: wallet.wallet_id,
    metadata: { currency: req.body.currency }
  });
  res.status(201).json(wallet);
}));

module.exports = router;
