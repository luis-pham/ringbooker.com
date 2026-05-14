alter table bookings
  add column if not exists provider text,
  add column if not exists provider_status text,
  add column if not exists provider_error_reason text;

create index if not exists idx_bookings_provider
  on bookings(provider)
  where provider is not null;
