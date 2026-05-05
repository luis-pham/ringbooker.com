-- Tracks browser/direct OpenAI Realtime marketing demos for admin visibility only.
-- Does not affect production call routing or user portal.

create table if not exists public.web_demo_sessions (
  id uuid primary key default gen_random_uuid(),
  public_session_id text not null,
  request_id text unique,
  vertical_slug text,
  business_name text,
  ip_address text,
  country text,
  region text,
  city text,
  user_agent text,
  device_type text,
  browser text,
  demo_source text not null default 'direct_openai_realtime',
  status text not null default 'started',
  started_at timestamptz not null default now(),
  connected_at timestamptz,
  ended_at timestamptz,
  duration_seconds integer,
  transcript jsonb,
  summary text,
  error_code text,
  error_message text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint web_demo_sessions_status_check check (
    status in ('started', 'connected', 'completed', 'failed', 'timed_out', 'rate_limited')
  )
);

create index if not exists idx_web_demo_sessions_started_at on public.web_demo_sessions (started_at desc);
create index if not exists idx_web_demo_sessions_vertical_slug on public.web_demo_sessions (vertical_slug);
create index if not exists idx_web_demo_sessions_status on public.web_demo_sessions (status);
create index if not exists idx_web_demo_sessions_country on public.web_demo_sessions (country);
create index if not exists idx_web_demo_sessions_public_session_id on public.web_demo_sessions (public_session_id);
