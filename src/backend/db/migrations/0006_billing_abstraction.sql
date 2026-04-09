-- Billing abstraction layer
-- Keeps provider-specific billing state outside the shops table so providers
-- can be swapped without changing business-facing shop records.

create table if not exists billing_customers (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null references shops(id) on delete cascade,
  provider text not null,
  provider_customer_id text not null,
  email text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint billing_customers_provider_check check (provider in ('paddle', 'stripe', 'manual'))
);

create unique index if not exists idx_billing_customers_provider_customer
  on billing_customers(provider, provider_customer_id);
create index if not exists idx_billing_customers_shop_id
  on billing_customers(shop_id);

create table if not exists billing_subscriptions (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null references shops(id) on delete cascade,
  provider text not null,
  provider_subscription_id text not null,
  provider_customer_id text,
  plan text not null,
  status text not null,
  interval text not null default 'month',
  currency text not null default 'USD',
  amount numeric(12,2) not null default 0,
  cancel_at_period_end boolean not null default false,
  current_period_start timestamptz,
  current_period_end timestamptz,
  trial_ends_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint billing_subscriptions_provider_check check (provider in ('paddle', 'stripe', 'manual')),
  constraint billing_subscriptions_plan_check check (plan in ('starter', 'professional', 'enterprise')),
  constraint billing_subscriptions_status_check check (
    status in ('trialing', 'active', 'past_due', 'canceled', 'incomplete', 'paused', 'unknown')
  ),
  constraint billing_subscriptions_interval_check check (interval in ('month', 'year'))
);

create unique index if not exists idx_billing_subscriptions_provider_subscription
  on billing_subscriptions(provider, provider_subscription_id);
create index if not exists idx_billing_subscriptions_shop_id
  on billing_subscriptions(shop_id);
create index if not exists idx_billing_subscriptions_status
  on billing_subscriptions(status);
