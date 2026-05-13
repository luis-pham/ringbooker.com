alter table public.shops
  add column if not exists sms_owner_opted_in boolean not null default false;
