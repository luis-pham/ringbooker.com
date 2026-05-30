import test from 'node:test';
import assert from 'node:assert/strict';

import { createBackendApp } from '@/src/backend/api/app';
import { InMemoryAuthUsersRepository } from '@/src/backend/adapters/memory/auth-users-repository';
import { InMemoryBookingsRepository } from '@/src/backend/adapters/memory/bookings-repository';
import { InMemoryCallLogsRepository } from '@/src/backend/adapters/memory/call-logs-repository';
import { InMemoryCallbacksRepository } from '@/src/backend/adapters/memory/callbacks-repository';
import { InMemoryJobsRepository } from '@/src/backend/adapters/memory/jobs-repository';
import { InMemoryProviderEventsRepository } from '@/src/backend/adapters/memory/provider-events-repository';
import { InMemoryShopsRepository } from '@/src/backend/adapters/memory/shops-repository';
import { NoopTelephonyService } from '@/src/backend/adapters/noop/telephony-service';
import { decrypt, encrypt } from '@/src/backend/services/crypto/encrypt';
import {
  acuityAuthorizeUrl,
  acuityExchangeAuthorizationCode,
  acuityRevokeToken,
} from '@/src/backend/services/calendar/provider-connections';
import { applyRequiredTestEnv } from '@/src/backend/test-helpers/env';
import { MockRealtimeAgentRuntime } from '@/src/agent/realtime/mock-runtime';

applyRequiredTestEnv({
  USER_AUTH_EMAIL: 'user@ringbooker.local',
  USER_AUTH_PASSWORD: 'change_me_user_password',
  USER_AUTH_SHOP_ID: 'demo-shop',
  ACUITY_CLIENT_ID: 'acuity-client-id',
  ACUITY_CLIENT_SECRET: 'acuity-client-secret',
});

function createUserCalendarTestApp() {
  const shopsRepository = new InMemoryShopsRepository();
  const app = createBackendApp({
    providerEventsRepository: new InMemoryProviderEventsRepository(),
    jobsRepository: new InMemoryJobsRepository(),
    bookingsRepository: new InMemoryBookingsRepository(),
    callbacksRepository: new InMemoryCallbacksRepository(),
    shopsRepository,
    telephonyService: new NoopTelephonyService(),
    callLogsRepository: new InMemoryCallLogsRepository(),
    authUsersRepository: new InMemoryAuthUsersRepository(),
    realtimeAgentRuntime: new MockRealtimeAgentRuntime(),
  });
  return { app, shopsRepository };
}

let loginCounter = 80;

async function loginUser(app: ReturnType<typeof createBackendApp>) {
  loginCounter += 1;
  const loginResponse = await app.request('/auth/user/login', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'origin': 'http://localhost:3000',
      'x-rb-remote-addr': `10.88.0.${loginCounter}`,
    },
    body: JSON.stringify({
      email: 'user@ringbooker.local',
      password: 'change_me_user_password',
    }),
  });
  assert.equal(loginResponse.status, 200);
  const cookie = loginResponse.headers.get('set-cookie')?.split(';')[0];
  assert.ok(cookie);
  return cookie!;
}

function withMockFetch(
  impl: typeof fetch,
): () => void {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = impl;
  return () => {
    globalThis.fetch = originalFetch;
  };
}

test('acuityAuthorizeUrl includes required OAuth params', () => {
  const url = new URL(
    acuityAuthorizeUrl({
      clientId: 'client-123',
      redirectUri: 'https://ringbooker.test/api/backend/user/calendar/providers/acuity/connect/callback',
      state: 'state-123',
    }),
  );

  assert.equal(url.origin + url.pathname, 'https://acuityscheduling.com/oauth2/authorize');
  assert.equal(url.searchParams.get('response_type'), 'code');
  assert.equal(url.searchParams.get('scope'), 'api-v1');
  assert.equal(url.searchParams.get('client_id'), 'client-123');
  assert.equal(url.searchParams.get('redirect_uri'), 'https://ringbooker.test/api/backend/user/calendar/providers/acuity/connect/callback');
  assert.equal(url.searchParams.get('state'), 'state-123');
});

test('acuityExchangeAuthorizationCode posts form-encoded body and returns token response', async () => {
  let contentType: string | null = null;
  let body: string | null = null;
  const restoreFetch = withMockFetch((async (_input: RequestInfo | URL, init?: RequestInit) => {
    contentType = new Headers(init?.headers).get('content-type');
    body = String(init?.body);
    return new Response(JSON.stringify({ access_token: 'token-123', token_type: 'Bearer' }), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    });
  }) as typeof fetch);

  try {
    const response = await acuityExchangeAuthorizationCode({
      code: 'code-123',
      clientId: 'client-123',
      clientSecret: 'secret-123',
      redirectUri: 'https://ringbooker.test/callback',
    });
    assert.equal(contentType, 'application/x-www-form-urlencoded');
    const encodedBody = String(body ?? '');
    assert.ok(encodedBody.includes('grant_type=authorization_code'));
    assert.ok(encodedBody.includes('code=code-123'));
    assert.equal(response.access_token, 'token-123');
    assert.equal(response.token_type, 'Bearer');
  } finally {
    restoreFetch();
  }
});

test('acuityExchangeAuthorizationCode throws on non-2xx token response', async () => {
  const restoreFetch = withMockFetch((async () => new Response('bad code', { status: 400 })) as typeof fetch);
  try {
    await assert.rejects(
      () =>
        acuityExchangeAuthorizationCode({
          code: 'bad-code',
          clientId: 'client-123',
          clientSecret: 'secret-123',
          redirectUri: 'https://ringbooker.test/callback',
        }),
      /acuity_oauth_exchange_failed:400:bad code/,
    );
  } finally {
    restoreFetch();
  }
});

test('acuityRevokeToken posts disconnect request and does not throw on error', async () => {
  const requests: string[] = [];
  const restoreFetch = withMockFetch((async (input: RequestInfo | URL) => {
    requests.push(String(input));
    return new Response('service unavailable', { status: 503 });
  }) as typeof fetch);
  try {
    await acuityRevokeToken({
      accessToken: 'token-123',
      clientId: 'client-123',
      clientSecret: 'secret-123',
    });
    assert.deepEqual(requests, ['https://acuityscheduling.com/oauth2/disconnect']);
  } finally {
    restoreFetch();
  }
});

test('acuity OAuth start route redirects to Acuity authorize URL', async () => {
  const { app } = createUserCalendarTestApp();
  const cookie = await loginUser(app);

  const response = await app.request('/user/calendar/providers/acuity/connect/start', {
    headers: { cookie, host: 'localhost:3000' },
  });

  assert.equal(response.status, 302);
  const location = response.headers.get('location');
  assert.ok(location);
  const url = new URL(location!);
  assert.equal(url.origin + url.pathname, 'https://acuityscheduling.com/oauth2/authorize');
  assert.equal(url.searchParams.get('client_id'), 'acuity-client-id');
  assert.equal(url.searchParams.get('scope'), 'api-v1');
});

test('acuity OAuth callback saves encrypted token and best-effort user identity', async () => {
  const { app, shopsRepository } = createUserCalendarTestApp();
  const cookie = await loginUser(app);
  const restoreFetch = withMockFetch((async (input: RequestInfo | URL) => {
    const url = String(input);
    if (url === 'https://acuityscheduling.com/oauth2/token') {
      return new Response(JSON.stringify({ access_token: 'acuity-access-token', token_type: 'Bearer' }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      });
    }
    if (url === 'https://acuityscheduling.com/api/v1/me') {
      return new Response(JSON.stringify({ id: 12345, email: 'owner@example.com' }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      });
    }
    return new Response('{}', { status: 404 });
  }) as typeof fetch);

  try {
    const response = await app.request('/user/calendar/providers/acuity/connect/callback?state=state-123&code=code-123', {
      headers: {
        host: 'localhost:3000',
        cookie: `${cookie}; rb_calendar_provider_state=state-123; rb_calendar_provider_name=acuity; rb_calendar_provider_shop=demo-shop`,
      },
    });

    assert.equal(response.status, 302);
    assert.match(response.headers.get('location') ?? '', /calendar_connect=success/);
    const shop = await shopsRepository.findById('demo-shop');
    assert.equal(shop?.selected_integration, 'acuity');
    assert.equal(shop?.booking_method, 'app');
    assert.equal(shop?.acuity_connection_status, 'connected');
    assert.equal(shop?.acuity_user_id, '12345');
    assert.equal(decrypt(shop?.acuity_access_token_encrypted ?? ''), 'acuity-access-token');
  } finally {
    restoreFetch();
  }
});

test('acuity OAuth callback completes when current user lookup fails', async () => {
  const { app, shopsRepository } = createUserCalendarTestApp();
  const cookie = await loginUser(app);
  const restoreFetch = withMockFetch((async (input: RequestInfo | URL) => {
    const url = String(input);
    if (url === 'https://acuityscheduling.com/oauth2/token') {
      return new Response(JSON.stringify({ access_token: 'acuity-access-token', token_type: 'Bearer' }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      });
    }
    if (url === 'https://acuityscheduling.com/api/v1/me') return new Response('nope', { status: 500 });
    return new Response('{}', { status: 404 });
  }) as typeof fetch);

  try {
    const response = await app.request('/user/calendar/providers/acuity/connect/callback?state=state-456&code=code-456', {
      headers: {
        host: 'localhost:3000',
        cookie: `${cookie}; rb_calendar_provider_state=state-456; rb_calendar_provider_name=acuity; rb_calendar_provider_shop=demo-shop`,
      },
    });

    assert.equal(response.status, 302);
    assert.match(response.headers.get('location') ?? '', /calendar_connect=success/);
    const shop = await shopsRepository.findById('demo-shop');
    assert.equal(shop?.acuity_connection_status, 'connected');
    assert.equal(shop?.acuity_user_id, null);
  } finally {
    restoreFetch();
  }
});

test('acuity OAuth callback rejects invalid state before exchange', async () => {
  const { app } = createUserCalendarTestApp();
  const cookie = await loginUser(app);
  let exchanged = false;
  const restoreFetch = withMockFetch((async () => {
    exchanged = true;
    return new Response('{}', { status: 200 });
  }) as typeof fetch);

  try {
    const response = await app.request('/user/calendar/providers/acuity/connect/callback?state=bad-state&code=code-123', {
      headers: {
        host: 'localhost:3000',
        cookie: `${cookie}; rb_calendar_provider_state=state-789; rb_calendar_provider_name=acuity; rb_calendar_provider_shop=demo-shop`,
      },
    });

    assert.equal(response.status, 302);
    assert.match(response.headers.get('location') ?? '', /calendar_message=invalid_oauth_state/);
    assert.equal(exchanged, false);
  } finally {
    restoreFetch();
  }
});

test('acuity disconnect revokes token and clears OAuth + legacy config', async () => {
  const { app, shopsRepository } = createUserCalendarTestApp();
  const cookie = await loginUser(app);
  await shopsRepository.updateAcuityOAuthCredentials('demo-shop', {
    acuity_access_token_encrypted: encrypt('acuity-access-token'),
    acuity_user_id: '12345',
    acuity_connection_status: 'connected',
  });
  await shopsRepository.updateIntegrationConnection('demo-shop', {
    integration_credentials_encrypted: JSON.stringify({ provider: 'acuity', appointmentTypeId: '100' }),
  });
  const revokeRequests: string[] = [];
  const restoreFetch = withMockFetch((async (input: RequestInfo | URL) => {
    revokeRequests.push(String(input));
    return new Response('{}', { status: 200 });
  }) as typeof fetch);

  try {
    const response = await app.request('/user/calendar/providers/acuity/disconnect', {
      method: 'POST',
      headers: {
        cookie,
        origin: 'http://localhost:3000',
        host: 'localhost:3000',
      },
    });

    assert.equal(response.status, 200);
    const body = (await response.json()) as { ok: boolean; disconnected: boolean };
    assert.equal(body.ok, true);
    assert.equal(body.disconnected, true);
    assert.deepEqual(revokeRequests, ['https://acuityscheduling.com/oauth2/disconnect']);
    const shop = await shopsRepository.findById('demo-shop');
    assert.equal(shop?.acuity_access_token_encrypted, null);
    assert.equal(shop?.acuity_user_id, null);
    assert.equal(shop?.acuity_connection_status, 'disconnected');
    assert.equal(shop?.integration_credentials_encrypted, null);
  } finally {
    restoreFetch();
  }
});
