create table if not exists shop_overage_charges (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null references shops(id),
  billing_subscription_id uuid references billing_subscriptions(id),
  period_start timestamptz not null,
  period_end timestamptz not null,
  included_callers int not null,
  captured_callers int not null,
  overage_callers int not null,
  rate_cents int not null default 25,
  amount_cents int not null,
  paddle_subscription_id text,
  paddle_transaction_id text,
  status text not null default 'pending'
    check (status in ('pending','charged','failed','skipped')),
  idempotency_key text not null unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists shop_overage_charges_shop_period_idx
  on shop_overage_charges (shop_id, period_start);

create index if not exists shop_overage_charges_idempotency_key_idx
  on shop_overage_charges (idempotency_key);

create index if not exists shop_overage_charges_pending_status_idx
  on shop_overage_charges (status)
  where status = 'pending';
