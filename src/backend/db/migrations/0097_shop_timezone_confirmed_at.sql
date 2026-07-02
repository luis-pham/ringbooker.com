alter table shops
  add column if not exists timezone_confirmed_at timestamptz;

comment on column shops.timezone_confirmed_at is
  'Set only when the owner actually confirmed/changed timezone (onboarding profile review or Settings save) -- distinct from timezone merely holding the signup-time default. Null means unconfirmed.';
