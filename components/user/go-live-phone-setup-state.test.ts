import test from 'node:test';
import assert from 'node:assert/strict';

import { getPhoneSetupCopy, resolvePhoneSetupState } from './go-live-phone-setup-state';

test('phone setup state requires payment before forwarding number creation', () => {
  const state = resolvePhoneSetupState({
    onboardingRequired: false,
    subscriptionStatus: 'trialing',
    paymentMethodStatus: 'none',
    hasPaymentMethod: false,
  });

  assert.equal(state, 'payment_method_required');
  assert.match(getPhoneSetupCopy(state).explanation, /generate your RingBooker forwarding number/);
});

test('phone setup state advances from number creation to verification to enable live', () => {
  assert.equal(
    resolvePhoneSetupState({
      subscriptionStatus: 'trialing',
      paymentMethodStatus: 'valid',
      hasPaymentMethod: true,
      hasForwardingNumber: false,
      forwardingSetupVerified: false,
    }),
    'forwarding_number_needed',
  );

  assert.equal(
    resolvePhoneSetupState({
      subscriptionStatus: 'trialing',
      paymentMethodStatus: 'valid',
      hasPaymentMethod: true,
      hasForwardingNumber: true,
      forwardingSetupVerified: false,
    }),
    'forwarding_verification_needed',
  );

  assert.equal(
    resolvePhoneSetupState({
      subscriptionStatus: 'trialing',
      paymentMethodStatus: 'valid',
      hasPaymentMethod: true,
      hasForwardingNumber: true,
      forwardingSetupVerified: true,
      liveCallsEnabled: false,
    }),
    'ready_to_enable_live',
  );
});

test('phone setup shows payment verification pending after Paddle returns before valid webhook state', () => {
  const state = resolvePhoneSetupState({
    subscriptionStatus: 'trialing',
    paymentMethodStatus: 'unknown',
    providerCustomerId: 'ctm_test',
    providerSubscriptionId: 'sub_test',
    hasPaymentMethod: false,
    hasForwardingNumber: false,
    forwardingSetupVerified: false,
  });

  assert.equal(state, 'payment_verification_pending');
  assert.match(getPhoneSetupCopy(state).explanation, /billing has not been verified by webhook/i);
});

test('billing issues take precedence over live flag', () => {
  assert.equal(
    resolvePhoneSetupState({
      subscriptionStatus: 'past_due',
      paymentMethodStatus: 'valid',
      hasPaymentMethod: true,
      hasForwardingNumber: true,
      forwardingSetupVerified: true,
      liveCallsEnabled: true,
    }),
    'billing_issue',
  );
});
