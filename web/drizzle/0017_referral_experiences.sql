-- Per-contact work history: one row per employer (current or past), replacing
-- the single company_name/role/company_id on referral_contacts. Past employers
-- now count toward the referral badge on Radar/Companies, not just the current one.
CREATE TABLE IF NOT EXISTS referral_experiences (
  id SERIAL PRIMARY KEY,
  contact_id INTEGER NOT NULL REFERENCES referral_contacts(id) ON DELETE CASCADE,
  company_name TEXT NOT NULL,
  company_id INTEGER REFERENCES companies(id) ON DELETE SET NULL,
  role TEXT,
  is_current BOOLEAN NOT NULL DEFAULT false,
  start_date TEXT,   -- freeform ("Jan 2022") — display only, no date math needed
  end_date TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS referral_experiences_contact ON referral_experiences (contact_id);
CREATE INDEX IF NOT EXISTS referral_experiences_norm ON referral_experiences ((norm_employer(company_name)));

-- Backfill: one experience row per existing contact, marked current. Idempotent
-- via the NOT EXISTS guard so re-running this migration is a no-op.
INSERT INTO referral_experiences (contact_id, company_name, company_id, role, is_current)
SELECT c.id, c.company_name, c.company_id, c.role, true
FROM referral_contacts c
WHERE NOT EXISTS (SELECT 1 FROM referral_experiences e WHERE e.contact_id = c.id);

-- New app code writes only to referral_experiences; these columns go unused
-- but stay in place (relaxed to nullable) until 0018 drops them, so the old
-- deployed app code keeps working during the migrate-before-merge window.
ALTER TABLE referral_contacts ALTER COLUMN company_name DROP NOT NULL;
