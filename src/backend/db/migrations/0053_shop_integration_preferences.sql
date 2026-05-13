alter table public.shops
  add column if not exists booking_method text
    check (booking_method is null or booking_method in ('app', 'direct', 'later')),
  add column if not exists selected_integration text;
