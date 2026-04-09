-- RingBooker production call lifecycle tables.

create table if not exists call_logs (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null references shops(id) on delete cascade,
  provider text not null default 'telnyx',
  provider_call_id text,
  room_name text,
  caller_phone text,
  destination_phone text,
  direction text not null default 'inbound',
  duration_secs int not null default 0,
  outcome text,
  transfer_attempted boolean not null default false,
  transfer_completed boolean not null default false,
  agent_joined boolean not null default false,
  human_answered boolean not null default false,
  transcript_status text not null default 'pending',
  request_id text,
  started_at timestamptz,
  ended_at timestamptz,
  created_at timestamptz not null default now(),
  constraint call_logs_direction_check check (direction in ('inbound', 'outbound')),
  constraint call_logs_outcome_check check (
    outcome in (
      'booked',
      'info_only',
      'missed',
      'transferred',
      'callback_scheduled',
      'callback_completed',
      'voicemail',
      'error'
    )
  )
);

create index if not exists idx_call_logs_shop_id on call_logs(shop_id);
create index if not exists idx_call_logs_provider_call_id on call_logs(provider_call_id);
create index if not exists idx_call_logs_created_at on call_logs(created_at);
create unique index if not exists idx_call_logs_provider_call_unique
  on call_logs(provider, provider_call_id)
  where provider_call_id is not null;

create table if not exists missed_calls (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null references shops(id) on delete cascade,
  caller_phone text not null,
  call_log_provider_call_id text,
  sms_sent boolean not null default false,
  sms_sent_at timestamptz,
  callback_requested boolean not null default false,
  dedupe_bucket timestamptz not null,
  created_at timestamptz not null default now()
);

create index if not exists idx_missed_calls_shop_id on missed_calls(shop_id);
create index if not exists idx_missed_calls_created_at on missed_calls(created_at);
create unique index if not exists idx_missed_calls_dedup_bucket
  on missed_calls(shop_id, caller_phone, dedupe_bucket);
