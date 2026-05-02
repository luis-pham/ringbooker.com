-- Human handoff state (Telnyx Call Control + OpenAI SIP direct). See handoff-orchestrator.ts.

create table if not exists handoff_sessions (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null references shops(id) on delete cascade,
  rb_call_id text not null,
  idempotency_key text not null,
  parent_call_control_id text not null,
  parent_call_session_id text,
  owner_call_control_id text,
  openai_call_id text,
  owner_phone text not null,
  caller_phone text,
  caller_name text,
  reason text not null,
  urgency text not null,
  summary text not null,
  service_requested text,
  preferred_time text,
  status text not null,
  failed_reason text,
  error_message text,
  dtmf_retry_count int not null default 0,
  fallback_sms_sent boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  completed_at timestamptz,
  constraint handoff_sessions_idempotency_unique unique (shop_id, idempotency_key),
  constraint handoff_sessions_status_check check (
    status in (
      'handoff_requested',
      'owner_dialing',
      'owner_ringing',
      'owner_answered',
      'owner_screening_playing',
      'owner_dtmf_waiting',
      'owner_accepted',
      'bridge_requested',
      'bridged',
      'handoff_completed',
      'handoff_failed_no_parent_call',
      'handoff_failed_no_owner_phone',
      'handoff_failed_not_allowed',
      'handoff_failed_owner_no_answer',
      'handoff_failed_owner_busy',
      'handoff_failed_owner_rejected',
      'handoff_failed_owner_timeout',
      'handoff_failed_dtmf_timeout',
      'handoff_failed_dtmf_rejected',
      'handoff_failed_bridge_error',
      'handoff_failed_caller_hung_up',
      'handoff_failed_duplicate'
    )
  )
);

create index if not exists idx_handoff_sessions_shop_rb on handoff_sessions(shop_id, rb_call_id);
create index if not exists idx_handoff_sessions_parent_cc on handoff_sessions(parent_call_control_id);
create index if not exists idx_handoff_sessions_owner_cc on handoff_sessions(owner_call_control_id);
create index if not exists idx_handoff_sessions_status on handoff_sessions(status);
