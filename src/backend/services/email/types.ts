export type EmailCategory =
  | 'welcome_signup'
  | 'password_reset'
  | 'booking_confirmation'
  | 'booking_reminder'
  | 'review_request'
  | 'contact_request'
  | 'demo_request_confirmation'
  | 'demo_request_internal';

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
    /** When set, overrides the default provider from-address (e.g. branded Resend from). */
    from?: string;
  }): Promise<EmailSendResult>;
}
