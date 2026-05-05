-- Audit mode (read-only): shop_access_states.live_calls_enabled=true AND forwarding_setup_verified_at IS NULL
--
-- Condition: live_calls_enabled = true AND forwarding_setup_verified_at IS NULL
--
-- Run against staging/production replica or psql with read-only role as appropriate.

SELECT
  sas.shop_id,
  s.name AS shop_name,
  s.phone_number,
  s.telnyx_number,
  s.plan,
  s.active,
  sas.live_calls_enabled,
  sas.go_live_at,
  sas.forwarding_setup_verified_at,
  sas.forwarding_setup_verified_via,
  sas.updated_at AS shop_access_states_updated_at
FROM shop_access_states sas
INNER JOIN shops s ON s.id = sas.shop_id
WHERE sas.live_calls_enabled = TRUE
  AND sas.forwarding_setup_verified_at IS NULL
ORDER BY sas.go_live_at NULLS LAST, s.name ASC;
