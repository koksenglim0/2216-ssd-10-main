const qrcode = require('qrcode');
const { authenticator } = require('otplib');
const { env } = require('../config/env');

authenticator.options = {
  step: 30,
  window: 1
};

async function createTotpSetup(email) {
  const secret = authenticator.generateSecret();
  const otpauthUrl = authenticator.keyuri(email, env.security.totpIssuer, secret);
  const qrCodeDataUrl = await qrcode.toDataURL(otpauthUrl);

  return { secret, otpauthUrl, qrCodeDataUrl };
}

function verifyTotpCode(secret, token) {
  if (!token || !/^\d{6}$/.test(String(token))) return false;
  return authenticator.verify({
    token: String(token),
    secret
  });
}

module.exports = { createTotpSetup, verifyTotpCode };
