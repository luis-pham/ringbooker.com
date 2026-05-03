-- Telnyx Call Control + OpenAI SIP: persist leg identifiers for handoff hangup and ops.

create table if not exists voice_call_legs (
  id uuid primary key default gen_random_uuid(),
  rb_call_id text not null,
  shop_id uuid not null references shops(id) on delete cascade,
  purpose text not null,
  call_control_id text,
  call_session_id text,
  call_leg_id text,
  parent_call_control_id text,
  parent_call_session_id text,
  status text not null default 'created',
  provider text not null default 'telnyx_call_control',
  client_state jsonb,
  metadata jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint voice_call_legs_purpose_check check (
    purpose in ('parent_caller_leg', 'openai_sip_leg', 'owner_handoff_leg')
  )
);

create unique index if not exists voice_call_legs_shop_rb_purpose_unique
  on voice_call_legs (shop_id, rb_call_id, purpose);

create unique index if not exists voice_call_legs_provider_call_control_unique
  on voice_call_legs (provider, call_control_id)
  where call_control_id is not null;

create index if not exists voice_call_legs_rb_call_id_idx on voice_call_legs (rb_call_id);
create index if not exists voice_call_legs_shop_rb_idx on voice_call_legs (shop_id, rb_call_id);
create index if not exists voice_call_legs_parent_cc_idx on voice_call_legs (parent_call_control_id);
create index if not exists voice_call_legs_purpose_status_idx on voice_call_legs (purpose, status);
create index if not exists voice_call_legs_created_at_idx on voice_call_legs (created_at);
