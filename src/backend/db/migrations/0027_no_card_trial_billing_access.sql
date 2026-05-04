-- Production no-card trial billing/access state.
-- This migration extends the provider-neutral billing model without deleting existing data.

ALTER TABLE billing_customers
  ALTER COLUMN provider_customer_id DROP NOT NULL;

ALTER TABLE billing_customers
  ADD COLUMN IF NOT EXISTS name TEXT,
  ADD COLUMN IF NOT EXISTS metadata JSONB NOT NULL DEFAULT '{}'::jsonb;

DO $$
BEGIN
  ALTER TABLE billing_customers DROP CONSTRAINT IF EXISTS billing_customers_provider_check;
  ALTER TABLE billing_customers
    ADD CONSTRAINT billing_customers_provider_check CHECK (provider IN ('internal', 'paddle', 'stripe', 'manual'));
END $$;

DROP INDEX IF EXISTS idx_billing_customers_provider_customer;
CREATE UNIQUE INDEX IF NOT EXISTS idx_billing_customers_provider_customer
  ON billing_customers(provider, provider_customer_id)
  WHERE provider_customer_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_billing_customers_shop_provider
  ON billing_customers(shop_id, provider);

ALTER TABLE billing_subscriptions
  ALTER COLUMN provider_subscription_id DROP NOT NULL;

ALTER TABLE billing_subscriptions
  ADD COLUMN IF NOT EXISTS provider_price_id TEXT,
  ADD COLUMN IF NOT EXISTS provider_product_id TEXT,
  ADD COLUMN IF NOT EXISTS amount_cents INTEGER,
  ADD COLUMN IF NOT EXISTS trial_started_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS trial_expired_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS canceled_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS paused_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS payment_method_status TEXT NOT NULL DEFAULT 'none',
  ADD COLUMN IF NOT EXISTS payment_method_added_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS activated_at TIMESTAMPTZ;

DO $$
BEGIN
  ALTER TABLE billing_subscriptions DROP CONSTRAINT IF EXISTS billing_subscriptions_provider_check;
  ALTER TABLE billing_subscriptions
    ADD CONSTRAINT billing_subscriptions_provider_check CHECK (provider IN ('internal', 'paddle', 'stripe', 'manual'));

  ALTER TABLE billing_subscriptions DROP CONSTRAINT IF EXISTS billing_subscriptions_status_check;
  ALTER TABLE billing_subscriptions
    ADD CONSTRAINT billing_subscriptions_status_check CHECK (
      status IN ('incomplete', 'trialing', 'active', 'past_due', 'paused', 'canceled', 'trial_expired', 'unpaid', 'unknown')
    );

  ALTER TABLE billing_subscriptions DROP CONSTRAINT IF EXISTS billing_subscriptions_payment_method_status_check;
  ALTER TABLE billing_subscriptions
    ADD CONSTRAINT billing_subscriptions_payment_method_status_check CHECK (
      payment_method_status IN ('none', 'pending', 'valid', 'failed', 'unknown')
    );
END $$;

DROP INDEX IF EXISTS idx_billing_subscriptions_provider_subscription;
CREATE UNIQUE INDEX IF NOT EXISTS idx_billing_subscriptions_provider_subscription
  ON billing_subscriptions(provider, provider_subscription_id)
  WHERE provider_subscription_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_billing_subscriptions_internal_shop
  ON billing_subscriptions(shop_id, provider)
  WHERE provider = 'internal';
CREATE INDEX IF NOT EXISTS idx_billing_subscriptions_trial_expiry
  ON billing_subscriptions(status, trial_ends_at)
  WHERE status = 'trialing';

CREATE TABLE IF NOT EXISTS shop_access_states (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id UUID NOT NULL UNIQUE REFERENCES shops(id) ON DELETE CASCADE,
  live_calls_enabled BOOLEAN NOT NULL DEFAULT false,
  go_live_at TIMESTAMPTZ,
  live_calls_paused_reason TEXT,
  live_calls_paused_at TIMESTAMPTZ,
  last_access_check_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_shop_access_states_live
  ON shop_access_states(live_calls_enabled);

CREATE TABLE IF NOT EXISTS test_call_attempts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id UUID NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth_users(id) ON DELETE SET NULL,
  type TEXT NOT NULL CHECK (type IN ('outbound_call_me', 'inbound_test_number', 'demo_vertical')),
  status TEXT NOT NULL CHECK (status IN ('requested', 'started', 'completed', 'failed', 'canceled')),
  destination_phone TEXT,
  source_number TEXT,
  test_number_id TEXT,
  transcript_id TEXT,
  call_summary_id TEXT,
  duration_seconds INTEGER,
  error_reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_test_call_attempts_shop_created
  ON test_call_attempts(shop_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_test_call_attempts_shop_status
  ON test_call_attempts(shop_id, status);

CREATE TABLE IF NOT EXISTS billing_notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id UUID NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
  subscription_id UUID REFERENCES billing_subscriptions(id) ON DELETE SET NULL,
  type TEXT NOT NULL CHECK (
    type IN (
      'trial_started',
      'trial_ends_7_days',
      'trial_ends_3_days',
      'trial_ends_1_day',
      'trial_ended',
      'payment_method_added',
      'subscription_active',
      'payment_failed',
      'live_answering_enabled'
    )
  ),
  channel TEXT NOT NULL CHECK (channel IN ('email', 'app')),
  sent_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_billing_notifications_unique
  ON billing_notifications(shop_id, type, channel, COALESCE(subscription_id, '00000000-0000-0000-0000-000000000000'::uuid));
