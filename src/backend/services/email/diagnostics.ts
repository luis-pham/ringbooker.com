import type { JobStatus } from '@/src/backend/domain/types';
import type { BillingNotificationsRepository, JobsRepository } from '@/src/backend/ports/repositories';
import { resolveEmailProviderMode } from '@/src/backend/services/email/startup';
import { emailAddressDomain } from '@/src/backend/services/email/recipient-domain';
import { emailDefaultFrom, emailFounderFrom } from '@/src/backend/services/email/config';

const LIFECYCLE_EMAIL_JOB_TYPE = 'lifecycle_email' as const;
const PENDING_JOB_STATUSES: JobStatus[] = ['queued', 'running', 'leased'];
const FAILED_JOB_STATUSES: JobStatus[] = ['failed', 'dead_letter'];

export type EmailLifecycleDiagnostics = {
  emailProvider: 'noop' | 'resend';
  emailFromDomain: string;
  emailFounderFromDomain: string;
  lifecycleEmailJobs: {
    pending: number;
    failed: number;
  };
  recentBillingEmailNotifications: Array<{
    shopId: string;
    type: string;
    sentAt: string;
    skipped?: boolean;
    skipReason?: string;
  }>;
};

export async function collectEmailLifecycleDiagnostics(deps: {
  jobsRepository: JobsRepository;
  billingNotificationsRepository?: BillingNotificationsRepository;
}): Promise<EmailLifecycleDiagnostics> {
  const emailProvider = resolveEmailProviderMode();
  const [pending, failed, recentBillingEmailNotifications] = await Promise.all([
    deps.jobsRepository.countByTypeAndStatuses({
      type: LIFECYCLE_EMAIL_JOB_TYPE,
      statuses: PENDING_JOB_STATUSES,
    }),
    deps.jobsRepository.countByTypeAndStatuses({
      type: LIFECYCLE_EMAIL_JOB_TYPE,
      statuses: FAILED_JOB_STATUSES,
    }),
    deps.billingNotificationsRepository
      ? deps.billingNotificationsRepository.listRecentEmailSent({ limit: 25 })
      : Promise.resolve([]),
  ]);

  return {
    emailProvider,
    emailFromDomain: emailAddressDomain(emailDefaultFrom()),
    emailFounderFromDomain: emailAddressDomain(emailFounderFrom()),
    lifecycleEmailJobs: { pending, failed },
    recentBillingEmailNotifications: recentBillingEmailNotifications.map((row) => {
      const metadata = row.metadata ?? {};
      const skipped = metadata.skipped === true;
      const skipReason = typeof metadata.reason === 'string' ? metadata.reason : undefined;
      return {
        shopId: row.shopId,
        type: row.type,
        sentAt: row.sentAt,
        ...(skipped ? { skipped: true, skipReason } : {}),
      };
    }),
  };
}
