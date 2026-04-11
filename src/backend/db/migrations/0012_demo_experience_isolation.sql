-- Demo experience tables are intentionally separated from production shops/calls.
-- Public web demos are outbound-only and should never drive inbound routing or production analytics.

create table if not exists public.demo_vertical_templates (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  display_name text not null,
  business_type text not null,
  prompt_set jsonb not null default '[]'::jsonb,
  sms_template text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.demo_persona_profiles (
  id uuid primary key default gen_random_uuid(),
  vertical_template_id uuid references public.demo_vertical_templates(id) on delete cascade,
  vertical_slug text not null,
  persona_name text not null,
  tone text not null,
  guardrails jsonb not null default '[]'::jsonb,
  prompt_rules jsonb not null default '[]'::jsonb,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.demo_sessions (
  id uuid primary key default gen_random_uuid(),
  public_session_id text not null,
  vertical_slug text not null,
  demo_mode text not null default 'quick',
  source text not null default 'vertical_demo_page',
  callback_phone text not null,
  status text not null default 'created',
  expires_at timestamptz not null default now() + interval '7 days',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint demo_sessions_mode_check check (demo_mode in ('quick', 'advanced', 'free-form')),
  constraint demo_sessions_status_check check (status in ('created', 'queued', 'dialing', 'live', 'completed', 'missed', 'failed', 'expired'))
);

create table if not exists public.demo_business_configs (
  id uuid primary key default gen_random_uuid(),
  demo_session_id uuid not null references public.demo_sessions(id) on delete cascade,
  business_name text not null,
  city text,
  business_hours jsonb not null default '{}'::jsonb,
  staff jsonb not null default '[]'::jsonb,
  notes text,
  system_prompt text,
  created_at timestamptz not null default now()
);

create table if not exists public.demo_services (
  id uuid primary key default gen_random_uuid(),
  demo_session_id uuid not null references public.demo_sessions(id) on delete cascade,
  category text not null,
  name text not null,
  price numeric(10,2),
  duration text,
  enabled boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.demo_call_runs (
  id uuid primary key default gen_random_uuid(),
  demo_session_id uuid references public.demo_sessions(id) on delete set null,
  request_id text not null unique,
  provider text not null default 'marketing_demo',
  provider_call_id text,
  room_name text,
  status text not null default 'queued',
  started_at timestamptz,
  connected_at timestamptz,
  ended_at timestamptz,
  outcome text,
  created_at timestamptz not null default now(),
  constraint demo_call_runs_status_check check (status in ('queued', 'dialing', 'live', 'completed', 'missed', 'failed'))
);

create table if not exists public.demo_sms_runs (
  id uuid primary key default gen_random_uuid(),
  demo_session_id uuid references public.demo_sessions(id) on delete set null,
  demo_call_run_id uuid references public.demo_call_runs(id) on delete set null,
  to_phone text not null,
  template_key text not null,
  preview_body text not null,
  sent_at timestamptz,
  provider_message_id text,
  created_at timestamptz not null default now()
);

create table if not exists public.demo_status_events (
  id uuid primary key default gen_random_uuid(),
  demo_session_id uuid references public.demo_sessions(id) on delete cascade,
  request_id text,
  event_type text not null,
  payload jsonb not null default '{}'::jsonb,
  occurred_at timestamptz not null default now()
);

create index if not exists idx_demo_sessions_public_session_id on public.demo_sessions(public_session_id);
create index if not exists idx_demo_sessions_vertical_status on public.demo_sessions(vertical_slug, status);
create index if not exists idx_demo_sessions_expires_at on public.demo_sessions(expires_at);
create index if not exists idx_demo_persona_profiles_vertical_active on public.demo_persona_profiles(vertical_slug, active);
create index if not exists idx_demo_business_configs_session_id on public.demo_business_configs(demo_session_id);
create index if not exists idx_demo_services_session_id on public.demo_services(demo_session_id);
create index if not exists idx_demo_call_runs_request_id on public.demo_call_runs(request_id);
create index if not exists idx_demo_call_runs_session_status on public.demo_call_runs(demo_session_id, status);
create index if not exists idx_demo_status_events_session_id on public.demo_status_events(demo_session_id);
