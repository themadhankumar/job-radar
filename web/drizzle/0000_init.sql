CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  name TEXT NOT NULL,
  needs_sponsorship BOOLEAN NOT NULL DEFAULT FALSE,
  onboarded BOOLEAN NOT NULL DEFAULT FALSE,
  digest_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  anthropic_key_enc TEXT,
  notion_token_enc TEXT,
  notion_database_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS resumes (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  filename TEXT NOT NULL,
  content TEXT NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS user_keywords (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  keyword TEXT NOT NULL,
  kind TEXT NOT NULL DEFAULT 'include' CHECK (kind IN ('include','exclude'))
);

CREATE TABLE IF NOT EXISTS companies (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  ats TEXT NOT NULL CHECK (ats IN ('greenhouse','lever','ashby','workday','linkedin')),
  slug TEXT, tenant TEXT, host TEXT, site TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS user_companies (
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  company_id INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  list TEXT NOT NULL DEFAULT 'watch' CHECK (list IN ('dream','watch')),
  PRIMARY KEY (user_id, company_id)
);

CREATE TABLE IF NOT EXISTS jobs (
  id SERIAL PRIMARY KEY,
  source TEXT NOT NULL,
  company_id INTEGER REFERENCES companies(id) ON DELETE SET NULL,
  company_name TEXT NOT NULL,
  ext_id TEXT NOT NULL,
  title TEXT NOT NULL,
  url TEXT NOT NULL,
  location TEXT NOT NULL DEFAULT '',
  description TEXT NOT NULL DEFAULT '',
  posted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE UNIQUE INDEX IF NOT EXISTS jobs_source_company_ext ON jobs (source, company_name, ext_id);
CREATE INDEX IF NOT EXISTS jobs_created_idx ON jobs (created_at DESC);
CREATE INDEX IF NOT EXISTS jobs_posted_idx ON jobs (posted_at DESC NULLS LAST);

CREATE TABLE IF NOT EXISTS user_job_status (
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  job_id INTEGER NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'new' CHECK (status IN ('new','reviewing','applied','interviewing','offer','rejected','skipped')),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, job_id)
);

CREATE TABLE IF NOT EXISTS digest_log (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  sent_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  job_count INTEGER NOT NULL DEFAULT 0
);

-- Seed: verified companies from the v1 pipeline
INSERT INTO companies (name, ats, slug, tenant, host, site) VALUES
  ('Scale AI','greenhouse','scaleai',NULL,NULL,NULL),
  ('Labelbox','greenhouse','labelbox',NULL,NULL,NULL),
  ('Snorkel AI','greenhouse','snorkelai',NULL,NULL,NULL),
  ('SuperAnnotate','lever','superannotate',NULL,NULL,NULL),
  ('Surge AI','ashby','surge-ai',NULL,NULL,NULL),
  ('Mercor','ashby','mercor',NULL,NULL,NULL),
  ('Turing','greenhouse','turing',NULL,NULL,NULL),
  ('Invisible Technologies','greenhouse','invisible',NULL,NULL,NULL),
  ('Abridge','ashby','abridge',NULL,NULL,NULL),
  ('Innovaccer','greenhouse','innovaccer',NULL,NULL,NULL),
  ('Tempus AI','greenhouse','tempus',NULL,NULL,NULL),
  ('Athenahealth','workday',NULL,'athenahealth','wd1','External'),
  ('Mass General Brigham','workday',NULL,'massgeneralbrigham','wd1','MGBExternal'),
  ('Cleveland Clinic','workday',NULL,'ccf','wd1','ClevelandClinicCareers')
ON CONFLICT (name) DO NOTHING;
