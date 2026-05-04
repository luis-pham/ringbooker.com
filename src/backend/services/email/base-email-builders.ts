import type { BaseEmailInput } from './base-email-types';
import { escapeHtmlText, isAbsoluteHttpOrHttpsUrl } from './base-email-escape';

function displayNameFromEmail(email: string): string {
  const local = email.split('@')[0]?.trim() ?? 'there';
  if (!local) return 'there';
  return local.replace(/[._-]+/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

function ensureAbsoluteBaseUrl(appBaseUrl: string): string {
  const base = appBaseUrl.replace(/\/+$/, '');
  if (!isAbsoluteHttpOrHttpsUrl(base)) {
    throw new Error('base_email_app_base_url_not_absolute');
  }
  return base;
}

function paymentMethodTrialCopy(paddleTrialConfigVerified?: boolean): string {
  return paddleTrialConfigVerified
    ? "A payment method is required before live answering. You won't be charged until your trial ends."
    : 'No card is needed for setup and test calls. A payment method is required before RingBooker answers real callers on your business number.';
}

export function buildWelcomeSignupEmailPayload(params: {
  email: string;
  shopName: string;
  trialEndsAt?: string | null;
  appBaseUrl: string;
  paddleTrialConfigVerified?: boolean;
}): { input: BaseEmailInput; text: string } {
  const base = ensureAbsoluteBaseUrl(params.appBaseUrl);
  const dashboardUrl = `${base}/user`;
  const onboardingUrl = `${base}/user/onboarding`;
  const billingUrl = `${base}/user/billing`;
  const businessName = escapeHtmlText(params.shopName);
  const customerName = escapeHtmlText(displayNameFromEmail(params.email));
  const trialPaymentCopy = paymentMethodTrialCopy(params.paddleTrialConfigVerified);
  const trialEndText = params.trialEndsAt
    ? new Intl.DateTimeFormat('en-US', { month: 'long', day: 'numeric', year: 'numeric' }).format(new Date(params.trialEndsAt))
    : '14 days from signup';

  const input: BaseEmailInput = {
    title: 'Welcome to RingBooker — your 14-day trial has started',
    previewText: 'No card is needed for setup and test calls. Add a payment method before live answering.',
    heroTitle: 'Your RingBooker trial has started',
    heroSubtitleHtml: `<p style="margin:0">Your account for <strong>${businessName}</strong> is ready. Your trial ends on <strong>${escapeHtmlText(trialEndText)}</strong>.</p>`,
    greetingHtml: `<p style="margin:0">Hi ${customerName},</p>`,
    bodyHtml: [
      `<p style="margin:0 0 12px 0">Welcome to RingBooker — your account for <strong>${businessName}</strong> is ready.</p>`,
      `<p style="margin:0 0 12px 0">Your AI receptionist setup has been created. Next, review your business details, services, hours, and call handling preferences before RingBooker answers real callers.</p>`,
      `<p style="margin:0 0 12px 0">${escapeHtmlText(trialPaymentCopy)}</p>`,
      `<p style="margin:0">Most businesses can finish onboarding in a few minutes.</p>`,
    ].join(''),
    secondaryBodyHtml:
      `<p style="margin:0">After setup, you can test your AI receptionist, then add a payment method on the billing page when you are ready to go live.</p><p style="margin:12px 0 0 0"><a href="${billingUrl}">Add payment method</a></p>`,
    ctaLabel: 'Complete onboarding',
    ctaUrl: onboardingUrl,
    signatureHtml: '<p style="margin:0">Thanks,<br />Luis Pham<br />RingBooker</p>',
    securityNote: 'If you did not create a RingBooker account, you can safely ignore this email.',
  };

  const text = [
    `Hi ${displayNameFromEmail(params.email)},`,
    '',
    `Welcome to RingBooker. Your account for "${params.shopName}" is ready.`,
    `Your 14-day trial ends on ${trialEndText}.`,
    '',
    'Next step: complete your setup and start taking calls.',
    `Dashboard: ${dashboardUrl}`,
    `Onboarding: ${onboardingUrl}`,
    '',
    trialPaymentCopy,
    `Billing: ${billingUrl}`,
    '',
    'If you did not create a RingBooker account, you can safely ignore this email.',
    '',
    'Thanks,',
    'Luis Pham',
    'RingBooker',
  ].join('\n');

  return { input, text };
}

export function buildTrialReminderEmailPayload(params: {
  email: string;
  shopName: string;
  daysRemaining: 7 | 3 | 1;
  trialEndsAt: string;
  appBaseUrl: string;
  paddleTrialConfigVerified?: boolean;
}): { input: BaseEmailInput; text: string } {
  const base = ensureAbsoluteBaseUrl(params.appBaseUrl);
  const billingUrl = `${base}/user/billing`;
  const businessName = escapeHtmlText(params.shopName);
  const trialEndText = new Intl.DateTimeFormat('en-US', { month: 'long', day: 'numeric', year: 'numeric' }).format(
    new Date(params.trialEndsAt),
  );
  const trialPaymentCopy = paymentMethodTrialCopy(params.paddleTrialConfigVerified);
  const input: BaseEmailInput = {
    title: `Your RingBooker trial ends in ${params.daysRemaining} day${params.daysRemaining === 1 ? '' : 's'}`,
    previewText: params.paddleTrialConfigVerified
      ? "Add a payment method before go-live. You won't be charged until your trial ends."
      : 'Add a payment method before live answering.',
    heroTitle: `Trial ends in ${params.daysRemaining} day${params.daysRemaining === 1 ? '' : 's'}`,
    heroSubtitleHtml: `<p style="margin:0">Your trial for <strong>${businessName}</strong> ends on <strong>${escapeHtmlText(trialEndText)}</strong>.</p>`,
    greetingHtml: `<p style="margin:0">Hi ${escapeHtmlText(displayNameFromEmail(params.email))},</p>`,
    bodyHtml: `<p style="margin:0 0 12px 0">${escapeHtmlText(trialPaymentCopy)}</p>`,
    ctaLabel: 'Add payment method',
    ctaUrl: billingUrl,
    signatureHtml: '<p style="margin:0">Thanks,<br />Luis Pham<br />RingBooker</p>',
  };
  const text = [
    `Your RingBooker trial for "${params.shopName}" ends in ${params.daysRemaining} day${params.daysRemaining === 1 ? '' : 's'} (${trialEndText}).`,
    trialPaymentCopy,
    `Add payment method: ${billingUrl}`,
  ].join('\n');
  return { input, text };
}

export function buildTrialEndedEmailPayload(params: {
  email: string;
  shopName: string;
  appBaseUrl: string;
}): { input: BaseEmailInput; text: string } {
  const base = ensureAbsoluteBaseUrl(params.appBaseUrl);
  const billingUrl = `${base}/user/billing`;
  const businessName = escapeHtmlText(params.shopName);
  const input: BaseEmailInput = {
    title: 'Your RingBooker trial has ended',
    previewText: 'RingBooker is paused and no longer answering live calls.',
    heroTitle: 'Your trial has ended',
    heroSubtitleHtml: `<p style="margin:0">RingBooker is paused for <strong>${businessName}</strong>.</p>`,
    greetingHtml: `<p style="margin:0">Hi ${escapeHtmlText(displayNameFromEmail(params.email))},</p>`,
    bodyHtml:
      '<p style="margin:0 0 12px 0">RingBooker is paused and no longer answering live calls. You can still log in, review your setup, and add a payment method to reactivate.</p>',
    ctaLabel: 'Reactivate RingBooker',
    ctaUrl: billingUrl,
    signatureHtml: '<p style="margin:0">Thanks,<br />Luis Pham<br />RingBooker</p>',
  };
  const text = [
    `Your RingBooker trial for "${params.shopName}" has ended.`,
    'RingBooker is paused and no longer answering live calls.',
    `Reactivate: ${billingUrl}`,
  ].join('\n');
  return { input, text };
}

export function buildDemoRequestCustomerEmailPayload(params: {
  firstName: string;
  businessName: string;
  businessType?: string;
  /** When set to an absolute URL, CTA is shown; otherwise no CTA block. */
  demoCtaUrl?: string | null;
}): { input: BaseEmailInput; text: string } {
  const name = escapeHtmlText(params.firstName.trim() || 'there');
  const business = escapeHtmlText(params.businessName.trim() || 'your business');
  const ctaUrl = params.demoCtaUrl?.trim() ?? '';
  const hasCta = Boolean(ctaUrl && isAbsoluteHttpOrHttpsUrl(ctaUrl));

  const input: BaseEmailInput = {
    title: 'We received your RingBooker demo request',
    previewText: 'Thanks for requesting a RingBooker demo. We’ll follow up soon.',
    heroTitle: 'We received your request',
    heroSubtitleHtml: `<p style="margin:0">Thanks for requesting a RingBooker demo for <strong>${business}</strong>.</p>`,
    greetingHtml: `<p style="margin:0">Hi ${name},</p>`,
    bodyHtml: [
      `<p style="margin:0 0 12px 0">Thanks for requesting a RingBooker demo for <strong>${business}</strong>.</p>`,
      `<p style="margin:0 0 12px 0">We received your request and will review your details shortly.</p>`,
      `<p style="margin:0">RingBooker helps salons, spas, med spas, and beauty businesses answer missed, busy, and after-hours calls without changing the way their team already works.</p>`,
    ].join(''),
    secondaryBodyHtml: '<p style="margin:0">We’ll follow up soon with the next step.</p>',
    ...(hasCta
      ? {
          ctaLabel: 'View RingBooker',
          ctaUrl,
        }
      : {}),
    signatureHtml: '<p style="margin:0">Thanks,<br />Luis Pham<br />RingBooker</p>',
    securityNote: 'You received this email because you submitted a request on RingBooker.com.',
  };

  const lines = [
    `Hi ${params.firstName.trim() || 'there'},`,
    '',
    `Thanks for requesting a RingBooker demo for ${params.businessName.trim() || 'your business'}!`,
    '',
    'We received your request and will review your details shortly.',
    '',
    'RingBooker helps salons, spas, med spas, and beauty businesses answer missed, busy, and after-hours calls.',
    '',
    'We’ll follow up soon with the next step.',
  ];
  if (hasCta) lines.push('', ctaUrl);
  lines.push(
    '',
    'Thanks,',
    'Luis Pham, RingBooker',
    '',
    '---',
    'RingBooker · AI receptionist for beauty businesses',
    'hello@ringbooker.com | ringbooker.com',
  );

  return { input, text: lines.join('\n') };
}

export function buildPasswordResetEmailPayload(params: {
  email: string;
  resetUrl: string;
  role: 'user' | 'admin';
}): { input: BaseEmailInput; text: string } {
  if (!isAbsoluteHttpOrHttpsUrl(params.resetUrl)) {
    throw new Error('base_email_reset_url_not_absolute');
  }
  const isAdmin = params.role === 'admin';
  const title = isAdmin ? 'Reset your RingBooker admin password' : 'Reset your RingBooker password';
  const heroTitle = isAdmin ? 'Reset your admin password' : 'Reset your password';
  const customerName = escapeHtmlText(displayNameFromEmail(params.email));

  const bodyIntro = isAdmin
    ? '<p style="margin:0">We received a request to reset the password for your RingBooker <strong>admin</strong> account.</p>'
    : '<p style="margin:0">We received a request to reset the password for your RingBooker account.</p>';

  const input: BaseEmailInput = {
    title,
    previewText: 'Use the link below to reset your RingBooker password.',
    heroTitle,
    heroSubtitleHtml: '<p style="margin:0">Use the button below to reset your RingBooker password.</p>',
    greetingHtml: `<p style="margin:0">Hi ${customerName},</p>`,
    bodyHtml: bodyIntro,
    ctaLabel: 'Reset password',
    ctaUrl: params.resetUrl.trim(),
    secondaryBodyHtml:
      '<p style="margin:0">If you did not request this, you can safely ignore this email. Your password will not be changed unless you use the link above.</p>',
    signatureHtml: '<p style="margin:0">Thanks,<br />RingBooker</p>',
    securityNote: 'For your security, this reset link may expire after a short time.',
  };

  const intro = isAdmin
    ? 'We received a request to reset the password for your RingBooker admin account.'
    : 'We received a request to reset the password for your RingBooker account.';
  const text = [
    intro,
    '',
    'Click the link below (valid for 30 minutes):',
    params.resetUrl.trim(),
    '',
    'If you did not request this, you can safely ignore this email.',
    '',
    'For your security, this reset link may expire after a short time.',
    '',
    '— RingBooker',
  ].join('\n');

  return { input, text };
}
