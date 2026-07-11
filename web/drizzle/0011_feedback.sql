-- Lightweight feedback/bug-report capture from the in-app + landing widget.
-- No triage table yet (v1 is capture + instant email); status can be added
-- later without a data migration since submissions are just rows here.
CREATE TABLE IF NOT EXISTS feedback (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  email TEXT,                          -- optional, for anonymous submitters who want a reply
  type TEXT NOT NULL DEFAULT 'other',  -- bug | idea | other
  message TEXT NOT NULL,
  page_path TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS feedback_created ON feedback (created_at DESC);
