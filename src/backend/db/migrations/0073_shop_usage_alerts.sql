create table if not exists shop_usage_alerts (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null references shops(id),
  alert_type text not null
    check (alert_type in ('80pct_warning','100pct_overage','overage_charged')),
  period_start timestamptz not null,
  sent_at timestamptz not null default now(),
  idempotency_key text not null unique
);

create index if not exists shop_usage_alerts_shop_period_idx
  on shop_usage_alerts (shop_id, period_start);

create index if not exists shop_usage_alerts_idempotency_key_idx
  on shop_usage_alerts (idempotency_key);
