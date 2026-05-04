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
  createOutboundCallCount = 0;

  async requestHumanHandoffViaCallControl() {
    return { started: false, failureCode: 'fake' };
  }

  async transferLiveCallToUser() {
    return {
      initiated: false,
      target: 'voicemail' as const,
    };
  }

  async createOutboundCall() {
    this.createOutboundCallCount += 1;
    return {
      providerCallId: 'demo-provider-call',
    };
  }
}

test('public demo request returns 410 and never calls telephony outbound', async () => {
  applyRequiredTestEnv({
    PUBLIC_DEMO_SHOP_ID: 'demo-shop',
  });

  const telephony = new FakeTelephonyService();
  const app = createBackendApp({
    providerEventsRepository: new InMemoryProviderEventsRepository(),
    shopsRepository: new InMemoryShopsRepository(),
    callLogsRepository: new InMemoryCallLogsRepository(),
    demoSessionsRepository: new InMemoryDemoSessionsRepository(),
    telephonyService: telephony,
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
      'origin': 'http://localhost:3000',
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

  assert.equal(request.status, 410);
  const requestBody = (await request.json()) as { ok: boolean; error?: string; message?: string };
  assert.equal(requestBody.ok, false);
  assert.equal(requestBody.error, 'outbound_demo_disabled');
  assert.match(requestBody.message ?? '', /browser web demo/i);
  assert.equal(telephony.createOutboundCallCount, 0);
});

test('public demo web-session returns join token and does not require visitor phone', async () => {
  applyRequiredTestEnv({
    PUBLIC_DEMO_SHOP_ID: 'demo-shop',
  });

  const telephony = new FakeTelephonyService();
  const app = createBackendApp({
    providerEventsRepository: new InMemoryProviderEventsRepository(),
    shopsRepository: new InMemoryShopsRepository(),
    callLogsRepository: new InMemoryCallLogsRepository(),
    demoSessionsRepository: new InMemoryDemoSessionsRepository(),
    telephonyService: telephony,
    realtimeAgentRuntime: new MockRealtimeAgentRuntime(),
    runtimeInfo: {
      mode: 'memory',
      commProvider: 'noop',
      agentRuntimeMode: 'mock',
      agentTransportMode: 'mock',
      agentVoiceProviderMode: 'none',
    },
  });

  const request = await app.request('/public/demo/web-session', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      origin: 'http://localhost:3000',
      'x-forwarded-for': '10.10.10.11',
    },
    body: JSON.stringify({
      shopName: 'Luxe Hair Studio',
      businessType: 'hair-salon',
      demoVertical: 'hair-salon',
      staffName: 'Sophia',
      notes: 'Evening availability only.',
      captchaToken: 'dev-turnstile-bypass',
      sessionId: 'demo_session_web_test_456',
      demoConfig: {
        city: 'Austin, TX',
        primaryHours: 'Tue-Sat 9am-6pm',
        secondaryHours: 'Sun-Mon closed',
        staffNames: ['Mia', 'Jordan'],
        services: [
          { category: 'Cut', name: "Women's Haircut", price: 65, duration: '60 min', enabled: true },
        ],
      },
    }),
  });

  assert.equal(request.status, 200);
  const requestBody = (await request.json()) as {
    ok: boolean;
    requestId?: string;
    previewToken?: string;
    liveKitUrl?: string;
    liveKitToken?: string;
  };
  assert.equal(requestBody.ok, true);
  assert.equal(typeof requestBody.requestId, 'string');
  assert.equal(typeof requestBody.previewToken, 'string');
  assert.equal(requestBody.liveKitUrl, 'wss://example.livekit.cloud');
  assert.equal(typeof requestBody.liveKitToken, 'string');
  assert.ok((requestBody.liveKitToken ?? '').length > 20);
  assert.equal(telephony.createOutboundCallCount, 0);
});
