BEGIN;

ALTER TABLE public.transactions
ADD COLUMN IF NOT EXISTS idempotency_key TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS idx_tx_idempotency
ON public.transactions(merchant_id, idempotency_key)
WHERE idempotency_key IS NOT NULL;

COMMIT;
