import test from 'node:test';
import assert from 'node:assert/strict';

import { buildGoLivePaymentRequiredMessage } from '@/src/backend/api/app';
import {
  buildForwardingNumberReadyEmailPayload,
  buildForwardingVerifiedEmailPayload,
  buildLiveAnsweringBillingPausedEmailPayload,
  buildPaymentMethodAddedEmailPayload,
  buildTrialEndedEmailPayload,
  buildTrialReminderEmailPayload,
  buildWelcomeSignupEmailPayload,
} from '@/src/backend/services/email/base-email-builders';

const appBaseUrl = 'https://ringbooker.test';
const forbiddenNoChargePattern = /won'?t be charged until|charged until (your )?(14-day )?trial ends|charged until the trial ends/i;

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
  assert.match(policyCombined, /Start your 14-day trial/i);
  assert.match(policyCombined, /Due today: \$0/i);
  assert.match(policyCombined, /Final total may include applicable taxes based on your location/i);
  assert.match(policyCombined, /RingBooker will not answer real calls on your business number/i);
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

  assert.match(combined, /You won't be charged until your 14-day trial ends/i);
  assert.match(combined, /Final total may include applicable taxes based on your location/i);
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

  // Current copy communicates the not-live-yet state via the go-live instruction.
  assert.match(paymentMethodAdded.text, /To go live, call your business number from another phone/i);
  assert.match(forwardingReady.text, /Keep your current business number/i);
  assert.match(forwardingReady.text, /Live answering is not active until forwarding is verified and you enable it/i);
  assert.match(forwardingVerified.text, /return to Go Live to switch on live answering/i);
  assert.match(billingPaused.text, /RingBooker will not answer forwarded live calls/i);
});

test('trial lifecycle email dates use the shop timezone', () => {
  const trialEndsAt = '2026-05-01T06:30:00.000Z';
  const laReminder = buildTrialReminderEmailPayload({
    email: 'owner@example.com',
    shopName: 'LA Salon',
    daysRemaining: 3,
    trialEndsAt,
    appBaseUrl,
    paddleTrialConfigVerified: false,
    shopTimezone: 'America/Los_Angeles',
  });
  const nyReminder = buildTrialReminderEmailPayload({
    email: 'owner@example.com',
    shopName: 'NY Salon',
    daysRemaining: 3,
    trialEndsAt,
    appBaseUrl,
    paddleTrialConfigVerified: false,
    shopTimezone: 'America/New_York',
  });
  const ended = buildTrialEndedEmailPayload({
    email: 'owner@example.com',
    shopName: 'LA Salon',
    appBaseUrl,
    trialEndsAt,
    shopTimezone: 'America/Los_Angeles',
  });
  const fallback = buildTrialReminderEmailPayload({
    email: 'owner@example.com',
    shopName: 'Fallback Salon',
    daysRemaining: 1,
    trialEndsAt: 'bad-date',
    appBaseUrl,
    paddleTrialConfigVerified: false,
    shopTimezone: 'Not/AZone',
  });

  assert.match(laReminder.text, /April 30, 2026/);
  assert.match(nyReminder.text, /May 1, 2026/);
  assert.match(ended.text, /ended on April 30, 2026/i);
  assert.match(fallback.text, /Unknown/);
});
