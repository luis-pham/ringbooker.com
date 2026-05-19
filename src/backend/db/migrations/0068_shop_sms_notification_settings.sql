alter table shops
  add column if not exists send_call_summary_sms boolean not null default true,
  add column if not exists owner_call_summary_sms_timing text not null default 'business_hours',
  add column if not exists send_callback_request_sms boolean not null default true,
  add column if not exists owner_callback_request_sms_timing text not null default 'always',
  add column if not exists send_daily_digest_sms boolean not null default false,
  add column if not exists owner_daily_digest_time text not null default '18:00',
  add column if not exists sms_quiet_hours_start text not null default '08:00',
  add column if not exists sms_quiet_hours_end text not null default '21:00';

alter table shops
  drop constraint if exists shops_owner_call_summary_sms_timing_check,
  add constraint shops_owner_call_summary_sms_timing_check
    check (owner_call_summary_sms_timing in ('business_hours', 'always'));

alter table shops
  drop constraint if exists shops_owner_callback_request_sms_timing_check,
  add constraint shops_owner_callback_request_sms_timing_check
    check (owner_callback_request_sms_timing in ('business_hours', 'always'));

alter table shops
  drop constraint if exists shops_owner_daily_digest_time_check,
  add constraint shops_owner_daily_digest_time_check
    check (owner_daily_digest_time ~ '^\d{2}:\d{2}$');

alter table shops
  drop constraint if exists shops_sms_quiet_hours_start_check,
  add constraint shops_sms_quiet_hours_start_check
    check (sms_quiet_hours_start ~ '^\d{2}:\d{2}$');

alter table shops
  drop constraint if exists shops_sms_quiet_hours_end_check,
  add constraint shops_sms_quiet_hours_end_check
    check (sms_quiet_hours_end ~ '^\d{2}:\d{2}$');
