-- Pending forwarding connectivity tests (inbound call to shop telnyx_number proves forwarding).

CREATE TABLE IF NOT EXISTS forwarding_test_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id UUID NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
  status TEXT NOT NULL CHECK (status IN ('pending', 'passed', 'expired', 'failed')),
  forwarding_number TEXT NOT NULL,
  expected_business_phone TEXT,
  started_at TIMESTAMPTZ NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  passed_at TIMESTAMPTZ,
  inbound_call_session_id TEXT,
  inbound_call_control_id TEXT,
  caller_phone TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_forwarding_test_sessions_shop_created
  ON forwarding_test_sessions(shop_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_forwarding_test_sessions_shop_pending_expires
  ON forwarding_test_sessions(shop_id, expires_at DESC)
  WHERE status = 'pending';
