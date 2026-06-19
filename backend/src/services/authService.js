const crypto = require('crypto');
const { query, callProcedure } = require('../config/db');
const { AppError } = require('../utils/errors');
const { hashPassword, verifyPassword, encryptText, decryptText, sha256 } = require('../utils/crypto');
const { createTotpSetup, verifyTotpCode } = require('../utils/totp');
const {
  createAccessToken,
  createRefreshToken,
  verifyJwt
} = require('../utils/tokens');

function publicUser(user) {
  return {
    userId: user.user_id,
    fullName: user.full_name,
    email: user.email,
    role: user.role_name,
    primaryCurrency: user.primary_currency
  };
}

async function startRegistration({ fullName, email }) {
  const userId = crypto.randomUUID();

  try {
    await query(
      `INSERT INTO users (user_id, full_name, email, status)
       VALUES (?, ?, ?, 'registration_started')`,
      [userId, fullName, email]
    );
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') {
      throw new AppError(409, 'Email is already registered', 'EMAIL_EXISTS');
    }
    throw err;
  }

  return {
    registrationId: userId,
    nextStep: 'register-verify'
  };
}

async function setupRegistrationMfa({ registrationId, phoneNumber }) {
  const users = await query(
    `SELECT user_id, email, status
     FROM users
     WHERE user_id = ?`,
    [registrationId]
  );
  const user = users[0];

  if (!user) throw new AppError(404, 'Registration not found', 'NOT_FOUND');
  if (!['registration_started', 'mfa_pending'].includes(user.status)) {
    throw new AppError(409, 'Registration is not in MFA setup step', 'INVALID_REGISTRATION_STEP');
  }

  const setup = await createTotpSetup(user.email);
  const encrypted = encryptText(setup.secret);

  try {
    await query(
      `UPDATE users
       SET phone_number = ?,
           totp_secret_ciphertext = ?,
           totp_secret_iv = ?,
           totp_secret_tag = ?,
           status = 'mfa_pending',
           updated_at = CURRENT_TIMESTAMP
       WHERE user_id = ?`,
      [phoneNumber, encrypted.ciphertext, encrypted.iv, encrypted.tag, registrationId]
    );
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') {
      throw new AppError(409, 'Phone number is already registered', 'PHONE_EXISTS');
    }
    throw err;
  }

  return {
    registrationId,
    otpauthUrl: setup.otpauthUrl,
    qrCodeDataUrl: setup.qrCodeDataUrl,
    nextStep: 'register-verify-code'
  };
}

async function verifyRegistrationMfa({ registrationId, code }) {
  const users = await query(
    `SELECT user_id, status, totp_secret_ciphertext, totp_secret_iv, totp_secret_tag
     FROM users
     WHERE user_id = ?`,
    [registrationId]
  );
  const user = users[0];

  if (!user) throw new AppError(404, 'Registration not found', 'NOT_FOUND');
  if (user.status !== 'mfa_pending') {
    throw new AppError(409, 'Registration is not in MFA verification step', 'INVALID_REGISTRATION_STEP');
  }

  const secret = decryptText({
    ciphertext: user.totp_secret_ciphertext,
    iv: user.totp_secret_iv,
    tag: user.totp_secret_tag
  });

  if (!verifyTotpCode(secret, code)) {
    throw new AppError(401, 'Invalid MFA code', 'INVALID_MFA_CODE');
  }

  await query(
    `UPDATE users
     SET mfa_enabled = 1,
         status = 'password_pending',
         updated_at = CURRENT_TIMESTAMP
     WHERE user_id = ?`,
    [registrationId]
  );

  return {
    registrationId,
    nextStep: 'register-password'
  };
}

async function finalizeRegistration({ registrationId, password, primaryCurrency, termsAccepted }) {
  const passwordHash = await hashPassword(password);
  const rows = await callProcedure('sp_finalize_registration', [
    registrationId,
    passwordHash,
    primaryCurrency,
    termsAccepted ? 1 : 0
  ]);

  return rows[0];
}

async function createLoginChallenge({ email, password, ip }) {
  const rows = await query(
    `SELECT user_id, full_name, email, password_hash, role_name, status, locked_until,
            failed_login_count, mfa_enabled
     FROM users
     WHERE email = ?`,
    [email]
  );
  const user = rows[0];
  const invalid = new AppError(401, 'Invalid email or password', 'INVALID_CREDENTIALS');

  if (!user || user.status !== 'active') throw invalid;
  if (user.locked_until && new Date(user.locked_until).getTime() > Date.now()) {
    throw new AppError(423, 'Account is temporarily locked', 'ACCOUNT_LOCKED');
  }

  const passwordOk = await verifyPassword(password, user.password_hash);
  if (!passwordOk) {
    const failedCount = Number(user.failed_login_count || 0) + 1;
    const lockSql = failedCount >= 5
      ? ', locked_until = DATE_ADD(UTC_TIMESTAMP(), INTERVAL 15 MINUTE)'
      : '';

    await query(
      `UPDATE users
       SET failed_login_count = ? ${lockSql}
       WHERE user_id = ?`,
      [failedCount, user.user_id]
    );
    throw invalid;
  }

  await query(
    `UPDATE users
     SET failed_login_count = 0, locked_until = NULL
     WHERE user_id = ?`,
    [user.user_id]
  );

  const challengeId = crypto.randomUUID();
  await query(
    `INSERT INTO login_challenges (challenge_id, user_id, expires_at, created_ip)
     VALUES (?, ?, DATE_ADD(UTC_TIMESTAMP(), INTERVAL 5 MINUTE), ?)`,
    [challengeId, user.user_id, ip || null]
  );

  return {
    loginChallengeId: challengeId,
    expiresInSeconds: 300,
    mfaRequired: true
  };
}

async function verifyLoginChallenge({ loginChallengeId, code }) {
  const rows = await query(
    `SELECT lc.challenge_id, lc.user_id, lc.expires_at, lc.consumed_at,
            u.full_name, u.email, u.role_name, u.status, u.primary_currency,
            u.totp_secret_ciphertext, u.totp_secret_iv, u.totp_secret_tag, u.mfa_enabled
     FROM login_challenges lc
     JOIN users u ON u.user_id = lc.user_id
     WHERE lc.challenge_id = ?`,
    [loginChallengeId]
  );
  const record = rows[0];

  if (!record) throw new AppError(404, 'Login challenge not found', 'NOT_FOUND');
  if (record.status !== 'active') throw new AppError(401, 'Account is not active', 'UNAUTHENTICATED');
  if (record.consumed_at) throw new AppError(409, 'Login challenge already used', 'CHALLENGE_USED');
  if (new Date(record.expires_at).getTime() < Date.now()) {
    throw new AppError(401, 'Login challenge expired', 'CHALLENGE_EXPIRED');
  }
  if (!record.mfa_enabled) throw new AppError(403, 'MFA is not enabled for this account', 'MFA_REQUIRED');

  const secret = decryptText({
    ciphertext: record.totp_secret_ciphertext,
    iv: record.totp_secret_iv,
    tag: record.totp_secret_tag
  });

  if (!verifyTotpCode(secret, code)) {
    throw new AppError(401, 'Invalid MFA code', 'INVALID_MFA_CODE');
  }

  const consumeResult = await query(
    `UPDATE login_challenges
     SET consumed_at = UTC_TIMESTAMP()
     WHERE challenge_id = ?
       AND consumed_at IS NULL
       AND expires_at > UTC_TIMESTAMP()`,
    [loginChallengeId]
  );

  if (consumeResult.affectedRows !== 1) {
    throw new AppError(409, 'Login challenge was already used or expired', 'CHALLENGE_NOT_CONSUMED');
  }

  await query(
    `UPDATE users
     SET last_login_at = UTC_TIMESTAMP()
     WHERE user_id = ?`,
    [record.user_id]
  );

  const user = {
    user_id: record.user_id,
    full_name: record.full_name,
    email: record.email,
    role_name: record.role_name,
    primary_currency: record.primary_currency
  };

  return {
    accessToken: createAccessToken(user),
    refreshToken: await createRefreshToken(user),
    user: publicUser(user)
  };
}

async function refreshSession(refreshToken) {
  if (!refreshToken) throw new AppError(401, 'Refresh token missing', 'UNAUTHENTICATED');

  const payload = verifyJwt(refreshToken);
  if (payload.type !== 'refresh') throw new AppError(401, 'Invalid refresh token', 'UNAUTHENTICATED');

  const rows = await query(
    `SELECT rt.token_id, rt.user_id, u.full_name, u.email, u.role_name, u.primary_currency, u.status
     FROM refresh_tokens rt
     JOIN users u ON u.user_id = rt.user_id
     WHERE rt.token_hash = ?
       AND rt.revoked_at IS NULL
       AND rt.expires_at > UTC_TIMESTAMP()`,
    [sha256(refreshToken)]
  );
  const record = rows[0];

  if (!record || record.status !== 'active') {
    throw new AppError(401, 'Refresh token is invalid or expired', 'UNAUTHENTICATED');
  }

  const revokeResult = await query(
    `UPDATE refresh_tokens
     SET revoked_at = UTC_TIMESTAMP()
     WHERE token_id = ? AND revoked_at IS NULL`,
    [record.token_id]
  );

  if (revokeResult.affectedRows !== 1) {
    throw new AppError(401, 'Refresh token is invalid or expired', 'UNAUTHENTICATED');
  }

  const user = {
    user_id: record.user_id,
    full_name: record.full_name,
    email: record.email,
    role_name: record.role_name,
    primary_currency: record.primary_currency
  };

  return {
    accessToken: createAccessToken(user),
    refreshToken: await createRefreshToken(user),
    user: publicUser(user)
  };
}

async function revokeRefreshToken(refreshToken) {
  if (!refreshToken) return;
  await query(
    `UPDATE refresh_tokens
     SET revoked_at = UTC_TIMESTAMP()
     WHERE token_hash = ? AND revoked_at IS NULL`,
    [sha256(refreshToken)]
  );
}

module.exports = {
  startRegistration,
  setupRegistrationMfa,
  verifyRegistrationMfa,
  finalizeRegistration,
  createLoginChallenge,
  verifyLoginChallenge,
  refreshSession,
  revokeRefreshToken,
  publicUser
};
