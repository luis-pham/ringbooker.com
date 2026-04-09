import { randomUUID } from 'node:crypto';

import type { JobStatus, JobType } from '@/src/backend/domain/types';
import type { JobsRepository } from '@/src/backend/ports/repositories';

type MemoryJob = {
  id: string;
  type: JobType;
  shopId: string;
  payload: Record<string, unknown>;
  status: JobStatus;
  runAt: Date;
  attempts: number;
  maxAttempts: number;
  lockToken?: string;
  lockedAt?: Date;
  idempotencyKey: string;
  lastError?: string;
};

export class InMemoryJobsRepository implements JobsRepository {
  private readonly jobs: MemoryJob[] = [];

  async enqueue(params: {
    shopId: string;
    type: JobType;
    payload: Record<string, unknown>;
    runAt: Date;
    idempotencyKey: string;
  }): Promise<void> {
    const existing = this.jobs.find((job) => job.idempotencyKey === params.idempotencyKey);
    if (existing) return;

    this.jobs.push({
      id: randomUUID(),
      type: params.type,
      shopId: params.shopId,
      payload: params.payload,
      status: 'queued',
      runAt: params.runAt,
      attempts: 0,
      maxAttempts: 5,
      idempotencyKey: params.idempotencyKey,
    });
  }

  async leaseNext(params: {
    now: Date;
    leaseSeconds: number;
    workerId: string;
  }): Promise<{
    id: string;
    shopId: string;
    type: JobType;
    payload: Record<string, unknown>;
    attemptCount: number;
  } | null> {
    const nowMs = params.now.getTime();
    const leaseMs = params.leaseSeconds * 1000;

    const nextJob = this.jobs.find((job) => {
      if (job.status !== 'queued') return false;
      if (job.runAt.getTime() > nowMs) return false;
      if (!job.lockedAt) return true;
      return nowMs - job.lockedAt.getTime() > leaseMs;
    });

    if (!nextJob) return null;

    nextJob.status = 'leased';
    nextJob.lockedAt = params.now;
    nextJob.lockToken = params.workerId;
    nextJob.attempts += 1;

    return {
      id: nextJob.id,
      shopId: nextJob.shopId,
      type: nextJob.type,
      payload: nextJob.payload,
      attemptCount: nextJob.attempts,
    };
  }

  async complete(jobId: string): Promise<void> {
    const job = this.jobs.find((entry) => entry.id === jobId);
    if (!job) return;
    job.status = 'completed';
    job.lockedAt = undefined;
    job.lockToken = undefined;
  }

  async fail(jobId: string, params: { retryable: boolean; reason: string; nextRunAt?: Date }): Promise<void> {
    const job = this.jobs.find((entry) => entry.id === jobId);
    if (!job) return;

    job.lastError = params.reason;
    job.lockedAt = undefined;
    job.lockToken = undefined;

    if (!params.retryable || job.attempts >= job.maxAttempts) {
      job.status = params.retryable && job.attempts >= job.maxAttempts ? 'dead_letter' : 'failed';
      return;
    }

    job.status = 'queued';
    job.runAt = params.nextRunAt ?? new Date(Date.now() + 60_000);
  }

  async updateStatus(jobId: string, status: JobStatus): Promise<void> {
    const job = this.jobs.find((entry) => entry.id === jobId);
    if (!job) return;
    job.status = status;
  }

  async getStatusCounts(): Promise<Partial<Record<JobStatus, number>>> {
    const counts: Partial<Record<JobStatus, number>> = {};
    for (const job of this.jobs) {
      counts[job.status] = (counts[job.status] ?? 0) + 1;
    }
    return counts;
  }
}
