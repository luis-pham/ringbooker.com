alter table public.call_logs
  add column if not exists recording_status text not null default 'not_requested',
  add column if not exists recording_provider text,
  add column if not exists recording_id text,
  add column if not exists recording_storage_key text,
  add column if not exists recording_format text,
  add column if not exists recording_duration_ms int,
  add column if not exists recording_started_at timestamptz,
  add column if not exists recording_ended_at timestamptz,
  add column if not exists recording_error text;

alter table public.call_logs
  drop constraint if exists call_logs_recording_status_check;

alter table public.call_logs
  add constraint call_logs_recording_status_check check (
    recording_status in ('not_requested', 'pending', 'available', 'failed', 'deleted')
  );

create index if not exists idx_call_logs_recording_id
  on public.call_logs(recording_id)
  where recording_id is not null;

create index if not exists idx_call_logs_recording_status
  on public.call_logs(recording_status)
  where recording_status in ('pending', 'failed');
