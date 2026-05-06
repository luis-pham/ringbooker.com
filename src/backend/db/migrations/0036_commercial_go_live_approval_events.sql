-- Audit history for Custom / Enterprise commercial go-live approvals.

CREATE TABLE IF NOT EXISTS commercial_go_live_approval_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id TEXT NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL CHECK (event_type IN ('approved')),
  actor_email TEXT NOT NULL,
  note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_commercial_go_live_approval_events_shop_created
  ON commercial_go_live_approval_events (shop_id, created_at DESC);
