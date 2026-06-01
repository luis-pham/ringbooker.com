import test from 'node:test';
import assert from 'node:assert/strict';

import { squareAuthorizeUrl } from '@/src/backend/services/calendar/provider-connections';
import { applyRequiredTestEnv } from '@/src/backend/test-helpers/env';

applyRequiredTestEnv({
  SQUARE_APPLICATION_ID: 'sq0id-test',
  SQUARE_APPLICATION_SECRET: 'sq0secret-test',
  SQUARE_ENVIRONMENT: 'sandbox',
});

test('squareAuthorizeUrl requests business settings scope for booking profiles', () => {
  const url = new URL(squareAuthorizeUrl({
    redirectUri: 'https://ringbooker.test/api/backend/user/calendar/providers/square_appointments/connect/callback',
    state: 'state-test',
  }));

  const scopes = new Set((url.searchParams.get('scope') ?? '').split(/\s+/).filter(Boolean));

  assert.equal(url.origin + url.pathname, 'https://connect.squareupsandbox.com/oauth2/authorize');
  assert.equal(url.searchParams.get('client_id'), 'sq0id-test');
  assert.ok(scopes.has('APPOINTMENTS_BUSINESS_SETTINGS_READ'));
  assert.ok(scopes.has('APPOINTMENTS_READ'));
  assert.ok(scopes.has('APPOINTMENTS_WRITE'));
});
