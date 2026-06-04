-- Link a browser demo session back to a sales prepared demo (/try/<slug>) so the
-- session lifecycle (play/progress/complete) can be reported to sales.ringbooker.com.
-- Null for ordinary public demos.

alter table public.web_demo_sessions
  add column if not exists prepared_demo_slug text;

create index if not exists idx_web_demo_sessions_prepared_demo_slug
  on public.web_demo_sessions(prepared_demo_slug)
  where prepared_demo_slug is not null;

comment on column public.web_demo_sessions.prepared_demo_slug is
  'sales_prepared_demos.slug this session was started from (/try/<slug>); null for ordinary demos.';
