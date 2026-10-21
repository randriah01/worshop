-- NovaPay IA / SOAR: migration additive, réexécutable.
BEGIN;
ALTER TABLE public.incidents
    ADD COLUMN IF NOT EXISTS source TEXT,
    ADD COLUMN IF NOT EXISTS service TEXT,
    ADD COLUMN IF NOT EXISTS severity TEXT,
    ADD COLUMN IF NOT EXISTS anomaly_score DOUBLE PRECISION,
    ADD COLUMN IF NOT EXISTS model_version TEXT,
    ADD COLUMN IF NOT EXISTS evidence JSONB NOT NULL DEFAULT '{}'::jsonb,
    ADD COLUMN IF NOT EXISTS last_observed_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS dedup_key TEXT,
    ADD COLUMN IF NOT EXISTS observation_count INTEGER NOT NULL DEFAULT 0;

CREATE TABLE IF NOT EXISTS public.incident_events (
    id BIGSERIAL PRIMARY KEY,
    incident_id INTEGER NOT NULL REFERENCES public.incidents(id) ON DELETE CASCADE,
    event_key TEXT UNIQUE,
    event_type TEXT NOT NULL,
    actor TEXT NOT NULL,
    event_data JSONB NOT NULL DEFAULT '{}'::jsonb,
    occurred_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Un seul incident ouvert par clef de corrélation ; un nouvel incident est possible après résolution.
CREATE UNIQUE INDEX IF NOT EXISTS idx_incidents_open_dedup
    ON public.incidents(dedup_key)
    WHERE status = 'open' AND dedup_key IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_incident_events_incident_time
    ON public.incident_events(incident_id, occurred_at DESC);
COMMIT;
