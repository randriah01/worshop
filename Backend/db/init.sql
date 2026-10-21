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
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS transactions (
  id           SERIAL PRIMARY KEY,
  merchant_id  INTEGER NOT NULL REFERENCES merchants(id),
  amount_cents BIGINT NOT NULL CHECK (amount_cents > 0),
  status       TEXT NOT NULL DEFAULT 'pending'
               CHECK (status IN ('pending', 'validated', 'rejected', 'error')),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_tx_merchant ON transactions(merchant_id);
CREATE INDEX IF NOT EXISTS idx_tx_created ON transactions(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_tx_status ON transactions(status);

CREATE TABLE IF NOT EXISTS incidents (
  id          SERIAL PRIMARY KEY,
  kind        TEXT NOT NULL,
  detail      TEXT,
  status      TEXT NOT NULL DEFAULT 'open'
              CHECK (status IN ('open', 'resolved')),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  resolved_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_incidents_status ON incidents(status);

-- Les comptes sont créés via l'inscription (auth-service). Un compte admin
-- est créé automatiquement au démarrage de l'auth-service.
