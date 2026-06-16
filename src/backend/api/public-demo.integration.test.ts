import test from 'node:test';
import assert from 'node:assert/strict';

import { MockRealtimeAgentRuntime } from '@/src/agent/realtime/mock-runtime';
import { createBackendApp } from '@/src/backend/api/app';
import { InMemoryCallLogsRepository } from '@/src/backend/adapters/memory/call-logs-repository';
import { InMemoryDemoSessionsRepository } from '@/src/backend/adapters/memory/demo-sessions-repository';
import { InMemoryProviderEventsRepository } from '@/src/backend/adapters/memory/provider-events-repository';
import { InMemoryShopsRepository } from '@/src/backend/adapters/memory/shops-repository';
import type { TelephonyService } from '@/src/backend/services/telephony/types';
import { resetEnvCacheForTests } from '@/src/backend/config/env';
import {
  __clearDirectDemoActiveForTests,
  __expireDirectDemoActiveForTests,
  __resetPublicDemoRealtimeGuardForTests,
  tryOccupyDirectDemoActiveSlot,
  directDemoActiveTtlMs,
} from '@/src/backend/demo/public-demo-realtime-guard';
import { __resetRateLimitMemoryStoreForTests } from '@/src/backend/security/rate-limit';
import { applyRequiredTestEnv } from '@/src/backend/test-helpers/env';

function realtimeDemoHeaders(ipv4: string): Record<string, string> {
  return {
    'content-type': 'application/json',
    origin: 'http://localhost:3000',
    host: 'localhost:3000',
    'x-rb-remote-addr': ipv4,
  };
}

function realtimeDemoJsonBody(sessionId: string) {
  return {
    shopName: 'ABC Nails Studio',
    businessType: 'nail-salon',
    demoVertical: 'nail-salon',
    notes: 'Evening availability only.',
    captchaToken: 'dev-turnstile-bypass',
    sessionId,
  };
}

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

class CountingRealtimeAgentRuntime extends MockRealtimeAgentRuntime {
  startInboundSessionCount = 0;

  override async startInboundSession(params: Parameters<MockRealtimeAgentRuntime['startInboundSession']>[0]) {
    this.startInboundSessionCount += 1;
    return super.startInboundSession(params);
  }
}

test('public demo request returns 410 and never calls telephony outbound', async () => {
  resetEnvCacheForTests();
  __resetRateLimitMemoryStoreForTests();
  __resetPublicDemoRealtimeGuardForTests();
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
      'x-rb-remote-addr': '10.10.10.10',
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
  resetEnvCacheForTests();
  __resetRateLimitMemoryStoreForTests();
  __resetPublicDemoRealtimeGuardForTests();
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
      'x-rb-remote-addr': '10.10.10.11',
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

test('public demo realtime-session returns ephemeral client secret without LiveKit or outbound call', async () => {
  resetEnvCacheForTests();
  __resetRateLimitMemoryStoreForTests();
  __resetPublicDemoRealtimeGuardForTests();
  applyRequiredTestEnv({
    PUBLIC_DEMO_SHOP_ID: 'demo-shop',
    OPENAI_API_KEY: 'sk-test-openai',
    OPENAI_REALTIME_MODEL: 'gpt-realtime',
  });

  const originalFetch = globalThis.fetch;
  let openAiRequestCount = 0;
  let openAiRequestBody: unknown = null;
  globalThis.fetch = (async (input, init) => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;
    if (url === 'https://api.openai.com/v1/realtime/client_secrets') {
      openAiRequestCount += 1;
      openAiRequestBody = JSON.parse(String(init?.body ?? '{}')) as unknown;
      assert.equal((init?.headers as Record<string, string>)?.Authorization, 'Bearer sk-test-openai');
      return new Response(JSON.stringify({ value: 'ek_test_secret', expires_at: 123456 }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      });
    }
    return originalFetch(input, init);
  }) as typeof fetch;

  try {
    const telephony = new FakeTelephonyService();
    const realtime = new CountingRealtimeAgentRuntime();
    const app = createBackendApp({
      providerEventsRepository: new InMemoryProviderEventsRepository(),
      shopsRepository: new InMemoryShopsRepository(),
      callLogsRepository: new InMemoryCallLogsRepository(),
      demoSessionsRepository: new InMemoryDemoSessionsRepository(),
      telephonyService: telephony,
      realtimeAgentRuntime: realtime,
      runtimeInfo: {
        mode: 'memory',
        commProvider: 'noop',
        agentRuntimeMode: 'mock',
        agentTransportMode: 'mock',
        agentVoiceProviderMode: 'none',
      },
    });

    const request = await app.request('/public/demo/realtime-session', {
      method: 'POST',
      headers: realtimeDemoHeaders('10.10.10.12'),
      body: JSON.stringify({
        shopName: 'ABC Nails Studio',
        businessType: 'nail-salon',
        demoVertical: 'nail-salon',
        notes: 'Evening availability only.',
        captchaToken: 'dev-turnstile-bypass',
        sessionId: 'demo_session_direct_test_789',
        demoConfig: {
          city: 'Garden Grove, CA',
          primaryHours: 'Mon-Sat 9am-7pm',
          secondaryHours: 'Sun 10am-5pm',
          staffNames: ['Lan', 'Mai'],
          services: [
            { category: 'Manicure', name: 'Gel Manicure', price: 32, duration: '45 min', enabled: true },
          ],
        },
      }),
    });

    assert.equal(request.status, 200);
    const body = (await request.json()) as {
      ok: boolean;
      requestId?: string;
      clientSecret?: string;
      expiresAt?: number;
      model?: string;
      voice?: string;
      liveKitToken?: string;
      liveKitUrl?: string;
      systemPrompt?: string;
      openAiApiKey?: string;
      turnDetectionAfterWelcome?: Record<string, unknown> | null;
      scriptedWelcomeLine?: string;
    };
    assert.equal(body.ok, true);
    assert.match(body.requestId ?? '', /^demo-direct-/);
    assert.equal(body.clientSecret, 'ek_test_secret');
    assert.equal(body.expiresAt, 123456);
    assert.equal(body.model, 'gpt-realtime');
    assert.equal(body.voice, 'coral');
    assert.equal(body.liveKitToken, undefined);
    assert.equal(body.liveKitUrl, undefined);
    assert.equal(body.systemPrompt, undefined);
    assert.equal(body.openAiApiKey, undefined);
    assert.equal(body.turnDetectionAfterWelcome?.create_response, true);
    assert.match(body.scriptedWelcomeLine ?? '', /Mai at ABC Nails Studio/);
    assert.equal(openAiRequestCount, 1);
    assert.equal(realtime.startInboundSessionCount, 0);
    assert.equal(telephony.createOutboundCallCount, 0);

    const openAiBody = openAiRequestBody as {
      session?: {
        model?: string;
        instructions?: string;
        audio?: { input?: { turn_detection?: { create_response?: boolean } }; output?: { voice?: string } };
      };
    };
    assert.equal(openAiBody.session?.model, 'gpt-realtime');
    assert.equal(openAiBody.session?.audio?.output?.voice, 'coral');
    assert.equal(openAiBody.session?.audio?.input?.turn_detection?.create_response, false);
    assert.match(openAiBody.session?.instructions ?? '', /ABC Nails Studio/);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('public demo realtime-session rejects captcha before creating OpenAI session', async () => {
  resetEnvCacheForTests();
  __resetRateLimitMemoryStoreForTests();
  __resetPublicDemoRealtimeGuardForTests();
  applyRequiredTestEnv({
    PUBLIC_DEMO_SHOP_ID: 'demo-shop',
    OPENAI_API_KEY: 'sk-test-openai',
  });

  const originalFetch = globalThis.fetch;
  let openAiRequestCount = 0;
  globalThis.fetch = (async (input, init) => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;
    if (url === 'https://api.openai.com/v1/realtime/client_secrets') {
      openAiRequestCount += 1;
      return new Response('{}', { status: 200 });
    }
    return originalFetch(input, init);
  }) as typeof fetch;

  try {
    const telephony = new FakeTelephonyService();
    const realtime = new CountingRealtimeAgentRuntime();
    const app = createBackendApp({
      providerEventsRepository: new InMemoryProviderEventsRepository(),
      shopsRepository: new InMemoryShopsRepository(),
      callLogsRepository: new InMemoryCallLogsRepository(),
      demoSessionsRepository: new InMemoryDemoSessionsRepository(),
      telephonyService: telephony,
      realtimeAgentRuntime: realtime,
      runtimeInfo: {
        mode: 'memory',
        commProvider: 'noop',
        agentRuntimeMode: 'mock',
        agentTransportMode: 'mock',
        agentVoiceProviderMode: 'none',
      },
    });

    const request = await app.request('/public/demo/realtime-session', {
      method: 'POST',
      headers: realtimeDemoHeaders('10.10.10.13'),
      body: JSON.stringify({
        shopName: 'Willow Hair Lounge',
        businessType: 'hair-salon',
        demoVertical: 'hair-salon',
        captchaToken: 'bad-token',
        sessionId: 'demo_session_direct_bad_captcha',
      }),
    });

    assert.equal(request.status, 403);
    const body = (await request.json()) as { ok: boolean; error?: string; code?: string };
    assert.equal(body.ok, false);
    assert.equal(body.error, 'captcha_failed');
    assert.equal(body.code, 'captcha_failed');
    assert.equal(openAiRequestCount, 0);
    assert.equal(realtime.startInboundSessionCount, 0);
    assert.equal(telephony.createOutboundCallCount, 0);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

function installOpenAiClientSecretMock(): { openAiRequestCount: { value: number }; restore: () => void } {
  const originalFetch = globalThis.fetch;
  const openAiRequestCount = { value: 0 };
  globalThis.fetch = (async (input, init) => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;
    if (url === 'https://api.openai.com/v1/realtime/client_secrets') {
      openAiRequestCount.value += 1;
      return new Response(JSON.stringify({ value: 'ek_test_secret', expires_at: 123456 }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      });
    }
    return originalFetch(input, init);
  }) as typeof fetch;
  return {
    openAiRequestCount,
    restore: () => {
      globalThis.fetch = originalFetch;
    },
  };
}

test('public demo realtime-session burst limit blocks 3rd request within 1 minute', async () => {
  resetEnvCacheForTests();
  __resetRateLimitMemoryStoreForTests();
  __resetPublicDemoRealtimeGuardForTests();
  applyRequiredTestEnv({
    PUBLIC_DEMO_SHOP_ID: 'demo-shop',
    OPENAI_API_KEY: 'sk-test-openai',
    OPENAI_REALTIME_MODEL: 'gpt-realtime',
  });
  const { openAiRequestCount, restore } = installOpenAiClientSecretMock();
  try {
    const app = createBackendApp({
      providerEventsRepository: new InMemoryProviderEventsRepository(),
      shopsRepository: new InMemoryShopsRepository(),
      callLogsRepository: new InMemoryCallLogsRepository(),
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
    const ip = '10.10.50.1';
    for (let i = 0; i < 2; i += 1) {
      const res = await app.request('/public/demo/realtime-session', {
        method: 'POST',
        headers: realtimeDemoHeaders(ip),
        body: JSON.stringify(realtimeDemoJsonBody(`burst_session_${i}`)),
      });
      assert.equal(res.status, 200);
      __clearDirectDemoActiveForTests(ip);
    }
    const blocked = await app.request('/public/demo/realtime-session', {
      method: 'POST',
      headers: realtimeDemoHeaders(ip),
      body: JSON.stringify(realtimeDemoJsonBody('burst_session_2')),
    });
    assert.equal(blocked.status, 429);
    const j = (await blocked.json()) as { ok: boolean; code?: string; message?: string; retryAfterSeconds?: number };
    assert.equal(j.ok, false);
    assert.equal(j.code, 'demo_rate_limited_burst');
    assert.equal(typeof j.message, 'string');
    assert.equal(j.retryAfterSeconds, 60);
    assert.equal(openAiRequestCount.value, 2);
  } finally {
    restore();
  }
});

test('public demo realtime-session IP baseline blocks 6th request within 15 minutes', async () => {
  resetEnvCacheForTests();
  __resetRateLimitMemoryStoreForTests();
  __resetPublicDemoRealtimeGuardForTests();
  applyRequiredTestEnv({
    PUBLIC_DEMO_SHOP_ID: 'demo-shop',
    OPENAI_API_KEY: 'sk-test-openai',
    OPENAI_REALTIME_MODEL: 'gpt-realtime',
    PUBLIC_DEMO_REALTIME_BURST_LIMIT: '100',
    PUBLIC_DEMO_REALTIME_BURST_WINDOW_SECONDS: '60',
    PUBLIC_DEMO_REALTIME_IP_LIMIT: '5',
    PUBLIC_DEMO_REALTIME_IP_WINDOW_SECONDS: '900',
  });
  const { openAiRequestCount, restore } = installOpenAiClientSecretMock();
  try {
    const app = createBackendApp({
      providerEventsRepository: new InMemoryProviderEventsRepository(),
      shopsRepository: new InMemoryShopsRepository(),
      callLogsRepository: new InMemoryCallLogsRepository(),
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
    const ip = '10.10.50.2';
    for (let i = 0; i < 5; i += 1) {
      const res = await app.request('/public/demo/realtime-session', {
        method: 'POST',
        headers: realtimeDemoHeaders(ip),
        body: JSON.stringify(realtimeDemoJsonBody(`ip_base_${i}`)),
      });
      assert.equal(res.status, 200);
      __clearDirectDemoActiveForTests(ip);
    }
    const blocked = await app.request('/public/demo/realtime-session', {
      method: 'POST',
      headers: realtimeDemoHeaders(ip),
      body: JSON.stringify(realtimeDemoJsonBody('ip_base_5')),
    });
    assert.equal(blocked.status, 429);
    const j = (await blocked.json()) as { code?: string; retryAfterSeconds?: number };
    assert.equal(j.code, 'demo_rate_limited_ip');
    assert.equal(j.retryAfterSeconds, 900);
    assert.equal(openAiRequestCount.value, 5);
  } finally {
    restore();
  }
});

test('public demo realtime-session sessionId limit blocks 4th request within 30 minutes', async () => {
  resetEnvCacheForTests();
  __resetRateLimitMemoryStoreForTests();
  __resetPublicDemoRealtimeGuardForTests();
  applyRequiredTestEnv({
    PUBLIC_DEMO_SHOP_ID: 'demo-shop',
    OPENAI_API_KEY: 'sk-test-openai',
    OPENAI_REALTIME_MODEL: 'gpt-realtime',
    PUBLIC_DEMO_REALTIME_BURST_LIMIT: '100',
    PUBLIC_DEMO_REALTIME_IP_LIMIT: '100',
  });
  const { openAiRequestCount, restore } = installOpenAiClientSecretMock();
  try {
    const app = createBackendApp({
      providerEventsRepository: new InMemoryProviderEventsRepository(),
      shopsRepository: new InMemoryShopsRepository(),
      callLogsRepository: new InMemoryCallLogsRepository(),
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
    const ip = '10.10.50.3';
    const sid = 'same_browser_session_xyz';
    for (let i = 0; i < 3; i += 1) {
      const res = await app.request('/public/demo/realtime-session', {
        method: 'POST',
        headers: realtimeDemoHeaders(ip),
        body: JSON.stringify(realtimeDemoJsonBody(sid)),
      });
      assert.equal(res.status, 200);
      __clearDirectDemoActiveForTests(ip);
    }
    const blocked = await app.request('/public/demo/realtime-session', {
      method: 'POST',
      headers: realtimeDemoHeaders(ip),
      body: JSON.stringify(realtimeDemoJsonBody(sid)),
    });
    assert.equal(blocked.status, 429);
    const j = (await blocked.json()) as { code?: string; retryAfterSeconds?: number };
    assert.equal(j.code, 'demo_rate_limited_session');
    assert.equal(j.retryAfterSeconds, 1800);
    assert.equal(openAiRequestCount.value, 3);
  } finally {
    restore();
  }
});

test('public demo realtime-session global cap blocks after configured hourly limit', async () => {
  resetEnvCacheForTests();
  __resetRateLimitMemoryStoreForTests();
  __resetPublicDemoRealtimeGuardForTests();
  applyRequiredTestEnv({
    PUBLIC_DEMO_SHOP_ID: 'demo-shop',
    OPENAI_API_KEY: 'sk-test-openai',
    OPENAI_REALTIME_MODEL: 'gpt-realtime',
    PUBLIC_DEMO_REALTIME_BURST_LIMIT: '100',
    PUBLIC_DEMO_REALTIME_IP_LIMIT: '100',
    PUBLIC_DEMO_REALTIME_SESSION_LIMIT: '100',
    PUBLIC_DEMO_REALTIME_GLOBAL_LIMIT: '3',
    PUBLIC_DEMO_REALTIME_GLOBAL_WINDOW_SECONDS: '3600',
  });
  const { openAiRequestCount, restore } = installOpenAiClientSecretMock();
  try {
    const app = createBackendApp({
      providerEventsRepository: new InMemoryProviderEventsRepository(),
      shopsRepository: new InMemoryShopsRepository(),
      callLogsRepository: new InMemoryCallLogsRepository(),
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
    for (let i = 0; i < 3; i += 1) {
      const res = await app.request('/public/demo/realtime-session', {
        method: 'POST',
        headers: realtimeDemoHeaders(`10.10.60.${i}`),
        body: JSON.stringify(realtimeDemoJsonBody(`global_sess_${i}`)),
      });
      assert.equal(res.status, 200);
      __clearDirectDemoActiveForTests(`10.10.60.${i}`);
    }
    const blocked = await app.request('/public/demo/realtime-session', {
      method: 'POST',
      headers: realtimeDemoHeaders('10.10.60.9'),
      body: JSON.stringify(realtimeDemoJsonBody('global_sess_9')),
    });
    assert.equal(blocked.status, 429);
    const j = (await blocked.json()) as { code?: string; retryAfterSeconds?: number };
    assert.equal(j.code, 'demo_rate_limited_global');
    assert.equal(j.retryAfterSeconds, 3600);
    assert.equal(openAiRequestCount.value, 3);
  } finally {
    restore();
  }
});

test('public demo realtime-session concurrent cap blocks second active session for same IP', async () => {
  resetEnvCacheForTests();
  __resetRateLimitMemoryStoreForTests();
  __resetPublicDemoRealtimeGuardForTests();
  applyRequiredTestEnv({
    PUBLIC_DEMO_SHOP_ID: 'demo-shop',
    OPENAI_API_KEY: 'sk-test-openai',
    OPENAI_REALTIME_MODEL: 'gpt-realtime',
    PUBLIC_DEMO_REALTIME_BURST_LIMIT: '100',
    PUBLIC_DEMO_REALTIME_IP_LIMIT: '100',
    PUBLIC_DEMO_REALTIME_SESSION_LIMIT: '100',
    PUBLIC_DEMO_REALTIME_GLOBAL_LIMIT: '10000',
  });
  const originalFetch = globalThis.fetch;
  let openAiRequestCount = 0;
  globalThis.fetch = (async (input, init) => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;
    if (url === 'https://api.openai.com/v1/realtime/client_secrets') {
      openAiRequestCount += 1;
      if (openAiRequestCount === 1) {
        await new Promise((r) => setTimeout(r, 80));
      }
      return new Response(JSON.stringify({ value: 'ek_test_secret', expires_at: 123456 }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      });
    }
    return originalFetch(input, init);
  }) as typeof fetch;
  try {
    const app = createBackendApp({
      providerEventsRepository: new InMemoryProviderEventsRepository(),
      shopsRepository: new InMemoryShopsRepository(),
      callLogsRepository: new InMemoryCallLogsRepository(),
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
    const ip = '10.10.70.1';
    const p1 = app.request('/public/demo/realtime-session', {
      method: 'POST',
      headers: realtimeDemoHeaders(ip),
      body: JSON.stringify(realtimeDemoJsonBody('concurrent_sess_a')),
    });
    const p2 = app.request('/public/demo/realtime-session', {
      method: 'POST',
      headers: realtimeDemoHeaders(ip),
      body: JSON.stringify(realtimeDemoJsonBody('concurrent_sess_b')),
    });
    const [r1, r2] = await Promise.all([p1, p2]);
    assert.equal(r1.status, 200);
    assert.equal(r2.status, 429);
    const j = (await r2.json()) as { code?: string; retryAfterSeconds?: number };
    assert.equal(j.code, 'demo_concurrent_session_limit');
    assert.equal(j.retryAfterSeconds, 300);
    assert.equal(openAiRequestCount, 1);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('public demo realtime-session expired active slot no longer blocks', async () => {
  resetEnvCacheForTests();
  __resetRateLimitMemoryStoreForTests();
  __resetPublicDemoRealtimeGuardForTests();
  applyRequiredTestEnv({
    PUBLIC_DEMO_SHOP_ID: 'demo-shop',
    OPENAI_API_KEY: 'sk-test-openai',
    OPENAI_REALTIME_MODEL: 'gpt-realtime',
    PUBLIC_DEMO_REALTIME_BURST_LIMIT: '100',
    PUBLIC_DEMO_REALTIME_IP_LIMIT: '100',
    PUBLIC_DEMO_REALTIME_SESSION_LIMIT: '100',
    PUBLIC_DEMO_REALTIME_GLOBAL_LIMIT: '10000',
  });
  const { openAiRequestCount, restore } = installOpenAiClientSecretMock();
  try {
    const app = createBackendApp({
      providerEventsRepository: new InMemoryProviderEventsRepository(),
      shopsRepository: new InMemoryShopsRepository(),
      callLogsRepository: new InMemoryCallLogsRepository(),
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
    const ip = '10.10.80.1';
    const first = await app.request('/public/demo/realtime-session', {
      method: 'POST',
      headers: realtimeDemoHeaders(ip),
      body: JSON.stringify(realtimeDemoJsonBody('expired_slot_aa')),
    });
    assert.equal(first.status, 200);
    __expireDirectDemoActiveForTests(ip);
    const second = await app.request('/public/demo/realtime-session', {
      method: 'POST',
      headers: realtimeDemoHeaders(ip),
      body: JSON.stringify(realtimeDemoJsonBody('expired_slot_bb')),
    });
    assert.equal(second.status, 200);
    assert.equal(openAiRequestCount.value, 2);
  } finally {
    restore();
  }
});

test('public demo realtime-session invalid payload returns 400 with code', async () => {
  resetEnvCacheForTests();
  __resetRateLimitMemoryStoreForTests();
  __resetPublicDemoRealtimeGuardForTests();
  applyRequiredTestEnv({
    PUBLIC_DEMO_SHOP_ID: 'demo-shop',
    OPENAI_API_KEY: 'sk-test-openai',
  });
  const { openAiRequestCount, restore } = installOpenAiClientSecretMock();
  try {
    const app = createBackendApp({
      providerEventsRepository: new InMemoryProviderEventsRepository(),
      shopsRepository: new InMemoryShopsRepository(),
      callLogsRepository: new InMemoryCallLogsRepository(),
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
    const res = await app.request('/public/demo/realtime-session', {
      method: 'POST',
      headers: realtimeDemoHeaders('10.10.90.1'),
      body: JSON.stringify({ captchaToken: 'dev-turnstile-bypass', sessionId: 'short' }),
    });
    assert.equal(res.status, 400);
    const j = (await res.json()) as { ok: boolean; code?: string };
    assert.equal(j.ok, false);
    assert.equal(j.code, 'invalid_demo_payload');
    assert.equal(openAiRequestCount.value, 0);
  } finally {
    restore();
  }
});

// ─── validate-appointment-time endpoint ──────────────────────────────────────

function makeValidateApp() {
  applyRequiredTestEnv({ PUBLIC_DEMO_SHOP_ID: 'demo-shop' });
  return createBackendApp({
    providerEventsRepository: new InMemoryProviderEventsRepository(),
    shopsRepository: new InMemoryShopsRepository(),
    callLogsRepository: new InMemoryCallLogsRepository(),
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
}

// In the test environment getClientIp resolves to "unknown" (no trusted-proxy config),
// so we occupy slots under "unknown" and send requests without a forwarded-for header.
const VALIDATE_TEST_HEADERS = {
  'content-type': 'application/json',
  origin: 'http://localhost:3000',
  host: 'localhost:3000',
};
const VALIDATE_TEST_IP = 'unknown';

test('validate-appointment-time returns within_business_hours for a future Monday slot during nail-salon hours', async () => {
  resetEnvCacheForTests();
  __resetRateLimitMemoryStoreForTests();
  __resetPublicDemoRealtimeGuardForTests();
  const requestId = 'demo-direct-validate-test-001';
  await tryOccupyDirectDemoActiveSlot(VALIDATE_TEST_IP, requestId, directDemoActiveTtlMs());

  const app = makeValidateApp();
  const res = await app.request('/public/demo/realtime-session/validate-appointment-time', {
    method: 'POST',
    headers: VALIDATE_TEST_HEADERS,
    body: JSON.stringify({
      requestId,
      demoVertical: 'nail-salon',
      date: '2099-06-09', // Monday
      time: '10:00',      // within Mon–Sat 9am–7pm
    }),
  });

  assert.equal(res.status, 200);
  const body = (await res.json()) as { ok: boolean; valid?: boolean; reason?: string; normalizedDatetimeUtc?: string; messageForAi?: string };
  assert.equal(body.ok, true);
  assert.equal(body.valid, true);
  assert.equal(body.reason, 'within_business_hours');
  assert.ok(typeof body.normalizedDatetimeUtc === 'string' && body.normalizedDatetimeUtc.length > 0);
  assert.ok(typeof body.messageForAi === 'string' && body.messageForAi.length > 0);
});

test('validate-appointment-time returns outside_business_hours for a nail-salon slot after 7pm', async () => {
  resetEnvCacheForTests();
  __resetRateLimitMemoryStoreForTests();
  __resetPublicDemoRealtimeGuardForTests();
  const requestId = 'demo-direct-validate-test-002';
  await tryOccupyDirectDemoActiveSlot(VALIDATE_TEST_IP, requestId, directDemoActiveTtlMs());

  const app = makeValidateApp();
  const res = await app.request('/public/demo/realtime-session/validate-appointment-time', {
    method: 'POST',
    headers: VALIDATE_TEST_HEADERS,
    body: JSON.stringify({
      requestId,
      demoVertical: 'nail-salon',
      date: '2099-06-09', // Monday
      time: '21:00',      // after 7pm close
    }),
  });

  assert.equal(res.status, 200);
  const body = (await res.json()) as { ok: boolean; valid?: boolean; reason?: string };
  assert.equal(body.ok, true);
  assert.equal(body.valid, false);
  assert.equal(body.reason, 'outside_business_hours');
});

test('validate-appointment-time returns outside_business_hours for hair-salon closed Sunday', async () => {
  resetEnvCacheForTests();
  __resetRateLimitMemoryStoreForTests();
  __resetPublicDemoRealtimeGuardForTests();
  const requestId = 'demo-direct-validate-test-003';
  await tryOccupyDirectDemoActiveSlot(VALIDATE_TEST_IP, requestId, directDemoActiveTtlMs());

  const app = makeValidateApp();
  const res = await app.request('/public/demo/realtime-session/validate-appointment-time', {
    method: 'POST',
    headers: VALIDATE_TEST_HEADERS,
    body: JSON.stringify({
      requestId,
      demoVertical: 'hair-salon',
      date: '2099-06-08', // Sunday — hair-salon closed Sun+Mon
      time: '11:00',
    }),
  });

  assert.equal(res.status, 200);
  const body = (await res.json()) as { ok: boolean; valid?: boolean; reason?: string };
  assert.equal(body.ok, true);
  assert.equal(body.valid, false);
  assert.equal(body.reason, 'outside_business_hours');
});

test('validate-appointment-time returns past_datetime for a date in 2000', async () => {
  resetEnvCacheForTests();
  __resetRateLimitMemoryStoreForTests();
  __resetPublicDemoRealtimeGuardForTests();
  const requestId = 'demo-direct-validate-test-004';
  await tryOccupyDirectDemoActiveSlot(VALIDATE_TEST_IP, requestId, directDemoActiveTtlMs());

  const app = makeValidateApp();
  const res = await app.request('/public/demo/realtime-session/validate-appointment-time', {
    method: 'POST',
    headers: VALIDATE_TEST_HEADERS,
    body: JSON.stringify({
      requestId,
      demoVertical: 'nail-salon',
      date: '2000-01-03',
      time: '10:00',
    }),
  });

  assert.equal(res.status, 200);
  const body = (await res.json()) as { ok: boolean; valid?: boolean; reason?: string };
  assert.equal(body.ok, true);
  assert.equal(body.valid, false);
  assert.equal(body.reason, 'past_datetime');
});

test('validate-appointment-time returns business_hours_not_configured for unknown vertical', async () => {
  resetEnvCacheForTests();
  __resetRateLimitMemoryStoreForTests();
  __resetPublicDemoRealtimeGuardForTests();
  const requestId = 'demo-direct-validate-test-005';
  await tryOccupyDirectDemoActiveSlot(VALIDATE_TEST_IP, requestId, directDemoActiveTtlMs());

  const app = makeValidateApp();
  const res = await app.request('/public/demo/realtime-session/validate-appointment-time', {
    method: 'POST',
    headers: VALIDATE_TEST_HEADERS,
    body: JSON.stringify({
      requestId,
      demoVertical: 'unknown-vertical-xyz',
      date: '2099-06-09',
      time: '10:00',
    }),
  });

  assert.equal(res.status, 200);
  const body = (await res.json()) as { ok: boolean; valid?: boolean; reason?: string };
  assert.equal(body.ok, true);
  assert.equal(body.valid, true);
  assert.equal(body.reason, 'business_hours_not_configured');
});

test('validate-appointment-time returns 404 when no active slot exists', async () => {
  resetEnvCacheForTests();
  __resetRateLimitMemoryStoreForTests();
  __resetPublicDemoRealtimeGuardForTests();
  // No slot occupied — simulate expired / never-started session

  const app = makeValidateApp();
  const res = await app.request('/public/demo/realtime-session/validate-appointment-time', {
    method: 'POST',
    headers: VALIDATE_TEST_HEADERS,
    body: JSON.stringify({
      requestId: 'demo-direct-nonexistent-999',
      demoVertical: 'nail-salon',
      date: '2099-06-09',
      time: '10:00',
    }),
  });

  assert.equal(res.status, 404);
  const body = (await res.json()) as { ok: boolean; code?: string };
  assert.equal(body.ok, false);
  assert.equal(body.code, 'demo_session_expired');
});

test('validate-appointment-time returns 404 when requestId does not match active slot', async () => {
  resetEnvCacheForTests();
  __resetRateLimitMemoryStoreForTests();
  __resetPublicDemoRealtimeGuardForTests();
  // Slot occupied by a different requestId (simulates a stolen/wrong requestId)
  await tryOccupyDirectDemoActiveSlot(VALIDATE_TEST_IP, 'demo-direct-real-session-aaa', directDemoActiveTtlMs());

  const app = makeValidateApp();
  const res = await app.request('/public/demo/realtime-session/validate-appointment-time', {
    method: 'POST',
    headers: VALIDATE_TEST_HEADERS,
    body: JSON.stringify({
      requestId: 'demo-direct-wrong-session-bbb', // doesn't match stored slot
      demoVertical: 'nail-salon',
      date: '2099-06-09',
      time: '10:00',
    }),
  });

  assert.equal(res.status, 404);
  const body = (await res.json()) as { ok: boolean; code?: string };
  assert.equal(body.ok, false);
  assert.equal(body.code, 'demo_session_expired');
});

test('validate-appointment-time returns 400 for missing required fields', async () => {
  resetEnvCacheForTests();
  __resetRateLimitMemoryStoreForTests();
  __resetPublicDemoRealtimeGuardForTests();

  const app = makeValidateApp();
  const res = await app.request('/public/demo/realtime-session/validate-appointment-time', {
    method: 'POST',
    headers: VALIDATE_TEST_HEADERS,
    body: JSON.stringify({ requestId: 'demo-direct-x' }), // missing demoVertical, date, time
  });

  assert.equal(res.status, 400);
  const body = (await res.json()) as { ok: boolean; code?: string };
  assert.equal(body.ok, false);
  assert.equal(body.code, 'invalid_demo_payload');
});

test('public demo realtime-session rejects missing origin with 403', async () => {
  resetEnvCacheForTests();
  __resetRateLimitMemoryStoreForTests();
  __resetPublicDemoRealtimeGuardForTests();
  applyRequiredTestEnv({
    PUBLIC_DEMO_SHOP_ID: 'demo-shop',
    OPENAI_API_KEY: 'sk-test-openai',
  });
  const { openAiRequestCount, restore } = installOpenAiClientSecretMock();
  try {
    const app = createBackendApp({
      providerEventsRepository: new InMemoryProviderEventsRepository(),
      shopsRepository: new InMemoryShopsRepository(),
      callLogsRepository: new InMemoryCallLogsRepository(),
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
    const res = await app.request('/public/demo/realtime-session', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        host: 'localhost:3000',
        'x-rb-remote-addr': '10.10.90.2',
      },
      body: JSON.stringify(realtimeDemoJsonBody('no_origin_sess')),
    });
    assert.equal(res.status, 403);
    const j = (await res.json()) as { code?: string };
    assert.equal(j.code, 'forbidden_origin');
    assert.equal(openAiRequestCount.value, 0);
  } finally {
    restore();
  }
});
