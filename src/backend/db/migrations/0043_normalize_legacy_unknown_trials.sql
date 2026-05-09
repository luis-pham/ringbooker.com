-- Normalize legacy self-serve no-card trial rows that were accidentally
-- overwritten by non-subscription Paddle transaction events.
-- These rows have no Paddle customer/subscription IDs and should remain
-- internal trials until a verified Paddle subscription webhook arrives.

UPDATE billing_subscriptions
SET
  provider = 'internal',
  status = CASE
    WHEN trial_ends_at IS NOT NULL AND trial_ends_at > now() THEN 'trialing'
    ELSE 'trial_expired'
  END,
  payment_method_status = 'none',
  metadata = COALESCE(metadata, '{}'::jsonb) || jsonb_build_object(
    'normalized_from_unknown_trial', true,
    'normalized_by_migration', '0043_normalize_legacy_unknown_trials',
    'normalized_at', now()
  ),
  updated_at = now()
WHERE provider = 'paddle'
  AND provider_subscription_id IS NULL
  AND provider_customer_id IS NULL
  AND plan IN ('starter', 'professional')
  AND status = 'unknown'
  AND payment_method_status = 'unknown'
  AND trial_started_at IS NOT NULL
  AND trial_ends_at IS NOT NULL;
