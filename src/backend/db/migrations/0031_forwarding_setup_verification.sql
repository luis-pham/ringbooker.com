-- Tracks forwarding connectivity verification separate from live_calls_enabled.

ALTER TABLE shop_access_states
  ADD COLUMN IF NOT EXISTS forwarding_setup_verified_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS forwarding_setup_verified_via TEXT;
