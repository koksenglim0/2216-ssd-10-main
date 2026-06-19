const crypto = require('crypto');
const bcrypt = require('bcrypt');
const { env } = require('../config/env');
const { AppError } = require('./errors');

function getEncryptionKey() {
  const value = env.security.encryptionKey;
  let key;

  if (/^[a-f0-9]{64}$/i.test(value)) {
    key = Buffer.from(value, 'hex');
  } else {
    key = Buffer.from(value, 'base64');
  }

  if (key.length !== 32) {
    throw new AppError(500, 'APP_ENCRYPTION_KEY must decode to exactly 32 bytes.', 'CONFIG_ERROR');
  }

  return key;
}

async function hashPassword(password) {
  return bcrypt.hash(password, env.security.bcryptRounds);
}

async function verifyPassword(password, hash) {
  if (!hash) return false;
  return bcrypt.compare(password, hash);
}

function encryptText(plaintext) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', getEncryptionKey(), iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();

  return {
    ciphertext: ciphertext.toString('base64'),
    iv: iv.toString('base64'),
    tag: tag.toString('base64')
  };
}

function decryptText({ ciphertext, iv, tag }) {
  const decipher = crypto.createDecipheriv(
    'aes-256-gcm',
    getEncryptionKey(),
    Buffer.from(iv, 'base64')
  );
  decipher.setAuthTag(Buffer.from(tag, 'base64'));
  const plaintext = Buffer.concat([
    decipher.update(Buffer.from(ciphertext, 'base64')),
    decipher.final()
  ]);
  return plaintext.toString('utf8');
}

function randomReference(prefix) {
  const stamp = Date.now().toString(36).toUpperCase();
  const random = crypto.randomBytes(5).toString('hex').toUpperCase();
  return `${prefix}-${stamp}-${random}`;
}

function sha256(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

module.exports = {
  hashPassword,
  verifyPassword,
  encryptText,
  decryptText,
  randomReference,
  sha256
};
