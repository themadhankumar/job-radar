-- Phase 2: enrichment, scores, sponsorship signals
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS pay_min INTEGER;
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS pay_max INTEGER;
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS pay_period TEXT;        -- 'year' | 'hour'
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS yoe_min INTEGER;
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS enriched BOOLEAN NOT NULL DEFAULT FALSE;

CREATE TABLE IF NOT EXISTS user_job_scores (
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  job_id INTEGER NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  score REAL NOT NULL,
  computed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, job_id)
);
CREATE INDEX IF NOT EXISTS ujs_user_score ON user_job_scores (user_id, score DESC);

-- USCIS H-1B Employer Data Hub aggregates
CREATE TABLE IF NOT EXISTS sponsors (
  id SERIAL PRIMARY KEY,
  employer TEXT NOT NULL,
  norm TEXT NOT NULL,
  fiscal_year INTEGER NOT NULL,
  approvals INTEGER NOT NULL DEFAULT 0,
  denials INTEGER NOT NULL DEFAULT 0,
  UNIQUE (norm, fiscal_year)
);
CREATE INDEX IF NOT EXISTS sponsors_norm ON sponsors (norm);

-- shared normalizer so web queries and the Python importer agree
CREATE OR REPLACE FUNCTION norm_employer(t TEXT) RETURNS TEXT
LANGUAGE sql IMMUTABLE AS $$
  SELECT trim(regexp_replace(regexp_replace(lower(coalesce(t,'')),
    '\y(incorporated|corporation|technologies|technology|solutions|services|holdings|group|inc|llc|llp|ltd|corp|co|plc|usa|us)\y', '', 'g'),
    '[^a-z0-9]+', ' ', 'g'))
$$;
