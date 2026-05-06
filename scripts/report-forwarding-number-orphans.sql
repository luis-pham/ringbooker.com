-- Report-only: forwarding number provisioning failures that may need operator review.
--
-- Purpose:
-- - Find shops where Telnyx provisioning appears to have produced a provider/order id,
--   but RingBooker did not persist a usable shops.telnyx_number.
-- - This script does NOT release numbers and does NOT update data.
-- - Review Telnyx dashboard/API before manual cleanup, because app-level compensation
--   may already have released the number after a DB persist failure.

SELECT
  s.id AS shop_id,
  s.name AS shop_name,
  s.plan,
  s.active,
  s.phone_number AS business_phone,
  s.telnyx_number,
  s.forwarding_number_status,
  s.forwarding_number_provider_order_id,
  s.forwarding_number_provisioning_started_at,
  s.forwarding_number_last_error,
  sas.live_calls_enabled,
  sas.forwarding_setup_verified_at,
  sas.forwarding_setup_verified_via,
  sas.commercial_go_live_approved_at
FROM shops s
LEFT JOIN shop_access_states sas ON sas.shop_id = s.id
WHERE s.forwarding_number_status = 'failed'
  AND s.forwarding_number_provider_order_id IS NOT NULL
  AND (s.telnyx_number IS NULL OR length(trim(s.telnyx_number)) = 0)
ORDER BY s.forwarding_number_provisioning_started_at NULLS LAST, s.name ASC;
