-- Backfill only for shops that were already live before forwarding verification fields existed.
-- Prefer running `audit-shop-access-live-without-forwarding-verification.sql` first.
--
-- Safety:
-- - Does NOT update rows with live_calls_enabled = false.
-- - Only updates when forwarding_setup_verified_at IS NULL.
-- - Requires non-empty shops.telnyx_number (shops unlikely to receive live Telnyx inbound without it).
-- - Sets forwarding_setup_verified_via = 'legacy_live' (accepted legacy value; distinct from user-driven manual_confirmation).
--
-- Do not run from app startup.
-- Default is ROLLBACK for safety. Review SELECT output, then manually switch to COMMIT.

BEGIN;

-- Before: rows that match update predicate
SELECT
  sas.shop_id,
  s.name AS shop_name,
  s.telnyx_number,
  sas.go_live_at,
  sas.forwarding_setup_verified_at,
  sas.forwarding_setup_verified_via
FROM shop_access_states sas
INNER JOIN shops s ON s.id = sas.shop_id
WHERE sas.live_calls_enabled = TRUE
  AND sas.forwarding_setup_verified_at IS NULL
  AND s.telnyx_number IS NOT NULL
  AND length(trim(s.telnyx_number)) > 0;

UPDATE shop_access_states sas
SET
  forwarding_setup_verified_at = COALESCE(sas.go_live_at, sas.updated_at, now()),
  forwarding_setup_verified_via = 'legacy_live',
  updated_at = now()
FROM shops s
WHERE sas.shop_id = s.id
  AND sas.live_calls_enabled = TRUE
  AND sas.forwarding_setup_verified_at IS NULL
  AND s.telnyx_number IS NOT NULL
  AND length(trim(s.telnyx_number)) > 0;

-- After: should return no rows if backfill covered all eligible legacy-live shops
SELECT
  sas.shop_id,
  s.name AS shop_name,
  s.telnyx_number,
  sas.go_live_at,
  sas.forwarding_setup_verified_at,
  sas.forwarding_setup_verified_via
FROM shop_access_states sas
INNER JOIN shops s ON s.id = sas.shop_id
WHERE sas.live_calls_enabled = TRUE
  AND sas.forwarding_setup_verified_at IS NULL;

-- Interactive: verify counts, then choose one:
ROLLBACK;
-- COMMIT;
