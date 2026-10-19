
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

-- Vue : transactions récentes avec le nom du commerçant (pour le dashboard).
CREATE OR REPLACE VIEW v_recent_transactions AS
SELECT t.id, m.name AS merchant, t.amount_cents, t.status, t.created_at
FROM transactions t
JOIN merchants m ON m.id = t.merchant_id
ORDER BY t.id DESC;

-- Vue : synthèse par commerçant (solde, nombre et total des transactions
-- validées) — utile au dashboard et à la détection d'anomalies.
CREATE OR REPLACE VIEW v_merchant_totals AS
SELECT
  m.id,
  m.name,
  m.balance_cents,
  COUNT(t.id) AS tx_count,
  COALESCE(SUM(t.amount_cents) FILTER (WHERE t.status = 'validated'), 0) AS validated_cents
FROM merchants m
LEFT JOIN transactions t ON t.merchant_id = m.id
GROUP BY m.id, m.name, m.balance_cents;

-- Commerçants fictifs pour rendre la démo vivante.
INSERT INTO merchants (slug, name, balance_cents) VALUES
  ('fournil',  'Le Fournil de Montmartre', 0),
  ('cafe',     'Café des Artistes', 0),
  ('epicerie', 'Épicerie Bastille', 0)
ON CONFLICT (slug) DO NOTHING;
