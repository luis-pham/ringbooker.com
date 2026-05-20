import { getEnv } from '@/src/backend/config/env';
import { logger } from '@/src/backend/observability/logger';
import { emailAddressDomain } from '@/src/backend/services/email/recipient-domain';

export type BackendEmailProviderMode = 'noop' | 'resend';

export function resolveEmailProviderMode(): BackendEmailProviderMode {
  return process.env.EMAIL_PROVIDER === 'resend' ? 'resend' : 'noop';
}

/** Logs email provider and from domains at startup. Never logs RESEND_API_KEY. */
export function logEmailRuntimeStartup(emailProvider: BackendEmailProviderMode): void {
  const env = getEnv();
  logger.info(
    {
      emailProvider,
      emailFromDomain: emailAddressDomain(env.EMAIL_FROM_ADDRESS),
      emailFounderFromDomain: emailAddressDomain(env.EMAIL_FOUNDER_FROM),
    },
    'email_runtime_configured',
  );

  if (process.env.NODE_ENV === 'production' && emailProvider === 'noop') {
    logger.error(
      { emailProvider },
      'production_email_provider_is_noop_set_EMAIL_PROVIDER_resend',
    );
    throw new Error('production_email_provider_is_noop');
  }
}
