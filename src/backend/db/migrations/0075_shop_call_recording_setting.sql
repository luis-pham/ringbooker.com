alter table public.shops
  add column if not exists call_recording_enabled boolean not null default false;
