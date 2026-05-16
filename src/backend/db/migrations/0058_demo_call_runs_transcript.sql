-- Stores the captured conversation transcript for phone demo calls so it is viewable
-- in Admin → Demos. Demo calls are isolated from production `call_logs`; their transcript
-- lives on the demo_call_runs row instead. Written by the OpenAI SIP sideband.

alter table public.demo_call_runs
  add column if not exists transcript jsonb,
  add column if not exists transcript_status text,
  add column if not exists transcript_updated_at timestamptz;
