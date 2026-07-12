-- Per-user digest source filter. Which job boards a user wants their daily
-- digest email drawn from. Defaults to all five so existing behavior is
-- unchanged; a user can narrow it in Settings. Stored as a text[] rather than
-- a bridge table since it's a tiny fixed enum and always read whole.
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS digest_sources TEXT[]
  NOT NULL DEFAULT ARRAY['greenhouse','lever','ashby','workday','linkedin'];
