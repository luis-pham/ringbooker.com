-- Lead classification for demo vs Enterprise / Custom inquiries.

ALTER TABLE public.contact_requests
  ADD COLUMN IF NOT EXISTS intent TEXT NOT NULL DEFAULT 'general' CHECK (intent IN ('demo','enterprise','sales','support','general')),
  ADD COLUMN IF NOT EXISTS lead_source TEXT,
  ADD COLUMN IF NOT EXISTS plan_interest TEXT NOT NULL DEFAULT 'unknown' CHECK (plan_interest IN ('starter','professional','enterprise','unknown')),
  ADD COLUMN IF NOT EXISTS location_count INTEGER,
  ADD COLUMN IF NOT EXISTS estimated_call_volume TEXT,
  ADD COLUMN IF NOT EXISTS booking_software TEXT,
  ADD COLUMN IF NOT EXISTS routing_needs TEXT,
  ADD COLUMN IF NOT EXISTS go_live_timeline TEXT;

CREATE INDEX IF NOT EXISTS idx_contact_requests_intent_created_at
  ON public.contact_requests (intent, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_contact_requests_plan_interest_created_at
  ON public.contact_requests (plan_interest, created_at DESC);
