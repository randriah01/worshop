-- Schéma de NovaPay (données 100 % fictives).
-- Multi-utilisateurs : chaque compte possède son « commerce » (merchant) et
-- ne voit que ses propres transactions. Un compte « admin » voit tout.

CREATE TABLE IF NOT EXISTS merchants (
  id            SERIAL PRIMARY KEY,
  slug          TEXT UNIQUE NOT NULL,
  name          TEXT NOT NULL,
  balance_cents BIGINT NOT NULL DEFAULT 0 CHECK (balance_cents >= 0),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS merchant_users (
  id            SERIAL PRIMARY KEY,
  login         TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  merchant_id   INTEGER NOT NULL REFERENCES merchants(id) ON DELETE CASCADE,
  role          TEXT NOT NULL DEFAULT 'user' CHECK (role IN ('user', 'admin')),
  session_version BIGINT NOT NULL DEFAULT 0,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS transactions (
  id              SERIAL PRIMARY KEY,
  merchant_id     INTEGER NOT NULL REFERENCES merchants(id),
  amount_cents    BIGINT NOT NULL CHECK (amount_cents > 0),
  status          TEXT NOT NULL DEFAULT 'pending'
                  CHECK (status IN ('pending', 'validated', 'rejected', 'error')),
  idempotency_key TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_tx_merchant ON transactions(merchant_id);
CREATE INDEX IF NOT EXISTS idx_tx_created ON transactions(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_tx_status ON transactions(status);

-- Idempotence : une même clé ne peut créer qu'une seule transaction par
-- commerçant. Une requête répétée (double-clic, renvoi réseau) ne crée donc
-- pas de doublon.
CREATE UNIQUE INDEX IF NOT EXISTS idx_tx_idempotency
  ON transactions(merchant_id, idempotency_key)
  WHERE idempotency_key IS NOT NULL;

CREATE TABLE IF NOT EXISTS incidents (
  id          SERIAL PRIMARY KEY,
  kind        TEXT NOT NULL,
  detail      TEXT,
  status      TEXT NOT NULL DEFAULT 'open'
              CHECK (status IN ('open', 'resolved', 'escalated')),
  action      TEXT,                              -- action de remédiation appliquée
  attempts    INTEGER NOT NULL DEFAULT 0,        -- nombre de tentatives
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  resolved_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_incidents_status ON incidents(status);

-- Les comptes sont créés via l'inscription (auth-service). Un compte admin
-- est créé automatiquement au démarrage de l'auth-service.

-- Option biométrie / passkeys (voir migrations/20261031_face_login.sql pour DB existantes).
CREATE TABLE IF NOT EXISTS face_templates (
  user_id INTEGER PRIMARY KEY REFERENCES merchant_users(id) ON DELETE CASCADE,
  encrypted_embedding TEXT NOT NULL,
  model TEXT NOT NULL,
  consented_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS passkey_credentials (
  id BIGSERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES merchant_users(id) ON DELETE CASCADE,
  credential_id BYTEA NOT NULL UNIQUE,
  public_key BYTEA NOT NULL,
  sign_count BIGINT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_passkey_user ON passkey_credentials(user_id);
CREATE TABLE IF NOT EXISTS biometric_challenges (
  id UUID PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES merchant_users(id) ON DELETE CASCADE,
  purpose TEXT NOT NULL CHECK (purpose IN ('passkey_register', 'face_login')),
  challenge BYTEA,
  face_verified BOOLEAN NOT NULL DEFAULT false,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_biometric_challenges_user ON biometric_challenges(user_id, created_at DESC);
