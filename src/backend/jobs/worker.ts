import type { JobType } from '@/src/backend/domain/types';
import type { JobsRepository } from '@/src/backend/ports/repositories';
import { logger } from '@/src/backend/observability/logger';
import { incrementMetric, observeDurationMs } from '@/src/backend/observability/metrics';

export class JobExecutionError extends Error {
  readonly retryable: boolean;
  readonly nextRunAt?: Date;

  constructor(message: string, options?: { retryable?: boolean; nextRunAt?: Date }) {
    super(message);
    this.name = 'JobExecutionError';
    this.retryable = options?.retryable ?? true;
    this.nextRunAt = options?.nextRunAt;
  }
}

type JobHandler = (params: {
  jobId: string;
  shopId: string;
  payload: Record<string, unknown>;
  attemptCount: number;
}) => Promise<void>;

type HandlerMap = Partial<Record<JobType, JobHandler>>;
const DEFAULT_MAX_ATTEMPTS = 5;

export class JobWorker {
  constructor(
    private readonly jobsRepository: JobsRepository,
    private readonly handlers: HandlerMap,
    private readonly workerId: string,
    private readonly leaseSeconds: number,
  ) {}

  async tick(now = new Date()): Promise<boolean> {
    const job = await this.jobsRepository.leaseNext({
      now,
      leaseSeconds: this.leaseSeconds,
      workerId: this.workerId,
    });

    if (!job) return false;

    const handler = this.handlers[job.type];
    if (!handler) {
      await this.jobsRepository.fail(job.id, {
        retryable: false,
        reason: `missing_handler:${job.type}`,
      });
      return true;
    }

    try {
      const startedAt = Date.now();
      await handler({
        jobId: job.id,
        shopId: job.shopId,
        payload: job.payload,
        attemptCount: job.attemptCount,
      });
      observeDurationMs('job_handler_duration_ms', Date.now() - startedAt, {
        type: job.type,
        outcome: 'success',
      });
      await this.jobsRepository.complete(job.id);
      incrementMetric('jobs_completed_total', {
        type: job.type,
      });
    } catch (error) {
      logger.error({ err: error, jobId: job.id, type: job.type }, 'job_failed');
      const retryable = error instanceof JobExecutionError ? error.retryable : true;
      const nextRunAt = error instanceof JobExecutionError ? error.nextRunAt : undefined;
      incrementMetric('jobs_failed_total', {
        type: job.type,
        retryable,
      });
      if (retryable && job.attemptCount >= DEFAULT_MAX_ATTEMPTS) {
        incrementMetric('jobs_dead_letter_total', {
          type: job.type,
        });
        logger.error(
          {
            jobId: job.id,
            type: job.type,
            attemptCount: job.attemptCount,
            reason: error instanceof Error ? error.message : 'handler_error',
          },
          'job_dead_letter_alert',
        );
      }
      await this.jobsRepository.fail(job.id, {
        retryable,
        reason: error instanceof Error ? error.message : 'handler_error',
        nextRunAt,
      });
    }
    return true;
  }
}
