-- Manual commercial approval gate for Custom / Enterprise go-live.

ALTER TABLE shop_access_states
  ADD COLUMN IF NOT EXISTS commercial_go_live_approved_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS commercial_go_live_approved_by TEXT,
  ADD COLUMN IF NOT EXISTS commercial_go_live_approval_note TEXT;

CREATE INDEX IF NOT EXISTS idx_shop_access_states_commercial_approval
  ON shop_access_states (commercial_go_live_approved_at)
  WHERE commercial_go_live_approved_at IS NOT NULL;
