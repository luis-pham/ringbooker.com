import { logger } from '@/src/backend/observability/logger';
import { buildWelcomeSignupEmailPayload } from '@/src/backend/services/email/base-email-builders';
import { renderBaseEmailHtml } from '@/src/backend/services/email/base-email-mjml';
import { emailFounderFrom, emailReplyTo } from '@/src/backend/services/email/config';
import { emailRecipientDomain } from '@/src/backend/services/email/recipient-domain';
import { resolveEmailProviderMode } from '@/src/backend/services/email/startup';
import type { EmailService } from '@/src/backend/services/email/types';

export type SignupWelcomeMethod = 'email_password' | 'google';

export async function sendSignupWelcomeEmail(params: {
  emailService?: EmailService;
  email: string;
  shopName: string;
  shopId: string;
  authUserId: string;
  signupMethod: SignupWelcomeMethod;
  trialEndsAt?: string;
  shopTimezone?: string | null;
  appBaseUrl: string;
  idempotencyKey: string;
}): Promise<void> {
  const recipientDomain = emailRecipientDomain(params.email);
  const baseFields = {
    shopId: params.shopId,
    authUserId: params.authUserId,
    signupMethod: params.signupMethod,
    recipientDomain,
  };

  if (!params.emailService) {
    logger.warn(
      { ...baseFields, event: 'welcome_email_skipped', reason: 'email_service_unavailable' },
      'welcome_email_skipped',
    );
    return;
  }

  logger.info(
    {
      ...baseFields,
      event: 'welcome_email_requested',
      emailProvider: resolveEmailProviderMode(),
    },
    'welcome_email_requested',
  );

  try {
    const { input, text } = buildWelcomeSignupEmailPayload({
      email: params.email,
      shopName: params.shopName,
      trialEndsAt: params.trialEndsAt,
      shopTimezone: params.shopTimezone,
      appBaseUrl: params.appBaseUrl,
    });
    const html = await renderBaseEmailHtml(input);

    logger.info(
      { ...baseFields, event: 'welcome_email_send_started', category: 'welcome_signup' },
      'welcome_email_send_started',
    );

    const result = await params.emailService.sendEmail({
      to: params.email,
      subject: input.title,
      text,
      html,
      category: 'welcome_signup',
      idempotencyKey: params.idempotencyKey,
      shopId: params.shopId,
      from: emailFounderFrom(),
      replyTo: emailReplyTo(),
    });

    logger.info(
      {
        ...baseFields,
        event: 'welcome_email_send_succeeded',
        providerMessageId: result.providerMessageId ?? null,
      },
      'welcome_email_send_succeeded',
    );
  } catch (error) {
    logger.error(
      {
        ...baseFields,
        event: 'welcome_email_send_failed',
        err: error,
      },
      'welcome_email_send_failed',
    );
  }
}
