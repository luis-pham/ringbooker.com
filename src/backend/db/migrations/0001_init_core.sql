-- RingBooker core schema (v1 baseline)
-- Apply in Supabase SQL editor or migration pipeline.

create extension if not exists pgcrypto;

create table if not exists shops (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  brand_slug text unique,
  phone_number text unique not null,
  user_phone text not null,
  backup_phone text,
  user_name text,
  address text,
  timezone text not null default 'America/Los_Angeles',
  google_cal_id text,
  google_cal_credentials_encrypted text,
  ai_voice text default 'Aoede',
  ai_welcome_message text,
  ai_custom_instructions text,
  allow_transfers boolean not null default true,
  allow_callbacks boolean not null default true,
  send_reminder_sms boolean not null default true,
  send_review_request_sms boolean not null default true,
  send_missed_call_followup_sms boolean not null default true,
  services jsonb not null default '[]',
  hours jsonb not null default '{}',
  cancel_policy text default '2-hour cancellation policy applies.',
  promotions text,
  booking_url text,
  plan text not null default 'professional',
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint shops_plan_check check (plan in ('starter', 'professional', 'enterprise'))
);

create index if not exists idx_shops_phone_number on shops(phone_number);
create index if not exists idx_shops_active on shops(active);

create table if not exists customers (
  phone text not null,
  shop_id uuid not null references shops(id) on delete cascade,
  full_name text,
  last_service text,
  preferred_tech text,
  visit_count int not null default 0,
  notes text,
  sms_opt_out boolean not null default false,
  last_visit_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (phone, shop_id)
);

create index if not exists idx_customers_shop_id on customers(shop_id);

create table if not exists bookings (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null references shops(id) on delete cascade,
  customer_phone text not null,
  customer_name text,
  service text not null,
  tech_name text,
  datetime_utc timestamptz not null,
  timezone text not null,
  duration_min int not null default 60,
  status text not null default 'pending',
  confirmed boolean not null default false,
  reminder_24h_sent boolean not null default false,
  reminder_2h_sent boolean not null default false,
  review_request_sent boolean not null default false,
  calendar_event_id text,
  call_log_id uuid,
  call_transcript text,
  notes text,
  create_idempotency_key text unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint bookings_status_check check (status in ('pending', 'confirmed', 'cancelled', 'completed', 'no_show'))
);

create index if not exists idx_bookings_shop_id on bookings(shop_id);
create index if not exists idx_bookings_customer_phone on bookings(customer_phone);
create index if not exists idx_bookings_datetime_utc on bookings(datetime_utc);

create table if not exists callbacks (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null references shops(id) on delete cascade,
  customer_phone text not null,
  customer_name text,
  reason text not null,
  status text not null default 'queued',
  attempt_count int not null default 0,
  next_attempt_at timestamptz,
  last_attempt_at timestamptz,
  completed_at timestamptz,
  request_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint callbacks_status_check check (status in ('queued', 'dialing', 'connected', 'completed', 'failed', 'cancelled'))
);

create index if not exists idx_callbacks_shop_id on callbacks(shop_id);
create index if not exists idx_callbacks_next_attempt_at on callbacks(next_attempt_at);

create table if not exists provider_events (
  id uuid primary key default gen_random_uuid(),
  provider text not null,
  provider_event_id text not null,
  event_type text not null,
  payload_raw jsonb not null,
  received_at timestamptz not null default now(),
  processed_at timestamptz,
  processing_error text
);

create unique index if not exists idx_provider_events_unique on provider_events(provider, provider_event_id);
create index if not exists idx_provider_events_unprocessed on provider_events(processed_at) where processed_at is null;

create table if not exists jobs (
  id uuid primary key default gen_random_uuid(),
  type text not null,
  shop_id uuid references shops(id) on delete cascade,
  payload jsonb not null,
  status text not null default 'queued',
  run_at timestamptz not null default now(),
  locked_at timestamptz,
  lock_token text,
  attempts int not null default 0,
  max_attempts int not null default 5,
  last_error text,
  idempotency_key text unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint jobs_status_check check (status in ('queued', 'running', 'completed', 'failed', 'dead_letter'))
);

create index if not exists idx_jobs_run_at on jobs(status, run_at);

create table if not exists outbound_messages (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null references shops(id) on delete cascade,
  booking_id uuid references bookings(id) on delete set null,
  customer_phone text not null,
  category text not null,
  provider text not null default 'telnyx',
  provider_message_id text,
  body text not null,
  status text not null default 'queued',
  idempotency_key text unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_outbound_messages_shop_id on outbound_messages(shop_id);
create index if not exists idx_outbound_messages_booking_id on outbound_messages(booking_id);
