import { logger } from '@/src/backend/observability/logger';
import { startJobsWorker } from '@/src/backend/jobs/runner';

const controls = startJobsWorker();

function shutdown(signal: string) {
  logger.info({ signal }, 'jobs_worker_shutdown_requested');
  controls.stop();
  process.exit(0);
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
