-- Phase 4 (PR 1): structured profile parsed from the user's resume.
-- One row per user; `data` holds skills/titles/industries/seniority/yoe/summary.
-- `edited` = the user has hand-corrected the parse (re-parses must not clobber it silently).

CREATE TABLE IF NOT EXISTS user_profiles (
  user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  data JSONB NOT NULL DEFAULT '{}'::jsonb,
  edited BOOLEAN NOT NULL DEFAULT FALSE,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
