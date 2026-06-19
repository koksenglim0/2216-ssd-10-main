const { Router } = require('express');
const { requireAuth } = require('../middleware/auth');
const { asyncHandler } = require('../utils/errors');
const walletService = require('../services/walletService');

const router = Router();

router.get('/', requireAuth, asyncHandler(async (req, res) => {
  res.json(await walletService.getDashboard(req.user.userId));
}));

module.exports = router;
