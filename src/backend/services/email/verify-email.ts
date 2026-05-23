import { logger } from '@/src/backend/observability/logger';
import { renderBaseEmailHtml } from '@/src/backend/services/email/base-email-mjml';
import type { BaseEmailInput } from '@/src/backend/services/email/base-email-types';
import { escapeHtmlText, isAbsoluteHttpOrHttpsUrl } from '@/src/backend/services/email/base-email-escape';
import { emailFounderFrom, emailReplyTo } from '@/src/backend/services/email/config';
import { emailRecipientDomain } from '@/src/backend/services/email/recipient-domain';
import { resolveEmailProviderMode } from '@/src/backend/services/email/startup';
import type { EmailService } from '@/src/backend/services/email/types';

function ensureAbsoluteBaseUrl(appBaseUrl: string): string {
  const base = appBaseUrl.replace(/\/+$/, '');
  if (!isAbsoluteHttpOrHttpsUrl(base)) {
    throw new Error('verify_email_app_base_url_not_absolute');
  }
  return base;
}

function displayNameFromEmail(email: string): string {
  const local = email.split('@')[0]?.trim() ?? 'there';
  if (!local) return 'there';
  return local.replace(/[._-]+/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

export async function sendVerifyEmail(params: {
  emailService?: EmailService;
  email: string;
  shopName: string;
  shopId: string;
  authUserId: string;
  rawToken: string;
  appBaseUrl: string;
  idempotencyKey: string;
}): Promise<void> {
  const recipientDomain = emailRecipientDomain(params.email);
  const baseFields = {
    shopId: params.shopId,
    authUserId: params.authUserId,
    recipientDomain,
  };

  if (!params.emailService) {
    logger.warn(
      { ...baseFields, event: 'verify_email_skipped', reason: 'email_service_unavailable' },
      'verify_email_skipped',
    );
    return;
  }

  logger.info(
    {
      ...baseFields,
      event: 'verify_email_requested',
      emailProvider: resolveEmailProviderMode(),
    },
    'verify_email_requested',
  );

  try {
    const base = ensureAbsoluteBaseUrl(params.appBaseUrl);
    const verifyUrl = `${base}/verify-email?token=${encodeURIComponent(params.rawToken)}`;
    const input: BaseEmailInput = {
      title: 'Confirm your RingBooker email',
      previewText: 'Confirm your email address to finish securing your RingBooker account.',
      heroTitle: 'Confirm your email',
      heroSubtitleHtml: `<p style="margin:0">Confirm the email address for <strong>${escapeHtmlText(params.shopName)}</strong>.</p>`,
      greetingHtml: `<p style="margin:0">Hi ${escapeHtmlText(displayNameFromEmail(params.email))},</p>`,
      bodyHtml: '<p style="margin:0 0 12px 0">Please confirm your email address so we know this RingBooker account belongs to you.</p><p style="margin:0">This link expires in 24 hours.</p>',
      ctaLabel: 'Confirm email',
      ctaUrl: verifyUrl,
      signatureHtml: '<p style="margin:0">Thanks,<br />Luis Pham<br />RingBooker</p>',
      securityNote: 'If you did not create a RingBooker account, you can safely ignore this email.',
    };
    const text = [
      `Hi ${displayNameFromEmail(params.email)},`,
      '',
      `Please confirm your email address for "${params.shopName}" using the button in this email.`,
      'This link expires in 24 hours.',
      '',
      'If you did not create a RingBooker account, you can safely ignore this email.',
    ].join('\n');
    const html = await renderBaseEmailHtml(input);

    logger.info(
      { ...baseFields, event: 'verify_email_send_started', category: 'email_verification' },
      'verify_email_send_started',
    );

    const result = await params.emailService.sendEmail({
      to: params.email,
      subject: 'Confirm your RingBooker email',
      text,
      html,
      category: 'email_verification',
      idempotencyKey: params.idempotencyKey,
      shopId: params.shopId,
      from: emailFounderFrom(),
      replyTo: emailReplyTo(),
    });

    logger.info(
      {
        ...baseFields,
        event: 'verify_email_send_succeeded',
        providerMessageId: result.providerMessageId ?? null,
      },
      'verify_email_send_succeeded',
    );
  } catch (error) {
    logger.error(
      {
        ...baseFields,
        event: 'verify_email_send_failed',
        err: error,
      },
      'verify_email_send_failed',
    );
  }
}
