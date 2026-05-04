-- Manual backfill for launch audit: run only after confirming target shops.
--
-- Goal: Starter shops must not keep Professional-only SMS automation enabled.
-- This does not touch Professional or Enterprise shops.

BEGIN;

UPDATE shops
SET
  allow_transfers = false,
  send_reminder_sms = false,
  send_review_request_sms = false
WHERE plan = 'starter'
  AND (
    allow_transfers IS TRUE
    OR
    send_reminder_sms IS TRUE
    OR send_review_request_sms IS TRUE
  );

-- Review affected rows before COMMIT when running interactively.
-- ROLLBACK;
COMMIT;
