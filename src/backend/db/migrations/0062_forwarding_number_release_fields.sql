ALTER TABLE shops
ADD COLUMN IF NOT EXISTS forwarding_number_provisioned_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS forwarding_number_released_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS forwarding_number_release_reason TEXT;
