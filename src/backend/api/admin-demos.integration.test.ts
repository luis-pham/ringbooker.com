import test from 'node:test';
import assert from 'node:assert/strict';

import { MockRealtimeAgentRuntime } from '@/src/agent/realtime/mock-runtime';
import { createBackendApp } from '@/src/backend/api/app';
import { InMemoryAuthUsersRepository } from '@/src/backend/adapters/memory/auth-users-repository';
import { InMemoryCallLogsRepository } from '@/src/backend/adapters/memory/call-logs-repository';
import { InMemoryDemoSessionsRepository } from '@/src/backend/adapters/memory/demo-sessions-repository';
import { InMemoryProviderEventsRepository } from '@/src/backend/adapters/memory/provider-events-repository';
import { InMemoryWebDemoSessionsRepository } from '@/src/backend/adapters/memory/web-demo-sessions-repository';
import { applyRequiredTestEnv } from '@/src/backend/test-helpers/env';

applyRequiredTestEnv({
  ADMIN_AUTH_EMAIL: 'admin@ringbooker.local',
  ADMIN_AUTH_PASSWORD: 'change_me_admin_password',
});

async function adminCookie(app: ReturnType<typeof createBackendApp>): Promise<string> {
  const loginResponse = await app.request('/auth/admin/login', {
    method: 'POST',
    headers: { 'content-type': 'application/json', origin: 'http://localhost:3000' },
    body: JSON.stringify({
      email: 'admin@ringbooker.local',
      password: 'change_me_admin_password',
    }),
  });
  assert.equal(loginResponse.status, 200);
  const cookieHeader = loginResponse.headers.get('set-cookie')?.split(';')[0];
  assert.ok(cookieHeader);
  return cookieHeader!;
}

test('GET /admin/demos/web returns 401 without admin session', async () => {
  const app = createBackendApp({
    providerEventsRepository: new InMemoryProviderEventsRepository(),
    authUsersRepository: new InMemoryAuthUsersRepository(),
    demoSessionsRepository: new InMemoryDemoSessionsRepository(),
    callLogsRepository: new InMemoryCallLogsRepository(),
    webDemoSessionsRepository: new InMemoryWebDemoSessionsRepository(),
    realtimeAgentRuntime: new MockRealtimeAgentRuntime(),
  });
  const res = await app.request('/admin/demos/web');
  assert.equal(res.status, 401);
});

test('GET /admin/demos/phone excludes marketing_demo_web runs but /admin/demo-calls keeps them', async () => {
  const demoSessionsRepository = new InMemoryDemoSessionsRepository();

  const phoneSession = await demoSessionsRepository.createSession({
    publicSessionId: 'pub-phone',
    verticalSlug: 'hvac',
    mode: 'quick',
    source: 'vertical_demo_page',
    callbackPhone: '+15555550100',
    businessName: 'Phone Biz',
  });
  await demoSessionsRepository.createCallRun({
    demoSessionId: phoneSession.id,
    requestId: 'demo-phone-run-1',
    provider: 'marketing_demo',
    status: 'completed',
    startedAt: new Date(),
  });

  const webLiveKitSession = await demoSessionsRepository.createSession({
    publicSessionId: 'pub-web-lk',
    verticalSlug: 'hvac',
    mode: 'quick',
    source: 'vertical_demo_web',
    callbackPhone: '+15555550100',
    businessName: 'Web Biz',
  });
  await demoSessionsRepository.createCallRun({
    demoSessionId: webLiveKitSession.id,
    requestId: 'demo-livekit-abc',
    provider: 'marketing_demo_web',
    status: 'completed',
    startedAt: new Date(),
  });

  const app = createBackendApp({
    providerEventsRepository: new InMemoryProviderEventsRepository(),
    authUsersRepository: new InMemoryAuthUsersRepository(),
    demoSessionsRepository,
    callLogsRepository: new InMemoryCallLogsRepository(),
    webDemoSessionsRepository: new InMemoryWebDemoSessionsRepository(),
    realtimeAgentRuntime: new MockRealtimeAgentRuntime(),
  });

  const cookie = await adminCookie(app);

  const phoneRes = await app.request('/admin/demos/phone', { headers: { cookie } });
  assert.equal(phoneRes.status, 200);
  const phoneBody = (await phoneRes.json()) as { calls: Array<{ requestId: string }> };
  assert.ok(phoneBody.calls.some((c) => c.requestId === 'demo-phone-run-1'));
  assert.ok(!phoneBody.calls.some((c) => c.requestId === 'demo-livekit-abc'));

  const allRes = await app.request('/admin/demo-calls', { headers: { cookie } });
  assert.equal(allRes.status, 200);
  const allBody = (await allRes.json()) as { calls: Array<{ requestId: string }> };
  assert.ok(allBody.calls.some((c) => c.requestId === 'demo-livekit-abc'));
});

test('GET /admin/demos/web merges LiveKit web runs and direct web_demo_sessions', async () => {
  const demoSessionsRepository = new InMemoryDemoSessionsRepository();
  const webDemoSessionsRepository = new InMemoryWebDemoSessionsRepository();

  const webLiveKitSession = await demoSessionsRepository.createSession({
    publicSessionId: 'lk-sess',
    verticalSlug: 'nail-salon',
    mode: 'quick',
    source: 'vertical_demo_web',
    callbackPhone: '+15555550100',
    businessName: 'LK Biz',
  });
  await demoSessionsRepository.createCallRun({
    demoSessionId: webLiveKitSession.id,
    requestId: 'demo-merge-livekit',
    provider: 'marketing_demo_web',
    status: 'live',
    startedAt: new Date(),
  });

  await webDemoSessionsRepository.insertStarted({
    publicSessionId: 'direct-sess',
    requestId: 'demo-direct-merge',
    verticalSlug: 'nail-salon',
    businessName: 'Direct Biz',
    ipAddress: '203.0.113.9',
    country: 'US',
    userAgent: 'Mozilla/5.0 (Macintosh)',
    browser: 'Chrome',
    deviceType: 'desktop',
  });

  const app = createBackendApp({
    providerEventsRepository: new InMemoryProviderEventsRepository(),
    authUsersRepository: new InMemoryAuthUsersRepository(),
    demoSessionsRepository,
    callLogsRepository: new InMemoryCallLogsRepository(),
    webDemoSessionsRepository,
    realtimeAgentRuntime: new MockRealtimeAgentRuntime(),
  });

  const cookie = await adminCookie(app);
  const res = await app.request('/admin/demos/web', { headers: { cookie } });
  assert.equal(res.status, 200);
  const body = (await res.json()) as {
    sessions: Array<{ kind: string; requestId: string | null }>;
  };
  assert.ok(body.sessions.some((s) => s.kind === 'livekit_web' && s.requestId === 'demo-merge-livekit'));
  assert.ok(body.sessions.some((s) => s.kind === 'direct_realtime' && s.requestId === 'demo-direct-merge'));
});

test('GET /admin/demos/web/:id/transcript requires admin', async () => {
  const webDemoSessionsRepository = new InMemoryWebDemoSessionsRepository();
  await webDemoSessionsRepository.insertStarted({
    publicSessionId: 'x',
    requestId: 'demo-direct-x',
    verticalSlug: 'v',
    businessName: 'B',
    ipAddress: '1.1.1.1',
    country: 'US',
    userAgent: null,
    browser: null,
    deviceType: null,
  });
  const rows = await webDemoSessionsRepository.listForAdmin({
    startedAfter: new Date(0),
    startedBefore: new Date(Date.now() + 60_000),
    limit: 10,
    offset: 0,
  });
  const id = rows[0]?.id;
  assert.ok(id);

  const app = createBackendApp({
    providerEventsRepository: new InMemoryProviderEventsRepository(),
    authUsersRepository: new InMemoryAuthUsersRepository(),
    demoSessionsRepository: new InMemoryDemoSessionsRepository(),
    callLogsRepository: new InMemoryCallLogsRepository(),
    webDemoSessionsRepository,
    realtimeAgentRuntime: new MockRealtimeAgentRuntime(),
  });

  const anon = await app.request(`/admin/demos/web/${id}/transcript`);
  assert.equal(anon.status, 401);

  const cookie = await adminCookie(app);
  const ok = await app.request(`/admin/demos/web/${id}/transcript`, { headers: { cookie } });
  assert.equal(ok.status, 200);
  const json = (await ok.json()) as { ok: boolean; transcriptText: string | null };
  assert.equal(json.ok, true);
  assert.equal(json.transcriptText, null);
});
