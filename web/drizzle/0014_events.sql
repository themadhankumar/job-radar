-- Product-analytics event log. One row per tracked user interaction
-- (page_view, job_view, job_apply_click, studio_open, job_dismiss,
-- add_url, referral_add). Append-only; read whole in the /admin dashboard.
-- Deliberately schema-light: a name + a JSONB props bag, so new event
-- types need no migration. user_id is nullable so we never drop an event
-- on a missing session; cascades when a user is deleted.
CREATE TABLE IF NOT EXISTS events (
  id BIGSERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  props JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS events_user_id_idx ON events (user_id);
CREATE INDEX IF NOT EXISTS events_name_idx ON events (name);
CREATE INDEX IF NOT EXISTS events_created_at_idx ON events (created_at DESC);
