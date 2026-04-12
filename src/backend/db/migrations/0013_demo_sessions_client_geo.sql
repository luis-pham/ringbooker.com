-- Client geo captured at demo session creation (IP from edge; country from CF-IPCountry when present).

alter table public.demo_sessions
  add column if not exists client_ip text,
  add column if not exists client_country text;

create index if not exists idx_demo_sessions_created_at on public.demo_sessions (created_at desc);
