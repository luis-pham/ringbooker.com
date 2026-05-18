-- Add handoff availability schedule to shops.
-- handoff_availability controls when live call transfers are offered:
--   'business_hours' (default) — only during the shop's configured business hours
--   'always'                   — 24/7, no time restriction
--   'custom'                   — use handoff_custom_hours schedule instead
-- handoff_custom_hours uses the same jsonb format as shop.hours.

ALTER TABLE shops
  ADD COLUMN IF NOT EXISTS handoff_availability text NOT NULL DEFAULT 'business_hours',
  ADD COLUMN IF NOT EXISTS handoff_custom_hours jsonb NULL;
