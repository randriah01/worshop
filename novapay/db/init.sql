-- Schéma initial de NovaPay (données 100 % fictives).

CREATE TABLE IF NOT EXISTS merchants (
  id            SERIAL PRIMARY KEY,
  name          TEXT NOT NULL,
  balance_cents BIGINT NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS transactions (
  id            SERIAL PRIMARY KEY,
  merchant      TEXT NOT NULL,
  amount_cents  BIGINT NOT NULL,
  status        TEXT NOT NULL DEFAULT 'pending',
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Quelques commerçants fictifs pour rendre la démo vivante.
INSERT INTO merchants (name, balance_cents) VALUES
  ('Le Fournil de Montmartre', 0),
  ('Café des Artistes', 0),
  ('Épicerie Bastille', 0)
ON CONFLICT DO NOTHING;
