alter table bookings
  drop constraint if exists bookings_status_check;

alter table bookings
  add constraint bookings_status_check check (
    status in (
      'pending',
      'captured',
      'link_sent',
      'confirmed',
      'reminder_sent',
      'cancel_link_sent',
      'cancelled',
      'rescheduled',
      'completed',
      'no_show'
    )
  );

create index if not exists idx_bookings_shop_status_created_at
  on bookings(shop_id, status, created_at desc);

create index if not exists idx_bookings_call_log_id
  on bookings(call_log_id)
  where call_log_id is not null;

create index if not exists idx_outbound_messages_booking_id
  on outbound_messages(booking_id, created_at)
  where booking_id is not null;
