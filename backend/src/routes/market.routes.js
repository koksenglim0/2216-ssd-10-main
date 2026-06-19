const { Router } = require('express');
const walletService = require('../services/walletService');
const { asyncHandler } = require('../utils/errors');

const router = Router();

router.get('/', asyncHandler(async (_req, res) => {
  const [currencies, rates] = await Promise.all([
    walletService.listCurrencies(),
    walletService.listExchangeRates()
  ]);
  res.json({ currencies, rates });
}));

router.get('/rates', asyncHandler(async (_req, res) => {
  res.json({ rates: await walletService.listExchangeRates() });
}));

router.get('/currencies', asyncHandler(async (_req, res) => {
  res.json({ currencies: await walletService.listCurrencies() });
}));

module.exports = router;
