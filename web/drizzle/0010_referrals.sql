-- Referral contact tracker: personal network entries per user, matched
-- against jobs/companies via the existing norm_employer() normalizer so a
-- contact at "Databricks Inc" lights up postings filed under "Databricks".
CREATE TABLE IF NOT EXISTS referral_contacts (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  company_name TEXT NOT NULL,
  company_id INTEGER REFERENCES companies(id) ON DELETE SET NULL,
  role TEXT,
  relationship TEXT NOT NULL,
  contact_details TEXT,
  status TEXT NOT NULL DEFAULT 'not_asked',   -- not_asked | asked | referred | declined
  warmth TEXT,                                 -- warm | cold | NULL (set once asked/referred)
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS referral_contacts_user ON referral_contacts (user_id);
-- functional index so the norm_employer() match used by the radar/companies
-- queries stays fast as the contact list grows
CREATE INDEX IF NOT EXISTS referral_contacts_norm ON referral_contacts (user_id, (norm_employer(company_name)));
