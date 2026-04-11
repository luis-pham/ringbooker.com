import test from 'node:test';
import assert from 'node:assert/strict';

import { MockRealtimeAgentRuntime } from '@/src/agent/realtime/mock-runtime';
import { createBackendApp } from '@/src/backend/api/app';
import { InMemoryCallLogsRepository } from '@/src/backend/adapters/memory/call-logs-repository';
import { InMemoryDemoSessionsRepository } from '@/src/backend/adapters/memory/demo-sessions-repository';
import { InMemoryProviderEventsRepository } from '@/src/backend/adapters/memory/provider-events-repository';
import { InMemoryShopsRepository } from '@/src/backend/adapters/memory/shops-repository';
import type { TelephonyService } from '@/src/backend/services/telephony/types';
import { applyRequiredTestEnv } from '@/src/backend/test-helpers/env';

class FakeTelephonyService implements TelephonyService {
  async transferLiveCallToUser() {
    return {
      initiated: false,
      target: 'voicemail' as const,
    };
  }

  async createOutboundCall() {
    return {
      providerCallId: 'demo-provider-call',
    };
  }
}

test('public demo endpoint creates preview token and status endpoint returns dialing state', async () => {
  applyRequiredTestEnv({
    PUBLIC_DEMO_SHOP_ID: 'demo-shop',
  });

  const callLogsRepository = new InMemoryCallLogsRepository();
  const app = createBackendApp({
    providerEventsRepository: new InMemoryProviderEventsRepository(),
    shopsRepository: new InMemoryShopsRepository(),
    callLogsRepository,
    demoSessionsRepository: new InMemoryDemoSessionsRepository(),
    telephonyService: new FakeTelephonyService(),
    realtimeAgentRuntime: new MockRealtimeAgentRuntime(),
    runtimeInfo: {
      mode: 'memory',
      commProvider: 'noop',
      agentRuntimeMode: 'mock',
      agentTransportMode: 'mock',
      agentVoiceProviderMode: 'none',
    },
  });

  const request = await app.request('/public/demo/request', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-forwarded-for': '10.10.10.10',
    },
    body: JSON.stringify({
      shopName: 'Luxe Hair Studio',
      phoneNumber: '+17145550199',
      businessType: 'Hair Salon',
      scenario: 'Book a new appointment',
      staffName: 'Sophia',
      notes: 'Evening availability only.',
      captchaToken: 'dev-turnstile-bypass',
      sessionId: 'demo_session_test_123',
    }),
  });

  assert.equal(request.status, 200);
  const requestBody = await request.json();
  assert.equal(requestBody.ok, true);
  assert.equal(typeof requestBody.requestId, 'string');
  assert.equal(typeof requestBody.previewToken, 'string');

  const status = await app.request(
    `/public/demo/status/${encodeURIComponent(requestBody.requestId)}?token=${encodeURIComponent(requestBody.previewToken)}`,
    {
      method: 'GET',
      headers: {
        'x-forwarded-for': '10.10.10.10',
      },
    },
  );

  assert.equal(status.status, 200);
  const statusBody = await status.json();
  assert.equal(statusBody.ok, true);
  assert.equal(statusBody.stage, 'dialing');
  assert.equal(statusBody.call.requestId, requestBody.requestId);
});
