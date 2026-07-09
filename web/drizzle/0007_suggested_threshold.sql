ALTER TABLE users ADD COLUMN IF NOT EXISTS suggested_threshold integer NOT NULL DEFAULT 35;
