import test from 'node:test';
import assert from 'node:assert/strict';

import { InMemoryJobsRepository } from '@/src/backend/adapters/memory/jobs-repository';
import { JobExecutionError, JobWorker } from '@/src/backend/jobs/worker';

test('job worker retries with nextRunAt when handler throws retryable error', async () => {
  const repository = new InMemoryJobsRepository();
  const now = new Date('2026-04-07T00:00:00.000Z');
  const retryAt = new Date(now.getTime() + 5 * 60 * 1000);

  await repository.enqueue({
    shopId: 'demo-shop',
    type: 'review_request_sms',
    payload: { bookingId: 'booking-1' },
    runAt: now,
    idempotencyKey: 'job:test:retryable',
  });

  const worker = new JobWorker(
    repository,
    {
      review_request_sms: async () => {
        throw new JobExecutionError('temporary_failure', {
          retryable: true,
          nextRunAt: retryAt,
        });
      },
    },
    'test-worker',
    30,
  );

  const processed = await worker.tick(now);
  assert.equal(processed, true);

  const notReadyYet = await repository.leaseNext({
    now: new Date(now.getTime() + 60 * 1000),
    leaseSeconds: 30,
    workerId: 'probe-worker',
  });
  assert.equal(notReadyYet, null);

  const readyAfterBackoff = await repository.leaseNext({
    now: new Date(retryAt.getTime() + 1000),
    leaseSeconds: 30,
    workerId: 'probe-worker-2',
  });
  assert.ok(readyAfterBackoff);
  assert.equal(readyAfterBackoff.type, 'review_request_sms');
  assert.equal(readyAfterBackoff.attemptCount, 2);
});
