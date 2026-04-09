export type EmailCategory =
  | 'welcome_signup'
  | 'password_reset'
  | 'booking_confirmation'
  | 'booking_reminder'
  | 'review_request'
  | 'contact_request';

export type EmailSendResult = {
  providerMessageId?: string;
};

export interface EmailService {
  sendEmail(params: {
    to: string;
    subject: string;
    text?: string;
    html?: string;
    category: EmailCategory;
    idempotencyKey: string;
    shopId?: string;
    replyTo?: string;
  }): Promise<EmailSendResult>;
}
