-- Add notification types used by billing lifecycle jobs but missing from the
-- billing_notifications type constraint.
-- Safe to run repeatedly.

ALTER TABLE billing_notifications
  DROP CONSTRAINT IF EXISTS billing_notifications_type_check;

ALTER TABLE billing_notifications
  ADD CONSTRAINT billing_notifications_type_check CHECK (
    type IN (
      'trial_started',
      'trial_ends_7_days',
      'trial_ends_3_days',
      'trial_ends_1_day',
      'trial_ended',
      'finish_onboarding_reminder_1',
      'finish_onboarding_reminder_2',
      'add_payment_method_go_live',
      'payment_method_added',
      'forwarding_number_ready',
      'forwarding_number_failed_user',
      'forwarding_number_failed_internal',
      'forwarding_not_verified_24h',
      'forwarding_not_verified_72h',
      'forwarding_number_abandoned_24h',
      'forwarding_number_abandoned_48h',
      'forwarding_number_released_72h',
      'forwarding_verified',
      'subscription_active',
      'payment_failed',
      'live_answering_enabled',
      'live_answering_billing_paused',
      'live_answering_billing_paused_canceled',
      'live_answering_billing_paused_paused',
      'live_answering_billing_paused_past_due',
      'live_answering_billing_paused_payment_failed',
      'live_answering_billing_restored',
      'internal_paddle_alert',
      'internal_telnyx_alert',
      'internal_live_billing_blocked_alert'
    )
  );
