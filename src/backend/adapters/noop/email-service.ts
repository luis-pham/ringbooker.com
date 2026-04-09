import type { EmailService, EmailSendResult } from '@/src/backend/services/email/types';

export class NoopEmailService implements EmailService {
  async sendEmail(params: {
    to: string;
    subject: string;
    text?: string;
    html?: string;
    category:
      | 'welcome_signup'
      | 'password_reset'
      | 'booking_confirmation'
      | 'booking_reminder'
      | 'review_request'
      | 'contact_request';
    idempotencyKey: string;
    shopId?: string;
    replyTo?: string;
  }): Promise<EmailSendResult> {
    void params;
    return {
      providerMessageId: undefined,
    };
  }
}
