alter table bookings
  add column if not exists matched_service_id uuid null references shop_services(id) on delete set null,
  add column if not exists matched_service_confidence numeric null;

create index if not exists idx_bookings_matched_service_id
  on bookings(matched_service_id)
  where matched_service_id is not null;
