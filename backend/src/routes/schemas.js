const { z } = require('zod');
const Decimal = require('decimal.js');

const uuid = z.string().uuid();

const email = z.string()
  .trim()
  .email()
  .max(255)
  .transform((value) => value.toLowerCase());

const currency = z.string()
  .trim()
  .regex(/^[A-Za-z]{3}$/, 'Currency must be a 3-letter ISO code')
  .transform((value) => value.toUpperCase());

const amount = z.union([z.string(), z.number()])
  .transform((value) => String(value).trim())
  .refine((value) => /^\d+(\.\d{1,8})?$/.test(value), 'Amount must be a positive decimal with up to 8 decimal places')
  .refine((value) => new Decimal(value).gt(0), 'Amount must be greater than zero');

const optionalDescription = z.string().trim().max(500).optional().default('');

const pagination = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(25),
  type: z.enum(['TOP_UP', 'TRANSFER', 'EXCHANGE']).optional(),
  currency: currency.optional()
});

const registerStart = z.object({
  fullName: z.string().trim().min(2).max(120),
  email
});

const registerVerifySetup = z.object({
  registrationId: uuid,
  phoneNumber: z.string().trim().min(8).max(32)
});

const registerVerify = z.object({
  registrationId: uuid,
  code: z.string().regex(/^\d{6}$/, 'TOTP code must be 6 digits')
});

const registerPassword = z.object({
  registrationId: uuid,
  password: z.string().min(12).max(128)
    .regex(/[a-z]/, 'Password must contain a lowercase letter')
    .regex(/[A-Z]/, 'Password must contain an uppercase letter')
    .regex(/[0-9]/, 'Password must contain a number')
    .regex(/[^A-Za-z0-9]/, 'Password must contain a symbol'),
  confirmPassword: z.string(),
  primaryCurrency: currency,
  termsAccepted: z.literal(true)
}).refine((body) => body.password === body.confirmPassword, {
  path: ['confirmPassword'],
  message: 'Passwords do not match'
});

const login = z.object({
  email,
  password: z.string().min(1).max(128)
});

const loginVerify = z.object({
  loginChallengeId: uuid,
  code: z.string().regex(/^\d{6}$/, 'TOTP code must be 6 digits')
});

const walletCreate = z.object({
  currency
});

const quoteQuery = z.object({
  fromCurrency: currency,
  toCurrency: currency,
  amount
});

const topUpQuoteQuery = z.object({
  currency,
  amount
});

const topUp = z.object({
  currency,
  amount,
  description: optionalDescription
});

const addRecipient = z.object({
  recipientEmail: email,
  nickname: z.string().trim().max(120).optional().default('')
});

const transferReview = z.object({
  recipientId: uuid,
  fromCurrency: currency,
  toCurrency: currency,
  amount,
  description: optionalDescription
});

const transfer = transferReview.extend({
  confirm: z.literal(true)
});

const exchange = z.object({
  fromCurrency: currency,
  toCurrency: currency,
  amount
});

const rateUpdate = z.object({
  rate: amount,
  high24h: amount.optional(),
  low24h: amount.optional(),
  change24hPct: z.union([z.string(), z.number()])
    .transform((value) => String(value).trim())
    .refine((value) => /^-?\d+(\.\d{1,4})?$/.test(value), '24h change must be a decimal with up to 4 decimal places')
    .optional()
}).refine((body) => {
  if (!body.high24h || !body.low24h) return true;
  return new Decimal(body.high24h).gte(body.low24h);
}, {
  path: ['high24h'],
  message: '24h high must be greater than or equal to 24h low'
});

const settingUpdate = z.object({
  settingValue: amount
});

const userStatusUpdate = z.object({
  status: z.enum(['active', 'suspended', 'closed']),
  roleName: z.enum(['customer', 'support', 'admin']).optional()
});

const userListQuery = z.object({
  status: z.enum([
    'registration_started',
    'mfa_pending',
    'password_pending',
    'active',
    'suspended',
    'closed'
  ]).optional()
});

module.exports = {
  uuid,
  currency,
  amount,
  pagination,
  registerStart,
  registerVerifySetup,
  registerVerify,
  registerPassword,
  login,
  loginVerify,
  walletCreate,
  quoteQuery,
  topUpQuoteQuery,
  topUp,
  addRecipient,
  transferReview,
  transfer,
  exchange,
  rateUpdate,
  settingUpdate,
  userStatusUpdate,
  userListQuery
};
