ALTER TABLE public.outbound_messages
  ADD COLUMN IF NOT EXISTS location_id uuid REFERENCES public.shop_locations(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS customer_id text,
  ADD COLUMN IF NOT EXISTS call_id text,
  ADD COLUMN IF NOT EXISTS job_id uuid REFERENCES public.jobs(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS message_type text,
  ADD COLUMN IF NOT EXISTS from_number text,
  ADD COLUMN IF NOT EXISTS to_number text,
  ADD COLUMN IF NOT EXISTS media_urls jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS telnyx_message_id text,
  ADD COLUMN IF NOT EXISTS telnyx_event_id text,
  ADD COLUMN IF NOT EXISTS provider_request jsonb,
  ADD COLUMN IF NOT EXISTS provider_response jsonb,
  ADD COLUMN IF NOT EXISTS provider_status_payload jsonb,
  ADD COLUMN IF NOT EXISTS error_code text,
  ADD COLUMN IF NOT EXISTS error_message text,
  ADD COLUMN IF NOT EXISTS attempts int NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_attempt_at timestamptz,
  ADD COLUMN IF NOT EXISTS submitted_at timestamptz,
  ADD COLUMN IF NOT EXISTS delivered_at timestamptz,
  ADD COLUMN IF NOT EXISTS failed_at timestamptz;

CREATE UNIQUE INDEX IF NOT EXISTS outbound_messages_telnyx_message_uid
  ON public.outbound_messages(telnyx_message_id)
  WHERE telnyx_message_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS outbound_messages_shop_created_idx
  ON public.outbound_messages(shop_id, created_at DESC);

CREATE INDEX IF NOT EXISTS outbound_messages_status_created_idx
  ON public.outbound_messages(status, created_at DESC);

CREATE INDEX IF NOT EXISTS outbound_messages_to_created_idx
  ON public.outbound_messages(to_number, created_at DESC);

CREATE INDEX IF NOT EXISTS outbound_messages_from_created_idx
  ON public.outbound_messages(from_number, created_at DESC);

CREATE INDEX IF NOT EXISTS outbound_messages_call_id_idx
  ON public.outbound_messages(call_id)
  WHERE call_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS outbound_messages_job_id_idx
  ON public.outbound_messages(job_id)
  WHERE job_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS outbound_messages_idempotency_key_uid
  ON public.outbound_messages(idempotency_key)
  WHERE idempotency_key IS NOT NULL;
