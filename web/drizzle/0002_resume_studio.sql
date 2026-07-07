-- Phase 3: Resume Studio — per-job chat threads, usage tracking, original resume storage

-- Keep the original upload so exports can preserve formatting (docx XML edit / tex rewrite).
ALTER TABLE resumes ADD COLUMN IF NOT EXISTS file_b64 TEXT;               -- base64 of original upload (docx/tex only)
ALTER TABLE resumes ADD COLUMN IF NOT EXISTS file_kind TEXT;              -- 'docx' | 'pdf' | 'tex' | 'txt'

CREATE TABLE IF NOT EXISTS resume_threads (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  job_id INTEGER NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, job_id)
);

CREATE TABLE IF NOT EXISTS resume_messages (
  id SERIAL PRIMARY KEY,
  thread_id INTEGER NOT NULL REFERENCES resume_threads(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
  content TEXT NOT NULL,
  tokens_in INTEGER NOT NULL DEFAULT 0,
  tokens_out INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS rm_thread_created ON resume_messages (thread_id, created_at);

-- Monthly token usage per user — enforced for shared-key users, informational for BYOK.
CREATE TABLE IF NOT EXISTS user_usage (
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  month TEXT NOT NULL,                       -- 'YYYY-MM'
  tokens_in BIGINT NOT NULL DEFAULT 0,
  tokens_out BIGINT NOT NULL DEFAULT 0,
  PRIMARY KEY (user_id, month)
);
