-- 0013: Region country filter — supersedes the us_only boolean.
-- 'us' (default): hide confidently-international jobs. 'intl': only international. 'all': no country filter.
-- ADD COLUMN with DEFAULT 'us' backfills every existing row to US (the app's audience is
-- US-role seekers). us_only is retained for the deploy rollout window and can be dropped
-- in a later cleanup migration.
ALTER TABLE users ADD COLUMN IF NOT EXISTS region TEXT NOT NULL DEFAULT 'us';
