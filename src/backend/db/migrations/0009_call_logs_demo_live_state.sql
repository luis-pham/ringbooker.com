alter table public.call_logs
add column if not exists demo_live_state text;

create index if not exists idx_call_logs_demo_live_state on public.call_logs(demo_live_state);
