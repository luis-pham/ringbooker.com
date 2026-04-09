alter table public.shops
  add column if not exists ai_welcome_message text,
  add column if not exists ai_custom_instructions text,
  add column if not exists allow_transfers boolean not null default true,
  add column if not exists allow_callbacks boolean not null default true,
  add column if not exists send_reminder_sms boolean not null default true,
  add column if not exists send_review_request_sms boolean not null default true,
  add column if not exists send_missed_call_followup_sms boolean not null default true;
