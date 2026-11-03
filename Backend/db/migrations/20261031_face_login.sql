-- NovaPay - connexion faciale pilote. A appliquer UNE fois sur une DB existante.
-- Ne stocke aucune photo brute : seulement les embeddings chiffrés et clés publiques WebAuthn.
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
