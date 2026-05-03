import { buildDemoRequestCustomerEmailPayload } from '@/src/backend/services/email/base-email-builders';

/** @deprecated Use `buildDemoRequestCustomerEmailPayload` + `renderBaseEmailHtml` in the API layer. Kept for tests. */
export function getDemoRequestConfirmationEmail(params: {
  firstName: string;
  businessName?: string;
  businessType?: string;
}): { subject: string; text: string } {
  const { input, text } = buildDemoRequestCustomerEmailPayload({
    firstName: params.firstName,
    businessName: params.businessName ?? '',
    businessType: params.businessType,
    demoCtaUrl: 'https://ringbooker.com/demo',
  });
  return { subject: input.title, text };
}
