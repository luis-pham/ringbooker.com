ALTER TABLE shops
ADD COLUMN IF NOT EXISTS setup_method
  TEXT CHECK (setup_method IN ('forward','new_number'));

ALTER TABLE shops
ADD COLUMN IF NOT EXISTS forwarding_type
  TEXT CHECK (forwarding_type IN (
    'no_answer','all','busy','unreachable'))
  DEFAULT 'no_answer';

ALTER TABLE shops
ADD COLUMN IF NOT EXISTS forwarding_carrier TEXT;

ALTER TABLE shops
ADD COLUMN IF NOT EXISTS forwarding_country TEXT
  DEFAULT 'us';

ALTER TABLE shops
ADD COLUMN IF NOT EXISTS telnyx_number TEXT;
