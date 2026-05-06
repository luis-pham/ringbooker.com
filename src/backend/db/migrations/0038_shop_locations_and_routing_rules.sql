-- Enterprise / Custom multi-location and routing rule support.

CREATE TABLE IF NOT EXISTS public.shop_locations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id UUID NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  address TEXT,
  timezone TEXT NOT NULL DEFAULT 'America/Los_Angeles',
  phone_number TEXT,
  telnyx_number TEXT,
  business_hours JSONB NOT NULL DEFAULT '{}'::jsonb,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_shop_locations_shop_active
  ON public.shop_locations (shop_id, active, created_at DESC);

CREATE UNIQUE INDEX IF NOT EXISTS idx_shop_locations_telnyx_number_unique
  ON public.shop_locations (telnyx_number)
  WHERE telnyx_number IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.shop_routing_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id UUID NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
  location_id UUID REFERENCES public.shop_locations(id) ON DELETE SET NULL,
  rule_type TEXT NOT NULL,
  condition_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  action_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  priority INTEGER NOT NULL DEFAULT 100,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_shop_routing_rules_shop_active_priority
  ON public.shop_routing_rules (shop_id, active, priority ASC, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_shop_routing_rules_location
  ON public.shop_routing_rules (location_id);
