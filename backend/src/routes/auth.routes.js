const { Router } = require('express');
const { validate } = require('../middleware/validate');
const { requireAuth } = require('../middleware/auth');
const { authLimiter } = require('../middleware/rateLimits');
const schemas = require('./schemas');
const authService = require('../services/authService');
const { asyncHandler } = require('../utils/errors');
const { audit } = require('../utils/audit');
const { setRefreshCookie, clearRefreshCookie } = require('../utils/tokens');

const router = Router();

router.post('/register', authLimiter, validate(schemas.registerStart), asyncHandler(async (req, res) => {
  let result;
  try {
    result = await authService.startRegistration(req.body);
  } catch (err) {
    await audit(req, {
      action: 'auth.register.failure',
      resourceType: 'user',
      status: 'FAILURE',
      metadata: { email: req.body.email, code: err.code || null, message: err.message }
    });
    throw err;
  }
  await audit(req, {
    userId: result.registrationId,
    action: 'auth.register.start',
    resourceType: 'user',
    resourceId: result.registrationId
  });
  res.status(201).json(result);
}));

router.post('/register-verify/setup', authLimiter, validate(schemas.registerVerifySetup), asyncHandler(async (req, res) => {
  const result = await authService.setupRegistrationMfa(req.body);
  await audit(req, {
    userId: result.registrationId,
    action: 'auth.register.mfa_setup',
    resourceType: 'user',
    resourceId: result.registrationId
  });
  res.json(result);
}));

router.post('/register-verify', authLimiter, validate(schemas.registerVerify), asyncHandler(async (req, res) => {
  let result;
  try {
    result = await authService.verifyRegistrationMfa(req.body);
  } catch (err) {
    await audit(req, {
      userId: req.body.registrationId,
      action: 'auth.register.mfa_failure',
      resourceType: 'user',
      resourceId: req.body.registrationId,
      status: 'FAILURE',
      metadata: { code: err.code || null, message: err.message }
    });
    throw err;
  }
  await audit(req, {
    userId: result.registrationId,
    action: 'auth.register.mfa_verified',
    resourceType: 'user',
    resourceId: result.registrationId
  });
  res.json(result);
}));

router.post('/register-password', authLimiter, validate(schemas.registerPassword), asyncHandler(async (req, res) => {
  const result = await authService.finalizeRegistration(req.body);
  await audit(req, {
    userId: result.user_id,
    action: 'auth.register.completed',
    resourceType: 'user',
    resourceId: result.user_id
  });
  res.status(201).json({
    message: 'Registration completed',
    registrationSuccess: true,
    userId: result.user_id,
    primaryCurrency: result.primary_currency,
    walletId: result.wallet_id,
    next: {
      addFunds: '/api/top-up',
      dashboard: '/api/dashboard'
    }
  });
}));

router.get('/register-success', (_req, res) => {
  res.json({
    message: 'Registration completed. The frontend can now send users to Add Funds or Dashboard.',
    next: {
      addFunds: '/api/top-up',
      dashboard: '/api/dashboard'
    }
  });
});

router.post('/login', authLimiter, validate(schemas.login), asyncHandler(async (req, res) => {
  let result;
  try {
    result = await authService.createLoginChallenge({
      ...req.body,
      ip: req.ip
    });
  } catch (err) {
    await audit(req, {
      action: 'auth.login.failure',
      resourceType: 'session',
      status: 'FAILURE',
      metadata: { email: req.body.email, code: err.code || null, message: err.message }
    });
    throw err;
  }
  await audit(req, {
    action: 'auth.login.password_ok',
    resourceType: 'login_challenge',
    resourceId: result.loginChallengeId
  });
  res.json(result);
}));

router.post('/login-verify', authLimiter, validate(schemas.loginVerify), asyncHandler(async (req, res) => {
  let result;
  try {
    result = await authService.verifyLoginChallenge(req.body);
  } catch (err) {
    await audit(req, {
      action: 'auth.login.mfa_failure',
      resourceType: 'login_challenge',
      resourceId: req.body.loginChallengeId,
      status: 'FAILURE',
      metadata: { code: err.code || null, message: err.message }
    });
    throw err;
  }
  setRefreshCookie(res, result.refreshToken);
  await audit(req, {
    userId: result.user.userId,
    action: 'auth.login.mfa_verified',
    resourceType: 'user',
    resourceId: result.user.userId
  });
  res.json({
    accessToken: result.accessToken,
    tokenType: 'Bearer',
    user: result.user
  });
}));

router.post('/refresh', asyncHandler(async (req, res) => {
  const token = req.cookies?.sitwallet_refresh || req.body?.refreshToken;
  let result;
  try {
    result = await authService.refreshSession(token);
  } catch (err) {
    await audit(req, {
      action: 'auth.refresh.failure',
      resourceType: 'session',
      status: 'FAILURE',
      metadata: { code: err.code || null, message: err.message }
    });
    throw err;
  }
  setRefreshCookie(res, result.refreshToken);
  res.json({
    accessToken: result.accessToken,
    tokenType: 'Bearer',
    user: result.user
  });
}));

router.post('/logout', asyncHandler(async (req, res) => {
  const token = req.cookies?.sitwallet_refresh || req.body?.refreshToken;
  await authService.revokeRefreshToken(token);
  clearRefreshCookie(res);
  await audit(req, {
    userId: req.user?.userId || null,
    action: 'auth.logout',
    resourceType: 'session'
  });
  res.status(204).end();
}));

router.get('/me', requireAuth, asyncHandler(async (req, res) => {
  res.json({ user: req.user });
}));

module.exports = router;
