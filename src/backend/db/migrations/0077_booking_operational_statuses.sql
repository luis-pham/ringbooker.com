alter table bookings
  drop constraint if exists bookings_status_check;

alter table bookings
  add constraint bookings_status_check check (
    status in (
      'pending',
      'captured',
      'link_sent',
      'contacted',
      'confirmed',
      'reminder_sent',
      'cancel_link_sent',
      'declined',
      'cancelled',
      'rescheduled',
      'completed',
      'no_show'
    )
  );
