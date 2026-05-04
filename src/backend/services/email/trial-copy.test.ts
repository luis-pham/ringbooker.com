import test from 'node:test';
import assert from 'node:assert/strict';

import { buildGoLivePaymentRequiredMessage } from '@/src/backend/api/app';
import {
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
    paddleTrialConfigVerified: false,
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

  const combined = [
    welcome.text,
    welcome.input.previewText,
    welcome.input.bodyHtml,
    reminder.text,
    reminder.input.previewText,
    reminder.input.bodyHtml,
    goLiveMessage,
  ].join('\n');

  assert.doesNotMatch(combined, forbiddenNoChargePattern);
  assert.match(
    combined,
    /A payment method is required before RingBooker answers real callers on your business number/i,
  );
});

test('trial emails and go-live message may promise no-charge when Paddle trial config is verified', () => {
  const welcome = buildWelcomeSignupEmailPayload({
    email: 'owner@example.com',
    shopName: 'Test Salon',
    trialEndsAt: '2026-05-18T00:00:00.000Z',
    appBaseUrl,
    paddleTrialConfigVerified: true,
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
