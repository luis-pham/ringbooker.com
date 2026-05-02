export const EMAIL_DEFAULT_FROM = 'Ringbooker <notifications@send.ringbooker.com>';
export const EMAIL_FOUNDER_FROM_DEFAULT = 'Luis Pham from RingBooker <luis@send.ringbooker.com>';
export const EMAIL_REPLY_TO_DEFAULT = 'hello@ringbooker.com';
export const EMAIL_SUPPORT_ADDRESS_DEFAULT = 'support@ringbooker.com';

export function emailDefaultFrom(): string {
  return process.env.EMAIL_FROM_ADDRESS?.trim() || EMAIL_DEFAULT_FROM;
}

export function emailFounderFrom(): string {
  return process.env.EMAIL_FOUNDER_FROM?.trim() || EMAIL_FOUNDER_FROM_DEFAULT;
}

export function emailReplyTo(): string {
  return process.env.EMAIL_REPLY_TO?.trim() || EMAIL_REPLY_TO_DEFAULT;
}

export function emailSupportAddress(): string {
  return process.env.EMAIL_SUPPORT_ADDRESS?.trim() || EMAIL_SUPPORT_ADDRESS_DEFAULT;
}

export function contactSalesEmail(): string {
  return process.env.CONTACT_SALES_EMAIL?.trim() || emailReplyTo();
}
