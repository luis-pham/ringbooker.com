import test from 'node:test';
import assert from 'node:assert/strict';

import { buildGoLivePaymentRequiredMessage } from '@/src/backend/api/app';
import {
  buildForwardingNumberReadyEmailPayload,
  buildForwardingVerifiedEmailPayload,
  buildLiveAnsweringBillingPausedEmailPayload,
  buildPaymentMethodAddedEmailPayload,
  buildTrialReminderEmailPayload,
  buildWelcomeSignupEmailPayload,
} from '@/src/backend/services/email/base-email-builders';

const appBaseUrl = 'https://ringbooker.test';
const forbiddenNoChargePattern = /charged until (your )?trial ends|charged until the trial ends/i;

test('trial emails and go-live message do not promise no-charge when Paddle trial config is unverified', () => {
  const welcome = buildWelcomeSignupEmailPayload({
    email: 'owner@example.com',
    shopName: 'Test Salon',
    trialEndsAt: '2026-05-18T00:00:00.000Z',
    appBaseUrl,
  });
  const reminder = buildTrialReminderEmailPayload({
    email: 'owner@example.com',
    shopName: 'Test Salon',
    daysRemaining: 3,
    trialEndsAt: '2026-05-18T00:00:00.000Z',
    appBaseUrl,
    paddleTrialConfigVerified: false,
  });
  const goLiveMessage = buildGoLivePaymentRequiredMessage({ paddleTrialConfigVerified: false });

  const welcomeCombined = [welcome.text, welcome.input.previewText, welcome.input.bodyHtml].join('\n');
  assert.doesNotMatch(welcomeCombined, forbiddenNoChargePattern);
  assert.doesNotMatch(welcomeCombined, /Add payment method/i);
  assert.doesNotMatch(welcomeCombined, /\/user\/billing/i);

  const policyCombined = [
    reminder.text,
    reminder.input.previewText,
    reminder.input.bodyHtml,
    goLiveMessage,
  ].join('\n');

  assert.doesNotMatch(policyCombined, forbiddenNoChargePattern);
  assert.match(
    policyCombined,
    /A payment method is required before RingBooker answers real callers on your business number/i,
  );
});

test('trial emails and go-live message may promise no-charge when Paddle trial config is verified', () => {
  const welcome = buildWelcomeSignupEmailPayload({
    email: 'owner@example.com',
    shopName: 'Test Salon',
    trialEndsAt: '2026-05-18T00:00:00.000Z',
    appBaseUrl,
  });
  const reminder = buildTrialReminderEmailPayload({
    email: 'owner@example.com',
    shopName: 'Test Salon',
    daysRemaining: 3,
    trialEndsAt: '2026-05-18T00:00:00.000Z',
    appBaseUrl,
    paddleTrialConfigVerified: true,
  });
  const goLiveMessage = buildGoLivePaymentRequiredMessage({ paddleTrialConfigVerified: true });

  const combined = [
    welcome.text,
    welcome.input.previewText,
    welcome.input.bodyHtml,
    reminder.text,
    reminder.input.previewText,
    reminder.input.bodyHtml,
    goLiveMessage,
  ].join('\n');

  assert.match(combined, /You won't be charged until your trial ends/i);
});

test('phone setup lifecycle emails clearly state live answering state', () => {
  const paymentMethodAdded = buildPaymentMethodAddedEmailPayload({
    shopName: 'Test Salon',
    appBaseUrl,
  });
  const forwardingReady = buildForwardingNumberReadyEmailPayload({
    shopName: 'Test Salon',
    forwardingNumber: '+18888401886',
    appBaseUrl,
  });
  const forwardingVerified = buildForwardingVerifiedEmailPayload({
    shopName: 'Test Salon',
    appBaseUrl,
  });
  const billingPaused = buildLiveAnsweringBillingPausedEmailPayload({
    shopName: 'Test Salon',
    status: 'past_due',
    appBaseUrl,
  });

  assert.match(paymentMethodAdded.text, /Live answering is still off until phone setup is complete/i);
  assert.match(forwardingReady.text, /Keep your current business number/i);
  assert.match(forwardingReady.text, /Live answering is not active until forwarding is verified and you enable it/i);
  assert.match(forwardingVerified.text, /Live answering is still off until you enable it/i);
  assert.match(billingPaused.text, /RingBooker will not answer forwarded live calls/i);
});
