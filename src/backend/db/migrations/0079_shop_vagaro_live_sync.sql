alter table shops
  add column if not exists vagaro_mode text not null default 'link_only',
  add column if not exists vagaro_booking_url text,
  add column if not exists vagaro_webhook_token text,
  add column if not exists vagaro_client_id text,
  add column if not exists vagaro_client_secret_encrypted text,
  add column if not exists vagaro_region text,
  add column if not exists vagaro_connection_status text not null default 'disconnected',
  add column if not exists vagaro_fallback_url text,
  add column if not exists vagaro_business_id text,
  add column if not exists vagaro_business_name text,
  add column if not exists vagaro_location_id text,
  add column if not exists vagaro_locations jsonb;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'shops_vagaro_mode_check'
  ) then
    alter table shops
      add constraint shops_vagaro_mode_check
      check (vagaro_mode in ('link_only', 'live_sync'));
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'shops_vagaro_connection_status_check'
  ) then
    alter table shops
      add constraint shops_vagaro_connection_status_check
      check (vagaro_connection_status in ('disconnected', 'pending', 'connected', 'error'));
  end if;
end $$;

create unique index if not exists shops_vagaro_webhook_token_unique
  on shops(vagaro_webhook_token)
  where vagaro_webhook_token is not null;

comment on column shops.vagaro_mode is
  'Vagaro integration mode: link_only sends a booking URL by SMS; live_sync enables read availability/webhook sync.';
comment on column shops.vagaro_webhook_token is
  'Per-shop Vagaro webhook endpoint token. Treat as a secret; do not expose via GET responses.';
comment on column shops.vagaro_client_secret_encrypted is
  'Encrypted Vagaro client secret key for live sync.';
