-- Add country_code to shops for country-aware behavior (phone normalization,
-- Telnyx provisioning, SMS sender selection, timezone defaults).
-- Defaults to 'US' so all existing shops retain current behavior.

ALTER TABLE shops
  ADD COLUMN IF NOT EXISTS country_code text NOT NULL DEFAULT 'US';

-- Backfill: derive from forwarding_country where already set (stored as lowercase 'au', 'gb', etc.)
UPDATE shops
SET country_code = UPPER(forwarding_country)
WHERE forwarding_country IS NOT NULL
  AND UPPER(forwarding_country) IN ('AU', 'GB', 'CA', 'NZ', 'IE')
  AND country_code = 'US';
