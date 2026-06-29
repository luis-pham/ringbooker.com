import test from 'node:test';
import assert from 'node:assert/strict';

import { createBackendApp } from '@/src/backend/api/app';
import { InMemoryAuthUsersRepository } from '@/src/backend/adapters/memory/auth-users-repository';
import { InMemoryProviderEventsRepository } from '@/src/backend/adapters/memory/provider-events-repository';
import { InMemorySmsMessagesRepository } from '@/src/backend/adapters/memory/sms-messages-repository';
import { resetEnvCacheForTests } from '@/src/backend/config/env';
import { applyRequiredTestEnv } from '@/src/backend/test-helpers/env';

applyRequiredTestEnv({
  ADMIN_AUTH_EMAIL: 'admin@ringbooker.local',
  ADMIN_AUTH_PASSWORD: 'change_me_admin_password',
  TELNYX_SMS_INBOX_ALLOWED_NUMBERS: '+17145550123',
});
resetEnvCacheForTests();

async function loginAdmin(app: ReturnType<typeof createBackendApp>): Promise<string> {
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
  return cookieHeader;
}

test('admin SMS inbox requires admin session and exposes raw payload only in detail', async () => {
  const smsMessagesRepository = new InMemorySmsMessagesRepository();
  const saved = await smsMessagesRepository.saveInboundFromTelnyxEvent({
    telnyxEventId: 'evt-admin-sms-1',
    telnyxMessageId: 'msg-admin-sms-1',
    fromNumber: '+14155550110',
    toNumber: '+17145550123',
    body: 'Need an appointment',
    eventType: 'message.received',
    rawPayload: { data: { payload: { text: 'Need an appointment' } } },
    receivedAt: '2026-06-29T17:00:00.000Z',
  });
  await smsMessagesRepository.saveInboundFromTelnyxEvent({
    telnyxEventId: 'evt-admin-sms-outside',
    telnyxMessageId: 'msg-admin-sms-outside',
    fromNumber: '+14155550111',
    toNumber: '+17145550999',
    body: 'Outside',
    eventType: 'message.received',
    rawPayload: { data: { payload: { text: 'Outside' } } },
    receivedAt: '2026-06-29T18:00:00.000Z',
  });

  const app = createBackendApp({
    providerEventsRepository: new InMemoryProviderEventsRepository(),
    authUsersRepository: new InMemoryAuthUsersRepository(),
    smsMessagesRepository,
  });

  assert.equal((await app.request('/admin/sms')).status, 401);
  assert.equal((await app.request(`/admin/sms/${saved.record.id}`)).status, 401);
  assert.equal(
    (
      await app.request(`/admin/sms/${saved.record.id}/read`, {
        method: 'POST',
        headers: { origin: 'http://localhost:3000' },
      })
    ).status,
    401,
  );

  const cookie = await loginAdmin(app);
  const listResponse = await app.request('/admin/sms?read=all', {
    headers: { cookie },
  });
  assert.equal(listResponse.status, 200);
  const listBody = (await listResponse.json()) as {
    ok: boolean;
    items: Array<Record<string, unknown>>;
    pagination: { total: number };
  };
  assert.equal(listBody.ok, true);
  assert.equal(listBody.pagination.total, 1);
  assert.equal(listBody.items.length, 1);
  assert.equal(listBody.items[0]?.bodyPreview, 'Need an appointment');
  assert.equal(Object.prototype.hasOwnProperty.call(listBody.items[0], 'rawPayload'), false);
  assert.equal(Object.prototype.hasOwnProperty.call(listBody.items[0], 'body'), false);

  const detailResponse = await app.request(`/admin/sms/${saved.record.id}`, {
    headers: { cookie },
  });
  assert.equal(detailResponse.status, 200);
  const detailBody = (await detailResponse.json()) as {
    ok: boolean;
    message: { rawPayload?: unknown; body?: string | null; readAt?: string | null };
  };
  assert.equal(detailBody.ok, true);
  assert.equal(detailBody.message.body, 'Need an appointment');
  assert.deepEqual(detailBody.message.rawPayload, { data: { payload: { text: 'Need an appointment' } } });
  assert.equal(detailBody.message.readAt, null);

  const readResponse = await app.request(`/admin/sms/${saved.record.id}/read`, {
    method: 'POST',
    headers: { cookie, origin: 'http://localhost:3000' },
  });
  assert.equal(readResponse.status, 200);
  const readBody = (await readResponse.json()) as {
    ok: boolean;
    message: { readAt?: string | null };
  };
  assert.equal(readBody.ok, true);
  assert.ok(readBody.message.readAt);
});
