-- Phase 5 (PR2): per-tab role scope on keywords.
-- Existing keywords default to 'tracked'; users add 'global' roles via the
-- roles manager in Settings. When a user has no 'global' keywords, the Global
-- tab mirrors their 'tracked' roles (handled in the radar query).

ALTER TABLE user_keywords ADD COLUMN IF NOT EXISTS scope TEXT NOT NULL DEFAULT 'tracked';  -- 'tracked' | 'global'
