-- Usage limit tracking and active live-call concurrency slots.

ALTER TABLE public.call_logs
ADD COLUMN IF NOT EXISTS is_captured_caller BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE public.call_logs
ADD COLUMN IF NOT EXISTS captured_caller_reason TEXT;

ALTER TABLE public.call_logs
ADD COLUMN IF NOT EXISTS captured_at TIMESTAMPTZ;

ALTER TABLE public.call_logs
ADD COLUMN IF NOT EXISTS duration_secs INTEGER NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_call_logs_shop_captured_month
  ON public.call_logs (shop_id, captured_at DESC)
  WHERE is_captured_caller = TRUE;

CREATE INDEX IF NOT EXISTS idx_call_logs_shop_started_duration
  ON public.call_logs (shop_id, started_at DESC)
  WHERE duration_secs > 0;

CREATE TABLE IF NOT EXISTS public.shop_active_call_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id UUID NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
  call_session_id TEXT NOT NULL,
  provider TEXT NOT NULL,
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL,
  released_at TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','released','expired')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_shop_active_call_sessions_active_call
  ON public.shop_active_call_sessions (provider, call_session_id)
  WHERE released_at IS NULL AND status = 'active';

CREATE INDEX IF NOT EXISTS idx_shop_active_call_sessions_shop_active
  ON public.shop_active_call_sessions (shop_id, expires_at)
  WHERE released_at IS NULL AND status = 'active';

ALTER TABLE public.commercial_accounts
ADD COLUMN IF NOT EXISTS included_captured_callers INTEGER;

ALTER TABLE public.commercial_accounts
ADD COLUMN IF NOT EXISTS max_concurrent_live_calls INTEGER;

ALTER TABLE public.commercial_accounts
ADD COLUMN IF NOT EXISTS max_call_duration_seconds INTEGER;

CREATE OR REPLACE FUNCTION public.acquire_shop_active_call_slot(
  p_shop_id UUID,
  p_call_session_id TEXT,
  p_provider TEXT,
  p_limit INTEGER,
  p_started_at TIMESTAMPTZ,
  p_expires_at TIMESTAMPTZ
)
RETURNS TABLE(acquired BOOLEAN, active_count INTEGER, reason TEXT)
LANGUAGE plpgsql
AS $$
DECLARE
  v_count INTEGER;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtext(p_shop_id::TEXT));

  UPDATE public.shop_active_call_sessions
     SET status = 'expired', released_at = COALESCE(released_at, now()), updated_at = now()
   WHERE shop_id = p_shop_id
     AND status = 'active'
     AND released_at IS NULL
     AND expires_at <= now();

  IF EXISTS (
    SELECT 1 FROM public.shop_active_call_sessions
     WHERE provider = p_provider
       AND call_session_id = p_call_session_id
       AND status = 'active'
       AND released_at IS NULL
       AND expires_at > now()
  ) THEN
    SELECT count(*) INTO v_count
      FROM public.shop_active_call_sessions
     WHERE shop_id = p_shop_id AND status = 'active' AND released_at IS NULL AND expires_at > now();
    RETURN QUERY SELECT TRUE, v_count, 'duplicate_active';
    RETURN;
  END IF;

  SELECT count(*) INTO v_count
    FROM public.shop_active_call_sessions
   WHERE shop_id = p_shop_id AND status = 'active' AND released_at IS NULL AND expires_at > now();

  IF v_count >= p_limit THEN
    RETURN QUERY SELECT FALSE, v_count, 'limit_reached';
    RETURN;
  END IF;

  INSERT INTO public.shop_active_call_sessions (shop_id, call_session_id, provider, started_at, expires_at)
  VALUES (p_shop_id, p_call_session_id, p_provider, p_started_at, p_expires_at);

  RETURN QUERY SELECT TRUE, v_count + 1, NULL::TEXT;
END;
$$;
