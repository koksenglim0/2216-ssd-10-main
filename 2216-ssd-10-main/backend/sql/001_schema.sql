CREATE DATABASE IF NOT EXISTS sitwallet
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE sitwallet;

DROP PROCEDURE IF EXISTS sp_get_dashboard;
DROP PROCEDURE IF EXISTS sp_update_platform_setting;
DROP PROCEDURE IF EXISTS sp_log_audit;
DROP PROCEDURE IF EXISTS sp_transfer;
DROP PROCEDURE IF EXISTS sp_exchange;
DROP PROCEDURE IF EXISTS sp_top_up;
DROP PROCEDURE IF EXISTS sp_add_recipient;
DROP PROCEDURE IF EXISTS sp_finalize_registration;
DROP PROCEDURE IF EXISTS sp_create_wallet;

SET FOREIGN_KEY_CHECKS = 0;
DROP TABLE IF EXISTS audit_logs;
DROP TABLE IF EXISTS refresh_tokens;
DROP TABLE IF EXISTS login_challenges;
DROP TABLE IF EXISTS transactions;
DROP TABLE IF EXISTS recipients;
DROP TABLE IF EXISTS wallets;
DROP TABLE IF EXISTS exchange_rates;
DROP TABLE IF EXISTS platform_settings;
DROP TABLE IF EXISTS currencies;
DROP TABLE IF EXISTS users;
DROP TABLE IF EXISTS roles;
SET FOREIGN_KEY_CHECKS = 1;

CREATE TABLE roles (
  role_name VARCHAR(30) NOT NULL,
  description VARCHAR(255) NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (role_name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE users (
  user_id CHAR(36) NOT NULL,
  full_name VARCHAR(120) NOT NULL,
  email VARCHAR(255) NOT NULL,
  phone_number VARCHAR(32) NULL,
  password_hash VARCHAR(255) NULL,
  totp_secret_ciphertext TEXT NULL,
  totp_secret_iv VARCHAR(32) NULL,
  totp_secret_tag VARCHAR(32) NULL,
  mfa_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  primary_currency CHAR(3) NULL,
  role_name VARCHAR(30) NOT NULL DEFAULT 'customer',
  status ENUM('registration_started','mfa_pending','password_pending','active','suspended','closed') NOT NULL DEFAULT 'registration_started',
  failed_login_count INT NOT NULL DEFAULT 0,
  locked_until DATETIME NULL,
  terms_accepted_at DATETIME NULL,
  last_login_at DATETIME NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (user_id),
  UNIQUE KEY uq_users_email (email),
  UNIQUE KEY uq_users_phone (phone_number),
  KEY idx_users_status (status),
  KEY idx_users_role (role_name),
  CONSTRAINT fk_users_role
    FOREIGN KEY (role_name) REFERENCES roles(role_name)
    ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE currencies (
  currency_code CHAR(3) NOT NULL,
  currency_name VARCHAR(80) NOT NULL,
  symbol VARCHAR(8) NOT NULL,
  decimal_places TINYINT NOT NULL DEFAULT 2,
  rate_to_usd DECIMAL(20,10) NOT NULL,
  high_24h_to_usd DECIMAL(20,10) NOT NULL,
  low_24h_to_usd DECIMAL(20,10) NOT NULL,
  change_24h_pct DECIMAL(10,4) NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (currency_code),
  CONSTRAINT chk_currencies_rate_positive CHECK (rate_to_usd > 0),
  CONSTRAINT chk_currencies_high_positive CHECK (high_24h_to_usd > 0),
  CONSTRAINT chk_currencies_low_positive CHECK (low_24h_to_usd > 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE platform_settings (
  setting_key VARCHAR(80) NOT NULL,
  setting_value DECIMAL(20,8) NOT NULL,
  setting_unit ENUM('percent','amount','boolean') NOT NULL,
  description VARCHAR(255) NOT NULL,
  updated_by CHAR(36) NULL,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (setting_key),
  CONSTRAINT fk_platform_settings_admin
    FOREIGN KEY (updated_by) REFERENCES users(user_id)
    ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT chk_platform_settings_value_non_negative CHECK (setting_value >= 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE exchange_rates (
  rate_id BIGINT NOT NULL AUTO_INCREMENT,
  from_currency CHAR(3) NOT NULL,
  to_currency CHAR(3) NOT NULL,
  rate DECIMAL(20,10) NOT NULL,
  high_24h DECIMAL(20,10) NOT NULL,
  low_24h DECIMAL(20,10) NOT NULL,
  change_24h_pct DECIMAL(10,4) NOT NULL DEFAULT 0,
  source VARCHAR(60) NOT NULL DEFAULT 'seed',
  updated_by CHAR(36) NULL,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (rate_id),
  UNIQUE KEY uq_exchange_pair (from_currency, to_currency),
  KEY idx_exchange_to_currency (to_currency),
  CONSTRAINT fk_exchange_from_currency
    FOREIGN KEY (from_currency) REFERENCES currencies(currency_code)
    ON UPDATE CASCADE,
  CONSTRAINT fk_exchange_to_currency
    FOREIGN KEY (to_currency) REFERENCES currencies(currency_code)
    ON UPDATE CASCADE,
  CONSTRAINT fk_exchange_updated_by
    FOREIGN KEY (updated_by) REFERENCES users(user_id)
    ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT chk_exchange_rate_positive CHECK (rate > 0),
  CONSTRAINT chk_exchange_high_positive CHECK (high_24h > 0),
  CONSTRAINT chk_exchange_low_positive CHECK (low_24h > 0),
  CONSTRAINT chk_exchange_different_currency CHECK (from_currency <> to_currency)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE wallets (
  wallet_id CHAR(36) NOT NULL,
  user_id CHAR(36) NOT NULL,
  currency_code CHAR(3) NOT NULL,
  balance DECIMAL(20,8) NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (wallet_id),
  UNIQUE KEY uq_wallet_user_currency (user_id, currency_code),
  KEY idx_wallets_currency (currency_code),
  CONSTRAINT fk_wallets_user
    FOREIGN KEY (user_id) REFERENCES users(user_id)
    ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT fk_wallets_currency
    FOREIGN KEY (currency_code) REFERENCES currencies(currency_code)
    ON UPDATE CASCADE,
  CONSTRAINT chk_wallets_balance_non_negative CHECK (balance >= 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE recipients (
  recipient_id CHAR(36) NOT NULL,
  owner_user_id CHAR(36) NOT NULL,
  recipient_user_id CHAR(36) NOT NULL,
  nickname VARCHAR(120) NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (recipient_id),
  UNIQUE KEY uq_recipient_owner_user (owner_user_id, recipient_user_id),
  KEY idx_recipients_recipient_user (recipient_user_id),
  CONSTRAINT fk_recipients_owner
    FOREIGN KEY (owner_user_id) REFERENCES users(user_id)
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT fk_recipients_recipient
    FOREIGN KEY (recipient_user_id) REFERENCES users(user_id)
    ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT chk_recipient_not_self CHECK (owner_user_id <> recipient_user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE transactions (
  transaction_id CHAR(36) NOT NULL,
  reference VARCHAR(40) NOT NULL,
  transaction_type ENUM('TOP_UP','TRANSFER','EXCHANGE') NOT NULL,
  status ENUM('PENDING','COMPLETED','FAILED','REVERSED') NOT NULL DEFAULT 'COMPLETED',
  initiated_by_user_id CHAR(36) NOT NULL,
  sender_user_id CHAR(36) NULL,
  recipient_user_id CHAR(36) NULL,
  debit_wallet_id CHAR(36) NULL,
  credit_wallet_id CHAR(36) NULL,
  debit_currency CHAR(3) NULL,
  debit_amount DECIMAL(20,8) NOT NULL DEFAULT 0,
  credit_currency CHAR(3) NULL,
  credit_amount DECIMAL(20,8) NOT NULL DEFAULT 0,
  fee_currency CHAR(3) NULL,
  fee_amount DECIMAL(20,8) NOT NULL DEFAULT 0,
  exchange_rate DECIMAL(20,10) NULL,
  description VARCHAR(500) NULL,
  metadata JSON NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (transaction_id),
  UNIQUE KEY uq_transactions_reference (reference),
  KEY idx_transactions_initiated_by (initiated_by_user_id, created_at),
  KEY idx_transactions_sender (sender_user_id, created_at),
  KEY idx_transactions_recipient (recipient_user_id, created_at),
  KEY idx_transactions_debit_wallet (debit_wallet_id),
  KEY idx_transactions_credit_wallet (credit_wallet_id),
  CONSTRAINT fk_transactions_initiated_by
    FOREIGN KEY (initiated_by_user_id) REFERENCES users(user_id)
    ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT fk_transactions_sender
    FOREIGN KEY (sender_user_id) REFERENCES users(user_id)
    ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT fk_transactions_recipient
    FOREIGN KEY (recipient_user_id) REFERENCES users(user_id)
    ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT fk_transactions_debit_wallet
    FOREIGN KEY (debit_wallet_id) REFERENCES wallets(wallet_id)
    ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT fk_transactions_credit_wallet
    FOREIGN KEY (credit_wallet_id) REFERENCES wallets(wallet_id)
    ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT chk_transactions_debit_non_negative CHECK (debit_amount >= 0),
  CONSTRAINT chk_transactions_credit_non_negative CHECK (credit_amount >= 0),
  CONSTRAINT chk_transactions_fee_non_negative CHECK (fee_amount >= 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE login_challenges (
  challenge_id CHAR(36) NOT NULL,
  user_id CHAR(36) NOT NULL,
  expires_at DATETIME NOT NULL,
  consumed_at DATETIME NULL,
  created_ip VARCHAR(45) NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (challenge_id),
  KEY idx_login_challenges_user (user_id),
  KEY idx_login_challenges_expires (expires_at),
  CONSTRAINT fk_login_challenges_user
    FOREIGN KEY (user_id) REFERENCES users(user_id)
    ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE refresh_tokens (
  token_id CHAR(36) NOT NULL,
  user_id CHAR(36) NOT NULL,
  token_hash CHAR(64) NOT NULL,
  expires_at DATETIME NOT NULL,
  revoked_at DATETIME NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (token_id),
  UNIQUE KEY uq_refresh_token_hash (token_hash),
  KEY idx_refresh_tokens_user (user_id),
  KEY idx_refresh_tokens_expires (expires_at),
  CONSTRAINT fk_refresh_tokens_user
    FOREIGN KEY (user_id) REFERENCES users(user_id)
    ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE audit_logs (
  log_id BIGINT NOT NULL AUTO_INCREMENT,
  user_id CHAR(36) NULL,
  action VARCHAR(80) NOT NULL,
  resource_type VARCHAR(80) NULL,
  resource_id VARCHAR(80) NULL,
  status ENUM('SUCCESS','FAILURE') NOT NULL DEFAULT 'SUCCESS',
  ip_address VARCHAR(45) NULL,
  user_agent VARCHAR(255) NULL,
  metadata JSON NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (log_id),
  KEY idx_audit_user (user_id, created_at),
  KEY idx_audit_action (action, created_at),
  CONSTRAINT fk_audit_user
    FOREIGN KEY (user_id) REFERENCES users(user_id)
    ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT INTO roles (role_name, description) VALUES
  ('customer', 'Standard SITWallet user'),
  ('support', 'Read-only operational support'),
  ('admin', 'Administrative user who can manage users, rates, and settings');

INSERT INTO currencies
  (currency_code, currency_name, symbol, decimal_places, rate_to_usd, high_24h_to_usd, low_24h_to_usd, change_24h_pct)
VALUES
  ('USD', 'United States Dollar', '$', 2, 1.0000000000, 1.0020000000, 0.9980000000, 0.0000),
  ('SGD', 'Singapore Dollar', 'S$', 2, 0.7400000000, 0.7450000000, 0.7360000000, 0.1800),
  ('EUR', 'Euro', 'EUR', 2, 1.0800000000, 1.0870000000, 1.0710000000, -0.1200),
  ('GBP', 'British Pound', 'GBP', 2, 1.2700000000, 1.2810000000, 1.2590000000, 0.0900),
  ('JPY', 'Japanese Yen', 'JPY', 0, 0.0064000000, 0.0065000000, 0.0063000000, -0.0500),
  ('MYR', 'Malaysian Ringgit', 'RM', 2, 0.2150000000, 0.2170000000, 0.2130000000, 0.2200),
  ('AUD', 'Australian Dollar', 'A$', 2, 0.6600000000, 0.6660000000, 0.6540000000, -0.0800),
  ('CAD', 'Canadian Dollar', 'C$', 2, 0.7350000000, 0.7400000000, 0.7300000000, 0.0400),
  ('INR', 'Indian Rupee', 'INR', 2, 0.0120000000, 0.0121000000, 0.0119000000, 0.0300);

INSERT INTO exchange_rates
  (from_currency, to_currency, rate, high_24h, low_24h, change_24h_pct, source)
SELECT
  c1.currency_code,
  c2.currency_code,
  ROUND(c1.rate_to_usd / c2.rate_to_usd, 10),
  ROUND(c1.high_24h_to_usd / c2.low_24h_to_usd, 10),
  ROUND(c1.low_24h_to_usd / c2.high_24h_to_usd, 10),
  ROUND(c1.change_24h_pct - c2.change_24h_pct, 4),
  'seed'
FROM currencies c1
JOIN currencies c2 ON c1.currency_code <> c2.currency_code;

INSERT INTO platform_settings (setting_key, setting_value, setting_unit, description) VALUES
  ('exchange_fee_percent', 0.50000000, 'percent', 'Percent fee deducted from the sold amount before exchange'),
  ('transfer_fee_percent', 0.75000000, 'percent', 'Percent fee deducted from the sent amount before recipient credit'),
  ('top_up_fee_percent', 0.30000000, 'percent', 'Percent fee deducted from top-up amount before wallet credit'),
  ('daily_top_up_limit', 5000.00000000, 'amount', 'Maximum total gross top-up amount per user per day');

DELIMITER $$

CREATE PROCEDURE sp_create_wallet(
  IN p_user_id CHAR(36),
  IN p_currency CHAR(3)
)
BEGIN
  DECLARE v_currency CHAR(3);
  DECLARE v_wallet_id CHAR(36);
  DECLARE v_exists INT DEFAULT 0;

  SET v_currency = UPPER(TRIM(p_currency));

  SELECT COUNT(*) INTO v_exists
  FROM currencies
  WHERE currency_code = v_currency AND is_active = 1;

  IF v_exists = 0 THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Unsupported currency';
  END IF;

  INSERT INTO wallets (wallet_id, user_id, currency_code, balance, is_active)
  VALUES (UUID(), p_user_id, v_currency, 0, 1)
  ON DUPLICATE KEY UPDATE is_active = 1, updated_at = CURRENT_TIMESTAMP;

  SELECT wallet_id INTO v_wallet_id
  FROM wallets
  WHERE user_id = p_user_id AND currency_code = v_currency;

  SELECT v_wallet_id AS wallet_id, v_currency AS currency_code;
END$$

CREATE PROCEDURE sp_finalize_registration(
  IN p_user_id CHAR(36),
  IN p_password_hash VARCHAR(255),
  IN p_primary_currency CHAR(3),
  IN p_terms_accepted TINYINT
)
BEGIN
  DECLARE v_status VARCHAR(40);
  DECLARE v_currency CHAR(3);
  DECLARE v_exists INT DEFAULT 0;
  DECLARE v_wallet_id CHAR(36);
  DECLARE EXIT HANDLER FOR SQLEXCEPTION
  BEGIN
    ROLLBACK;
    RESIGNAL;
  END;

  SET v_currency = UPPER(TRIM(p_primary_currency));

  IF p_terms_accepted <> 1 THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Terms must be accepted';
  END IF;

  IF p_password_hash IS NULL OR CHAR_LENGTH(p_password_hash) < 20 THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Invalid password hash';
  END IF;

  START TRANSACTION;

  SELECT status INTO v_status
  FROM users
  WHERE user_id = p_user_id
  FOR UPDATE;

  IF v_status IS NULL THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'User not found';
  END IF;

  IF v_status <> 'password_pending' THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Registration is not ready for password setup';
  END IF;

  SELECT COUNT(*) INTO v_exists
  FROM currencies
  WHERE currency_code = v_currency AND is_active = 1;

  IF v_exists = 0 THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Unsupported primary currency';
  END IF;

  UPDATE users
  SET password_hash = p_password_hash,
      primary_currency = v_currency,
      status = 'active',
      terms_accepted_at = CURRENT_TIMESTAMP,
      updated_at = CURRENT_TIMESTAMP
  WHERE user_id = p_user_id;

  INSERT INTO wallets (wallet_id, user_id, currency_code, balance, is_active)
  VALUES (UUID(), p_user_id, v_currency, 0, 1)
  ON DUPLICATE KEY UPDATE is_active = 1, updated_at = CURRENT_TIMESTAMP;

  SELECT wallet_id INTO v_wallet_id
  FROM wallets
  WHERE user_id = p_user_id AND currency_code = v_currency;

  COMMIT;

  SELECT p_user_id AS user_id, v_currency AS primary_currency, v_wallet_id AS wallet_id, 'active' AS status;
END$$

CREATE PROCEDURE sp_add_recipient(
  IN p_owner_user_id CHAR(36),
  IN p_recipient_email VARCHAR(255),
  IN p_nickname VARCHAR(120)
)
BEGIN
  DECLARE v_recipient_user_id CHAR(36);
  DECLARE v_recipient_id CHAR(36);
  DECLARE v_full_name VARCHAR(120);
  DECLARE v_email VARCHAR(255);
  DECLARE v_exists INT DEFAULT 0;

  SELECT COUNT(*) INTO v_exists
  FROM users
  WHERE user_id = p_owner_user_id AND status = 'active';

  IF v_exists = 0 THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Active owner user not found';
  END IF;

  SELECT COUNT(*) INTO v_exists
  FROM users
  WHERE email = LOWER(TRIM(p_recipient_email)) AND status = 'active';

  IF v_exists = 0 THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Recipient account not found';
  END IF;

  SELECT user_id, full_name, email INTO v_recipient_user_id, v_full_name, v_email
  FROM users
  WHERE email = LOWER(TRIM(p_recipient_email)) AND status = 'active'
  LIMIT 1;

  IF v_recipient_user_id = p_owner_user_id THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Recipient cannot be the same user';
  END IF;

  INSERT INTO recipients (recipient_id, owner_user_id, recipient_user_id, nickname)
  VALUES (UUID(), p_owner_user_id, v_recipient_user_id, NULLIF(TRIM(p_nickname), ''))
  ON DUPLICATE KEY UPDATE nickname = COALESCE(NULLIF(TRIM(p_nickname), ''), nickname);

  SELECT recipient_id INTO v_recipient_id
  FROM recipients
  WHERE owner_user_id = p_owner_user_id AND recipient_user_id = v_recipient_user_id;

  SELECT
    v_recipient_id AS recipient_id,
    v_recipient_user_id AS recipient_user_id,
    v_full_name AS full_name,
    v_email AS email,
    (SELECT nickname FROM recipients WHERE recipient_id = v_recipient_id) AS nickname;
END$$

CREATE PROCEDURE sp_top_up(
  IN p_user_id CHAR(36),
  IN p_currency CHAR(3),
  IN p_amount DECIMAL(20,8),
  IN p_description VARCHAR(500),
  IN p_reference VARCHAR(40)
)
BEGIN
  DECLARE v_currency CHAR(3);
  DECLARE v_wallet_id CHAR(36);
  DECLARE v_fee_pct DECIMAL(20,8) DEFAULT 0;
  DECLARE v_daily_limit DECIMAL(20,8) DEFAULT 0;
  DECLARE v_today_total DECIMAL(20,8) DEFAULT 0;
  DECLARE v_fee DECIMAL(20,8) DEFAULT 0;
  DECLARE v_net DECIMAL(20,8) DEFAULT 0;
  DECLARE v_transaction_id CHAR(36);
  DECLARE v_exists INT DEFAULT 0;
  DECLARE EXIT HANDLER FOR SQLEXCEPTION
  BEGIN
    ROLLBACK;
    RESIGNAL;
  END;

  SET v_currency = UPPER(TRIM(p_currency));

  IF p_amount <= 0 THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Amount must be greater than zero';
  END IF;

  SELECT COUNT(*) INTO v_exists
  FROM users
  WHERE user_id = p_user_id AND status = 'active';

  IF v_exists = 0 THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Active user not found';
  END IF;

  SELECT COUNT(*) INTO v_exists
  FROM currencies
  WHERE currency_code = v_currency AND is_active = 1;

  IF v_exists = 0 THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Unsupported currency';
  END IF;

  SELECT setting_value INTO v_fee_pct
  FROM platform_settings
  WHERE setting_key = 'top_up_fee_percent';

  SELECT setting_value INTO v_daily_limit
  FROM platform_settings
  WHERE setting_key = 'daily_top_up_limit';

  SET v_fee = ROUND(p_amount * v_fee_pct / 100, 8);
  SET v_net = ROUND(p_amount - v_fee, 8);

  IF v_net <= 0 THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Top-up amount is too small after fees';
  END IF;

  START TRANSACTION;

  BEGIN
    DECLARE v_user_status VARCHAR(40);
    DECLARE v_user_missing TINYINT DEFAULT 0;
    DECLARE CONTINUE HANDLER FOR NOT FOUND SET v_user_missing = 1;

    SELECT status INTO v_user_status
    FROM users
    WHERE user_id = p_user_id
    FOR UPDATE;

    IF v_user_missing = 1 OR v_user_status <> 'active' THEN
      SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Active user not found';
    END IF;
  END;

  SELECT COALESCE(SUM(credit_amount + fee_amount), 0) INTO v_today_total
  FROM transactions
  WHERE initiated_by_user_id = p_user_id
    AND transaction_type = 'TOP_UP'
    AND status = 'COMPLETED'
    AND DATE(created_at) = CURRENT_DATE();

  IF v_today_total + p_amount > v_daily_limit THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Daily top-up limit exceeded';
  END IF;

  INSERT INTO wallets (wallet_id, user_id, currency_code, balance, is_active)
  VALUES (UUID(), p_user_id, v_currency, 0, 1)
  ON DUPLICATE KEY UPDATE is_active = 1, updated_at = CURRENT_TIMESTAMP;

  SELECT wallet_id INTO v_wallet_id
  FROM wallets
  WHERE user_id = p_user_id AND currency_code = v_currency
  FOR UPDATE;

  UPDATE wallets
  SET balance = balance + v_net
  WHERE wallet_id = v_wallet_id;

  SET v_transaction_id = UUID();

  INSERT INTO transactions (
    transaction_id, reference, transaction_type, status, initiated_by_user_id,
    sender_user_id, recipient_user_id, debit_wallet_id, credit_wallet_id,
    debit_currency, debit_amount, credit_currency, credit_amount,
    fee_currency, fee_amount, exchange_rate, description, metadata
  )
  VALUES (
    v_transaction_id, p_reference, 'TOP_UP', 'COMPLETED', p_user_id,
    NULL, p_user_id, NULL, v_wallet_id,
    NULL, 0, v_currency, v_net,
    v_currency, v_fee, NULL, p_description,
    JSON_OBJECT('gross_amount', p_amount, 'fee_percent', v_fee_pct)
  );

  COMMIT;

  SELECT
    v_transaction_id AS transaction_id,
    p_reference AS reference,
    'TOP_UP' AS transaction_type,
    v_currency AS currency,
    p_amount AS gross_amount,
    v_fee AS fee_amount,
    v_net AS credited_amount;
END$$

CREATE PROCEDURE sp_exchange(
  IN p_user_id CHAR(36),
  IN p_from_currency CHAR(3),
  IN p_to_currency CHAR(3),
  IN p_amount DECIMAL(20,8),
  IN p_reference VARCHAR(40)
)
BEGIN
  DECLARE v_from_currency CHAR(3);
  DECLARE v_to_currency CHAR(3);
  DECLARE v_from_wallet_id CHAR(36);
  DECLARE v_to_wallet_id CHAR(36);
  DECLARE v_from_balance DECIMAL(20,8) DEFAULT 0;
  DECLARE v_fee_pct DECIMAL(20,8) DEFAULT 0;
  DECLARE v_fee DECIMAL(20,8) DEFAULT 0;
  DECLARE v_net_source DECIMAL(20,8) DEFAULT 0;
  DECLARE v_rate DECIMAL(20,10) DEFAULT 0;
  DECLARE v_credit DECIMAL(20,8) DEFAULT 0;
  DECLARE v_transaction_id CHAR(36);
  DECLARE v_exists INT DEFAULT 0;
  DECLARE EXIT HANDLER FOR SQLEXCEPTION
  BEGIN
    ROLLBACK;
    RESIGNAL;
  END;

  SET v_from_currency = UPPER(TRIM(p_from_currency));
  SET v_to_currency = UPPER(TRIM(p_to_currency));

  IF v_from_currency = v_to_currency THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Exchange currencies must differ';
  END IF;

  IF p_amount <= 0 THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Amount must be greater than zero';
  END IF;

  SELECT COUNT(*) INTO v_exists
  FROM users
  WHERE user_id = p_user_id AND status = 'active';

  IF v_exists = 0 THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Active user not found';
  END IF;

  SELECT COUNT(*) INTO v_exists
  FROM exchange_rates
  WHERE from_currency = v_from_currency AND to_currency = v_to_currency;

  IF v_exists = 0 THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Exchange rate not found';
  END IF;

  SELECT rate INTO v_rate
  FROM exchange_rates
  WHERE from_currency = v_from_currency AND to_currency = v_to_currency;

  SELECT setting_value INTO v_fee_pct
  FROM platform_settings
  WHERE setting_key = 'exchange_fee_percent';

  SET v_fee = ROUND(p_amount * v_fee_pct / 100, 8);
  SET v_net_source = ROUND(p_amount - v_fee, 8);
  SET v_credit = ROUND(v_net_source * v_rate, 8);

  IF v_credit <= 0 THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Exchange amount is too small after fees';
  END IF;

  START TRANSACTION;

  SELECT COUNT(*) INTO v_exists
  FROM wallets
  WHERE user_id = p_user_id AND currency_code = v_from_currency AND is_active = 1;

  IF v_exists = 0 THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Source wallet not found';
  END IF;

  INSERT INTO wallets (wallet_id, user_id, currency_code, balance, is_active)
  VALUES (UUID(), p_user_id, v_to_currency, 0, 1)
  ON DUPLICATE KEY UPDATE is_active = 1, updated_at = CURRENT_TIMESTAMP;

  SELECT wallet_id, balance INTO v_from_wallet_id, v_from_balance
  FROM wallets
  WHERE user_id = p_user_id AND currency_code = v_from_currency
  FOR UPDATE;

  IF v_from_balance < p_amount THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Insufficient funds';
  END IF;

  SELECT wallet_id INTO v_to_wallet_id
  FROM wallets
  WHERE user_id = p_user_id AND currency_code = v_to_currency
  FOR UPDATE;

  UPDATE wallets
  SET balance = balance - p_amount
  WHERE wallet_id = v_from_wallet_id;

  UPDATE wallets
  SET balance = balance + v_credit
  WHERE wallet_id = v_to_wallet_id;

  SET v_transaction_id = UUID();

  INSERT INTO transactions (
    transaction_id, reference, transaction_type, status, initiated_by_user_id,
    sender_user_id, recipient_user_id, debit_wallet_id, credit_wallet_id,
    debit_currency, debit_amount, credit_currency, credit_amount,
    fee_currency, fee_amount, exchange_rate, description, metadata
  )
  VALUES (
    v_transaction_id, p_reference, 'EXCHANGE', 'COMPLETED', p_user_id,
    p_user_id, p_user_id, v_from_wallet_id, v_to_wallet_id,
    v_from_currency, p_amount, v_to_currency, v_credit,
    v_from_currency, v_fee, v_rate, 'Currency exchange',
    JSON_OBJECT('net_source_amount', v_net_source, 'fee_percent', v_fee_pct)
  );

  COMMIT;

  SELECT
    v_transaction_id AS transaction_id,
    p_reference AS reference,
    'EXCHANGE' AS transaction_type,
    v_from_currency AS from_currency,
    p_amount AS sold_amount,
    v_fee AS fee_amount,
    v_rate AS exchange_rate,
    v_to_currency AS to_currency,
    v_credit AS bought_amount;
END$$

CREATE PROCEDURE sp_transfer(
  IN p_sender_user_id CHAR(36),
  IN p_recipient_user_id CHAR(36),
  IN p_from_currency CHAR(3),
  IN p_to_currency CHAR(3),
  IN p_amount DECIMAL(20,8),
  IN p_description VARCHAR(500),
  IN p_reference VARCHAR(40)
)
BEGIN
  DECLARE v_from_currency CHAR(3);
  DECLARE v_to_currency CHAR(3);
  DECLARE v_sender_wallet_id CHAR(36);
  DECLARE v_recipient_wallet_id CHAR(36);
  DECLARE v_sender_balance DECIMAL(20,8) DEFAULT 0;
  DECLARE v_fee_pct DECIMAL(20,8) DEFAULT 0;
  DECLARE v_fee DECIMAL(20,8) DEFAULT 0;
  DECLARE v_net_source DECIMAL(20,8) DEFAULT 0;
  DECLARE v_rate DECIMAL(20,10) DEFAULT 1;
  DECLARE v_credit DECIMAL(20,8) DEFAULT 0;
  DECLARE v_transaction_id CHAR(36);
  DECLARE v_exists INT DEFAULT 0;
  DECLARE EXIT HANDLER FOR SQLEXCEPTION
  BEGIN
    ROLLBACK;
    RESIGNAL;
  END;

  SET v_from_currency = UPPER(TRIM(p_from_currency));
  SET v_to_currency = UPPER(TRIM(p_to_currency));

  IF p_sender_user_id = p_recipient_user_id THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Recipient cannot be the same user';
  END IF;

  IF p_amount <= 0 THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Amount must be greater than zero';
  END IF;

  SELECT COUNT(*) INTO v_exists
  FROM users
  WHERE user_id = p_sender_user_id AND status = 'active';

  IF v_exists = 0 THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Active sender not found';
  END IF;

  SELECT COUNT(*) INTO v_exists
  FROM users
  WHERE user_id = p_recipient_user_id AND status = 'active';

  IF v_exists = 0 THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Active recipient not found';
  END IF;

  IF v_from_currency <> v_to_currency THEN
    SELECT COUNT(*) INTO v_exists
    FROM exchange_rates
    WHERE from_currency = v_from_currency AND to_currency = v_to_currency;

    IF v_exists = 0 THEN
      SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Exchange rate not found';
    END IF;

    SELECT rate INTO v_rate
    FROM exchange_rates
    WHERE from_currency = v_from_currency AND to_currency = v_to_currency;
  END IF;

  SELECT setting_value INTO v_fee_pct
  FROM platform_settings
  WHERE setting_key = 'transfer_fee_percent';

  SET v_fee = ROUND(p_amount * v_fee_pct / 100, 8);
  SET v_net_source = ROUND(p_amount - v_fee, 8);
  SET v_credit = ROUND(v_net_source * v_rate, 8);

  IF v_credit <= 0 THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Transfer amount is too small after fees';
  END IF;

  START TRANSACTION;

  SELECT COUNT(*) INTO v_exists
  FROM wallets
  WHERE user_id = p_sender_user_id AND currency_code = v_from_currency AND is_active = 1;

  IF v_exists = 0 THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Sender wallet not found';
  END IF;

  INSERT INTO wallets (wallet_id, user_id, currency_code, balance, is_active)
  VALUES (UUID(), p_recipient_user_id, v_to_currency, 0, 1)
  ON DUPLICATE KEY UPDATE is_active = 1, updated_at = CURRENT_TIMESTAMP;

  SELECT wallet_id, balance INTO v_sender_wallet_id, v_sender_balance
  FROM wallets
  WHERE user_id = p_sender_user_id AND currency_code = v_from_currency
  FOR UPDATE;

  IF v_sender_balance < p_amount THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Insufficient funds';
  END IF;

  SELECT wallet_id INTO v_recipient_wallet_id
  FROM wallets
  WHERE user_id = p_recipient_user_id AND currency_code = v_to_currency
  FOR UPDATE;

  UPDATE wallets
  SET balance = balance - p_amount
  WHERE wallet_id = v_sender_wallet_id;

  UPDATE wallets
  SET balance = balance + v_credit
  WHERE wallet_id = v_recipient_wallet_id;

  SET v_transaction_id = UUID();

  INSERT INTO transactions (
    transaction_id, reference, transaction_type, status, initiated_by_user_id,
    sender_user_id, recipient_user_id, debit_wallet_id, credit_wallet_id,
    debit_currency, debit_amount, credit_currency, credit_amount,
    fee_currency, fee_amount, exchange_rate, description, metadata
  )
  VALUES (
    v_transaction_id, p_reference, 'TRANSFER', 'COMPLETED', p_sender_user_id,
    p_sender_user_id, p_recipient_user_id, v_sender_wallet_id, v_recipient_wallet_id,
    v_from_currency, p_amount, v_to_currency, v_credit,
    v_from_currency, v_fee, v_rate, p_description,
    JSON_OBJECT('net_source_amount', v_net_source, 'fee_percent', v_fee_pct)
  );

  COMMIT;

  SELECT
    v_transaction_id AS transaction_id,
    p_reference AS reference,
    'TRANSFER' AS transaction_type,
    p_recipient_user_id AS recipient_user_id,
    v_from_currency AS from_currency,
    p_amount AS sent_amount,
    v_fee AS fee_amount,
    v_rate AS exchange_rate,
    v_to_currency AS to_currency,
    v_credit AS recipient_amount;
END$$

CREATE PROCEDURE sp_log_audit(
  IN p_user_id CHAR(36),
  IN p_action VARCHAR(80),
  IN p_resource_type VARCHAR(80),
  IN p_resource_id VARCHAR(80),
  IN p_status VARCHAR(20),
  IN p_ip_address VARCHAR(45),
  IN p_user_agent VARCHAR(255),
  IN p_metadata JSON
)
BEGIN
  INSERT INTO audit_logs
    (user_id, action, resource_type, resource_id, status, ip_address, user_agent, metadata)
  VALUES
    (p_user_id, p_action, p_resource_type, p_resource_id,
     IF(p_status = 'FAILURE', 'FAILURE', 'SUCCESS'),
     p_ip_address, LEFT(p_user_agent, 255), p_metadata);
END$$

CREATE PROCEDURE sp_update_platform_setting(
  IN p_admin_user_id CHAR(36),
  IN p_setting_key VARCHAR(80),
  IN p_setting_value DECIMAL(20,8)
)
BEGIN
  DECLARE v_exists INT DEFAULT 0;

  SELECT COUNT(*) INTO v_exists
  FROM users
  WHERE user_id = p_admin_user_id AND role_name = 'admin' AND status = 'active';

  IF v_exists = 0 THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Admin user not found';
  END IF;

  UPDATE platform_settings
  SET setting_value = p_setting_value,
      updated_by = p_admin_user_id,
      updated_at = CURRENT_TIMESTAMP
  WHERE setting_key = p_setting_key;

  IF ROW_COUNT() = 0 THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Setting not found';
  END IF;

  SELECT setting_key, setting_value, setting_unit, description, updated_at
  FROM platform_settings
  WHERE setting_key = p_setting_key;
END$$

CREATE PROCEDURE sp_get_dashboard(
  IN p_user_id CHAR(36)
)
BEGIN
  DECLARE v_primary_currency CHAR(3);
  DECLARE v_primary_usd_rate DECIMAL(20,10);

  SELECT COALESCE(primary_currency, 'USD') INTO v_primary_currency
  FROM users
  WHERE user_id = p_user_id AND status = 'active';

  IF v_primary_currency IS NULL THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Active user not found';
  END IF;

  SELECT rate_to_usd INTO v_primary_usd_rate
  FROM currencies
  WHERE currency_code = v_primary_currency;

  SELECT
    v_primary_currency AS estimated_currency,
    ROUND(COALESCE(SUM(w.balance * c.rate_to_usd / v_primary_usd_rate), 0), 8) AS total_estimated_balance
  FROM wallets w
  JOIN currencies c ON c.currency_code = w.currency_code
  WHERE w.user_id = p_user_id AND w.is_active = 1;

  SELECT
    w.wallet_id,
    w.currency_code,
    c.currency_name,
    c.symbol,
    w.balance,
    ROUND(w.balance * c.rate_to_usd / v_primary_usd_rate, 8) AS estimated_primary_value,
    w.updated_at
  FROM wallets w
  JOIN currencies c ON c.currency_code = w.currency_code
  WHERE w.user_id = p_user_id AND w.is_active = 1
  ORDER BY w.currency_code;

  SELECT
    transaction_id,
    reference,
    transaction_type,
    status,
    sender_user_id,
    recipient_user_id,
    debit_currency,
    debit_amount,
    credit_currency,
    credit_amount,
    fee_currency,
    fee_amount,
    exchange_rate,
    description,
    created_at
  FROM transactions
  WHERE initiated_by_user_id = p_user_id
     OR sender_user_id = p_user_id
     OR recipient_user_id = p_user_id
  ORDER BY created_at DESC
  LIMIT 10;

  SELECT
    from_currency,
    to_currency,
    rate,
    high_24h,
    low_24h,
    change_24h_pct,
    updated_at
  FROM exchange_rates
  ORDER BY from_currency, to_currency;
END$$

DELIMITER ;
