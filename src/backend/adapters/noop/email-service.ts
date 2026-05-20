import { logger } from '@/src/backend/observability/logger';
import { emailRecipientDomain } from '@/src/backend/services/email/recipient-domain';
import type { EmailCategory, EmailService, EmailSendResult } from '@/src/backend/services/email/types';

export class NoopEmailService implements EmailService {
  async sendEmail(params: {
    to: string;
    subject: string;
    text?: string;
    html?: string;
    category: EmailCategory;
    idempotencyKey: string;
    shopId?: string;
    replyTo?: string;
    from?: string;
  }): Promise<EmailSendResult> {
    logger.info(
      {
        event: 'email_send_skipped',
        provider: 'noop',
        category: params.category,
        idempotencyKey: params.idempotencyKey,
        recipientDomain: emailRecipientDomain(params.to),
        shopId: params.shopId ?? null,
      },
      'email_send_skipped',
    );
    return {
      providerMessageId: undefined,
    };
  }
}
