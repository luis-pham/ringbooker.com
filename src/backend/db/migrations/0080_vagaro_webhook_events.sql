create table if not exists vagaro_webhook_events (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null references shops(id) on delete cascade,
  event_type text not null,
  action text,
  payload jsonb not null,
  raw_headers jsonb,
  received_at timestamptz not null default now(),
  processed_at timestamptz,
  processing_error text
);

create index if not exists vagaro_webhook_events_shop_received_at_idx
  on vagaro_webhook_events(shop_id, received_at desc);

create index if not exists vagaro_webhook_events_shop_event_type_idx
  on vagaro_webhook_events(shop_id, event_type);

comment on table vagaro_webhook_events is
  'Raw per-shop Vagaro webhook events for live sync debugging and later async processing.';
