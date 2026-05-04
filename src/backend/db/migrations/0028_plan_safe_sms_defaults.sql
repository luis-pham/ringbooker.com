-- Keep new shops Starter-safe by default. Existing rows are not backfilled here.
ALTER TABLE shops
  ALTER COLUMN allow_transfers SET DEFAULT false,
  ALTER COLUMN send_reminder_sms SET DEFAULT false,
  ALTER COLUMN send_review_request_sms SET DEFAULT false;
