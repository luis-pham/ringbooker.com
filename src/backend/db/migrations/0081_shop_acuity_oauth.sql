alter table shops
  add column if not exists acuity_access_token_encrypted text,
  add column if not exists acuity_user_id text,
  add column if not exists acuity_connection_status text not null default 'disconnected';

alter table shops
  drop constraint if exists shops_acuity_connection_status_check;

alter table shops
  add constraint shops_acuity_connection_status_check
  check (acuity_connection_status in ('disconnected', 'connected', 'error'));

comment on column shops.acuity_access_token_encrypted is
  'Encrypted Acuity OAuth2 bearer token. Never expose through API responses.';

comment on column shops.acuity_user_id is
  'Best-effort Acuity account identity discovered after OAuth connect.';

comment on column shops.acuity_connection_status is
  'Acuity OAuth connection lifecycle status.';
