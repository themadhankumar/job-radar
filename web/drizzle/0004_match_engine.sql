-- Phase 4 (PR 2): profile-match engine

-- Per-component breakdown of the match score + boost suggestions, e.g.
-- {"skills":0.75,"role":0.9,"work":0.5,"exp":1.0,"industry":1.0,"missing":["kubernetes","dbt"]}
ALTER TABLE user_job_scores ADD COLUMN IF NOT EXISTS components JSONB;

-- One-time Haiku classification per company, keyed by normalized name so
-- LinkedIn-sourced jobs (no company_id) resolve too.
CREATE TABLE IF NOT EXISTS company_profiles (
  id SERIAL PRIMARY KEY,
  name_norm TEXT NOT NULL UNIQUE,
  industry TEXT NOT NULL DEFAULT '',
  tags TEXT[] NOT NULL DEFAULT '{}',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- "Don't suggest this again" on the Suggested tab.
CREATE TABLE IF NOT EXISTS user_dismissed_jobs (
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  job_id INTEGER NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, job_id)
);
