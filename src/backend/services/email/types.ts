export type EmailCategory =
  | 'welcome_signup'
  | 'password_reset'
  | 'booking_confirmation'
  | 'booking_reminder'
  | 'review_request'
  | 'contact_request'
  | 'demo_request_confirmation'
  | 'demo_request_internal'
  | 'billing_trial_reminder'
  | 'billing_trial_ended'
  | 'finish_onboarding_reminder'
  | 'add_payment_method_go_live'
  | 'billing_payment_method_added'
  | 'billing_subscription_active'
  | 'billing_payment_failed'
  | 'forwarding_number_ready'
  | 'forwarding_number_failed'
  | 'forwarding_not_verified_reminder'
  | 'forwarding_verified'
  | 'live_answering_enabled'
  | 'live_answering_billing_paused'
  | 'live_answering_billing_restored'
  | 'internal_alert';

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
