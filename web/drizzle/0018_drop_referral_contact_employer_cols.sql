-- Drop the deprecated single-employer columns on referral_contacts now that
-- referral_experiences (0017) is backfilled and all reads/writes go through
-- it instead. Safe: no code references referral_contacts.company_name,
-- .role, or .company_id anymore (confirmed by repo-wide search).
ALTER TABLE referral_contacts DROP COLUMN IF EXISTS company_name;
ALTER TABLE referral_contacts DROP COLUMN IF EXISTS role;
ALTER TABLE referral_contacts DROP COLUMN IF EXISTS company_id;
