-- NovaPay : invalidation serveur de tous les JWT d'un utilisateur après suppression du MFA.
-- À appliquer après sauvegarde sur une base existante, avant reconstruction des services.
BEGIN;
ALTER TABLE public.merchant_users
  ADD COLUMN IF NOT EXISTS session_version BIGINT NOT NULL DEFAULT 0;
COMMIT;
