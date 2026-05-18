ALTER TABLE shops
ADD COLUMN IF NOT EXISTS forwarding_number_provisioned_at TIMESTAMPTZ;
