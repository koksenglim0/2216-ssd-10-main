const crypto = require('crypto');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
require('dotenv').config();

const { query } = require('../src/config/db');
const { hashPassword, encryptText } = require('../src/utils/crypto');
const { createTotpSetup } = require('../src/utils/totp');

async function main() {
  const fullName = process.env.ADMIN_FULL_NAME || 'SITWallet Admin';
  const email = (process.env.ADMIN_EMAIL || '').trim().toLowerCase();
  const password = process.env.ADMIN_PASSWORD || '';
  const phone = process.env.ADMIN_PHONE || '+6500000000';
  const primaryCurrency = (process.env.ADMIN_PRIMARY_CURRENCY || 'SGD').toUpperCase();

  if (!email || !password) {
    throw new Error('Set ADMIN_EMAIL and ADMIN_PASSWORD in .env before running this script.');
  }

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new Error('ADMIN_EMAIL must be a valid email address.');
  }

  if (!/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{12,128}$/.test(password)) {
    throw new Error('ADMIN_PASSWORD must be 12-128 characters and include upper, lower, number, and symbol characters.');
  }

  if (!/^[A-Z]{3}$/.test(primaryCurrency)) {
    throw new Error('ADMIN_PRIMARY_CURRENCY must be a 3-letter currency code.');
  }

  const passwordHash = await hashPassword(password);
  const setup = await createTotpSetup(email);
  const encrypted = encryptText(setup.secret);
  const userId = crypto.randomUUID();

  await query(
    `INSERT INTO users (
       user_id, full_name, email, phone_number, password_hash,
       totp_secret_ciphertext, totp_secret_iv, totp_secret_tag, mfa_enabled,
       primary_currency, role_name, status, terms_accepted_at
     )
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, ?, 'admin', 'active', UTC_TIMESTAMP())
     ON DUPLICATE KEY UPDATE
       full_name = VALUES(full_name),
       password_hash = VALUES(password_hash),
       totp_secret_ciphertext = VALUES(totp_secret_ciphertext),
       totp_secret_iv = VALUES(totp_secret_iv),
       totp_secret_tag = VALUES(totp_secret_tag),
       mfa_enabled = 1,
       role_name = 'admin',
       status = 'active',
       updated_at = CURRENT_TIMESTAMP`,
    [
      userId,
      fullName,
      email,
      phone,
      passwordHash,
      encrypted.ciphertext,
      encrypted.iv,
      encrypted.tag,
      primaryCurrency
    ]
  );

  const rows = await query('SELECT user_id FROM users WHERE email = ?', [email]);
  await query(
    `INSERT INTO wallets (wallet_id, user_id, currency_code, balance, is_active)
     VALUES (?, ?, ?, 0, 1)
     ON DUPLICATE KEY UPDATE is_active = 1`,
    [crypto.randomUUID(), rows[0].user_id, primaryCurrency]
  );

  console.log('Admin user ready.');
  console.log(`Email: ${email}`);
  console.log(`TOTP otpauth URL: ${setup.otpauthUrl}`);
  console.log(`TOTP QR data URL: ${setup.qrCodeDataUrl}`);
}

main()
  .catch((err) => {
    console.error(err.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    const { closePool } = require('../src/config/db');
    await closePool();
  });
