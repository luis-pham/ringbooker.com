import test from 'node:test';
import assert from 'node:assert/strict';

import { scheduleCallbackTool } from '@/src/agent/tools/schedule-callback';
import type { AgentToolContext } from '@/src/agent/tools/types';
import { InMemoryCallbacksRepository } from '@/src/backend/adapters/memory/callbacks-repository';
import { InMemoryJobsRepository } from '@/src/backend/adapters/memory/jobs-repository';
import { InMemoryShopsRepository } from '@/src/backend/adapters/memory/shops-repository';
import { NoopTelephonyService } from '@/src/backend/adapters/noop/telephony-service';

test('schedule_callback captures follow-up and only queues owner SMS alert', async () => {
  const shopsRepository = new InMemoryShopsRepository();
  const shop = await shopsRepository.findById('demo-shop');
  assert.ok(shop);

  const jobsRepository = new InMemoryJobsRepository();
  const ctx: AgentToolContext = {
    shop,
    callerPhone: '+14155550199',
    requestId: 'callback-request-test',
    roomName: 'test-room',
    calendarProvider: {} as AgentToolContext['calendarProvider'],
    jobsRepository,
    bookingsRepository: {} as AgentToolContext['bookingsRepository'],
    callbacksRepository: new InMemoryCallbacksRepository(),
    shopsRepository,
    telephonyService: new NoopTelephonyService(),
  };

  const result = await scheduleCallbackTool(ctx, {
    customerName: 'Jane Caller',
    reason: 'Needs help rescheduling an appointment.',
  });

  assert.equal('success' in result && result.success, true);

  const leased = await jobsRepository.leaseNext({
    now: new Date(),
    leaseSeconds: 30,
    workerId: 'test-worker',
  });
  assert.ok(leased);
  assert.equal(leased.type, 'callback_request_owner_alert');
  assert.equal(leased.payload.callerPhone, '+14155550199');
  assert.equal(leased.payload.callerName, 'Jane Caller');
  assert.equal(leased.payload.reason, 'Needs help rescheduling an appointment.');
  assert.equal(typeof leased.payload.callbackId, 'string');

  const secondJob = await jobsRepository.leaseNext({
    now: new Date(),
    leaseSeconds: 30,
    workerId: 'test-worker',
  });
  assert.equal(secondJob, null);
});
