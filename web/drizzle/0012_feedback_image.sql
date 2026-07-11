-- Screenshot attachment for the feedback widget. Stored as base64 text
-- (client-side downscaled to keep this small) rather than blob storage —
-- feedback volume is low, no need for a new storage dependency yet.
ALTER TABLE feedback ADD COLUMN IF NOT EXISTS image_b64 TEXT;
ALTER TABLE feedback ADD COLUMN IF NOT EXISTS image_mime TEXT;
