-- Phase 4 (PR 3): country tagging, US-only setting, filter presets

ALTER TABLE jobs ADD COLUMN IF NOT EXISTS country TEXT NOT NULL DEFAULT '';   -- 'US' | 'intl' | '' unknown
ALTER TABLE users ADD COLUMN IF NOT EXISTS us_only BOOLEAN NOT NULL DEFAULT FALSE;

CREATE TABLE IF NOT EXISTS filter_presets (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  params JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, name)
);
