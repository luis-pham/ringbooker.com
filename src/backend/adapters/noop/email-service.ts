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
    void params;
    return {
      providerMessageId: undefined,
    };
  }
}
