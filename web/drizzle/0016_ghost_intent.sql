-- 0016_ghost_intent.sql
-- Ghost-job intent scoring: lifecycle tracking + per-job intent signal.
-- Idempotent.

-- Lifecycle: when did we last observe this req on its board?
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS last_seen_at timestamptz;
-- Backfill existing rows to their first-seen as a conservative floor.
UPDATE jobs SET last_seen_at = created_at WHERE last_seen_at IS NULL;
ALTER TABLE jobs ALTER COLUMN last_seen_at SET DEFAULT now();

-- Intent signal: queryable score (0-100, higher = more ghost-like) + detail.
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS intent_score real;
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS intent jsonb;

-- Sort/filter support for the "hide likely ghosts" control.
CREATE INDEX IF NOT EXISTS jobs_intent_score_idx ON jobs (intent_score);
