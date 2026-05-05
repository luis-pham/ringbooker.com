ALTER TABLE shops
ADD COLUMN IF NOT EXISTS forwarding_number_status TEXT
  CHECK (forwarding_number_status IN ('none', 'provisioning', 'provisioned', 'failed'))
  DEFAULT 'none';

ALTER TABLE shops
ADD COLUMN IF NOT EXISTS forwarding_number_provisioning_started_at TIMESTAMPTZ;

ALTER TABLE shops
ADD COLUMN IF NOT EXISTS forwarding_number_provider_order_id TEXT;

ALTER TABLE shops
ADD COLUMN IF NOT EXISTS forwarding_number_last_error TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS idx_shops_telnyx_number_unique
  ON shops(telnyx_number)
  WHERE telnyx_number IS NOT NULL;
