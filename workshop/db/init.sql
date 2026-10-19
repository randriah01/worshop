-- Schéma initial de NovaPay (données 100 % fictives).

-- Commerçants et leur solde (montants en centimes, jamais en flottant).
CREATE TABLE IF NOT EXISTS merchants (
  id            SERIAL PRIMARY KEY,
  slug          TEXT UNIQUE NOT NULL,
  name          TEXT NOT NULL,
  balance_cents BIGINT NOT NULL DEFAULT 0
);

-- Comptes de connexion des commerçants.
-- Les mots de passe sont stockés hachés (jamais en clair) ; l'auth-service
-- crée les comptes de démonstration au démarrage.
CREATE TABLE IF NOT EXISTS merchant_users (
  id            SERIAL PRIMARY KEY,
  login         TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  merchant_id   INTEGER NOT NULL REFERENCES merchants(id)
);

-- Transactions.
CREATE TABLE IF NOT EXISTS transactions (
  id           SERIAL PRIMARY KEY,
  merchant_id  INTEGER NOT NULL REFERENCES merchants(id),
  amount_cents BIGINT NOT NULL,
  status       TEXT NOT NULL DEFAULT 'pending',
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_tx_merchant ON transactions(merchant_id);
CREATE INDEX IF NOT EXISTS idx_tx_created ON transactions(created_at DESC);

-- Incidents tracés par la détection et la remédiation.
CREATE TABLE IF NOT EXISTS incidents (
  id          SERIAL PRIMARY KEY,
  kind        TEXT NOT NULL,
  detail      TEXT,
  status      TEXT NOT NULL DEFAULT 'open',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  resolved_at TIMESTAMPTZ
);

-- Commerçants fictifs pour rendre la démo vivante.
INSERT INTO merchants (slug, name, balance_cents) VALUES
  ('fournil',  'Le Fournil de Montmartre', 0),
  ('cafe',     'Café des Artistes', 0),
  ('epicerie', 'Épicerie Bastille', 0)
ON CONFLICT (slug) DO NOTHING;
