import type { BaseEmailInput } from './base-email-types';
import { escapeHtmlText, isAbsoluteHttpOrHttpsUrl } from './base-email-escape';
import { formatShopLongDate } from '@/src/shared/timezone';

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
    ? "Start your 14-day trial before RingBooker answers real callers on your business number. Due today: $0. You won't be charged until your 14-day trial ends. Final total may include applicable taxes based on your location."
    : 'No card is needed for setup and test calls. Start your 14-day trial before RingBooker answers real callers on your business number. Due today: $0. Final total may include applicable taxes based on your location.';
}

export function buildWelcomeSignupEmailPayload(params: {
  email: string;
  shopName: string;
  trialEndsAt?: string | null;
  shopTimezone?: string | null;
  appBaseUrl: string;
}): { input: BaseEmailInput; text: string } {
  const base = ensureAbsoluteBaseUrl(params.appBaseUrl);
  const dashboardUrl = `${base}/user`;
  const onboardingUrl = `${base}/user/onboarding`;
  const businessName = escapeHtmlText(params.shopName);
  const customerName = escapeHtmlText(displayNameFromEmail(params.email));
  const trialEndText = params.trialEndsAt
    ? formatShopLongDate(params.trialEndsAt, params.shopTimezone)
    : '14 days from signup';

  const input: BaseEmailInput = {
    title: 'Welcome to RingBooker — finish your AI receptionist setup',
    previewText: 'Set up and test RingBooker without changing your current business number.',
    heroTitle: 'Welcome to RingBooker',
    heroSubtitleHtml: `<p style="margin:0">Your account for <strong>${businessName}</strong> is ready. Your trial ends on <strong>${escapeHtmlText(trialEndText)}</strong>.</p>`,
    greetingHtml: `<p style="margin:0">Hi ${customerName},</p>`,
    bodyHtml: [
      `<p style="margin:0 0 12px 0">RingBooker helps answer missed, busy, and after-hours calls for <strong>${businessName}</strong>.</p>`,
      '<p style="margin:0 0 12px 0">You keep your current business number. During setup, you can review your business details, services, hours, and call handling preferences before RingBooker answers real callers.</p>',
      '<p style="margin:0">No card is needed for setup and test calls. Live answering is not active yet.</p>',
    ].join(''),
    ctaLabel: 'Complete onboarding',
    ctaUrl: onboardingUrl,
    signatureHtml: '<p style="margin:0">Thanks,<br />Luis Pham<br />RingBooker</p>',
    securityNote: 'If you did not create a RingBooker account, you can safely ignore this email.',
  };

  const text = [
    `Hi ${displayNameFromEmail(params.email)},`,
    '',
    `Welcome to RingBooker. Your account for "${params.shopName}" is ready.`,
    `Your trial ends on ${trialEndText}.`,
    '',
    'RingBooker helps answer missed, busy, and after-hours calls.',
    'You keep your current business number. No card is needed for setup and test calls.',
    'Live answering is not active yet.',
    '',
    'Next step: complete onboarding to finish your setup.',
    `Dashboard: ${dashboardUrl}`,
    `Onboarding: ${onboardingUrl}`,
    '',
    'No card is needed for setup and test calls.',
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
  shopTimezone?: string | null;
  appBaseUrl: string;
  paddleTrialConfigVerified?: boolean;
}): { input: BaseEmailInput; text: string } {
  const base = ensureAbsoluteBaseUrl(params.appBaseUrl);
  const billingUrl = `${base}/user/billing`;
  const businessName = escapeHtmlText(params.shopName);
  const trialEndText = formatShopLongDate(params.trialEndsAt, params.shopTimezone);
  const trialPaymentCopy = paymentMethodTrialCopy(params.paddleTrialConfigVerified);
  const input: BaseEmailInput = {
    title: `Your RingBooker trial ends in ${params.daysRemaining} day${params.daysRemaining === 1 ? '' : 's'}`,
    previewText: params.paddleTrialConfigVerified
      ? "Start your 14-day trial before go-live. You won't be charged until your 14-day trial ends."
      : 'Start your 14-day trial before live answering.',
    heroTitle: `Trial ends in ${params.daysRemaining} day${params.daysRemaining === 1 ? '' : 's'}`,
    heroSubtitleHtml: `<p style="margin:0">Your trial for <strong>${businessName}</strong> ends on <strong>${escapeHtmlText(trialEndText)}</strong>.</p>`,
    greetingHtml: `<p style="margin:0">Hi ${escapeHtmlText(displayNameFromEmail(params.email))},</p>`,
    bodyHtml: [
      `<p style="margin:0 0 12px 0">${escapeHtmlText(trialPaymentCopy)}</p>`,
      '<p style="margin:0">Live answering only starts after billing is valid and phone forwarding is connected.</p>',
    ].join(''),
    ctaLabel: 'Start 14-day trial',
    ctaUrl: billingUrl,
    signatureHtml: '<p style="margin:0">Thanks,<br />Luis Pham<br />RingBooker</p>',
  };
  const text = [
    `Your RingBooker trial for "${params.shopName}" ends in ${params.daysRemaining} day${params.daysRemaining === 1 ? '' : 's'} (${trialEndText}).`,
    trialPaymentCopy,
    'Live answering only starts after billing is valid and phone forwarding is connected.',
    `Start 14-day trial: ${billingUrl}`,
  ].join('\n');
  return { input, text };
}

export function buildTrialEndedEmailPayload(params: {
  email: string;
  shopName: string;
  appBaseUrl: string;
  trialEndsAt?: string | null;
  shopTimezone?: string | null;
}): { input: BaseEmailInput; text: string } {
  const base = ensureAbsoluteBaseUrl(params.appBaseUrl);
  const billingUrl = `${base}/user/billing`;
  const businessName = escapeHtmlText(params.shopName);
  const trialEndText = params.trialEndsAt ? formatShopLongDate(params.trialEndsAt, params.shopTimezone) : null;
  const input: BaseEmailInput = {
    title: 'Your RingBooker trial has ended',
    previewText: 'Live answering is paused until billing is resolved.',
    heroTitle: 'Your trial has ended',
    heroSubtitleHtml: `<p style="margin:0">RingBooker is paused for <strong>${businessName}</strong>.</p>`,
    greetingHtml: `<p style="margin:0">Hi ${escapeHtmlText(displayNameFromEmail(params.email))},</p>`,
    bodyHtml: [
      `<p style="margin:0 0 12px 0">Your trial${trialEndText ? ` ended on ${escapeHtmlText(trialEndText)}` : ' has ended'}. Live answering is paused until billing is resolved.</p>`,
      '<p style="margin:0">You can still log in, review your setup, call logs, and phone setup details.</p>',
    ].join(''),
    ctaLabel: 'Manage billing',
    ctaUrl: billingUrl,
    signatureHtml: '<p style="margin:0">Thanks,<br />Luis Pham<br />RingBooker</p>',
  };
  const text = [
    `Your RingBooker trial for "${params.shopName}"${trialEndText ? ` ended on ${trialEndText}` : ' has ended'}.`,
    'Live answering is paused until billing is resolved.',
    `Manage billing: ${billingUrl}`,
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

export function buildFinishOnboardingReminderEmailPayload(params: {
  email: string;
  shopName: string;
  appBaseUrl: string;
}): { input: BaseEmailInput; text: string } {
  const base = ensureAbsoluteBaseUrl(params.appBaseUrl);
  const onboardingUrl = `${base}/user/onboarding`;
  const businessName = escapeHtmlText(params.shopName);
  const name = escapeHtmlText(displayNameFromEmail(params.email));
  const input: BaseEmailInput = {
    title: 'Finish setting up your RingBooker account',
    previewText: 'Complete your setup before RingBooker answers real callers.',
    heroTitle: 'Finish your RingBooker setup',
    heroSubtitleHtml: `<p style="margin:0">Your account for <strong>${businessName}</strong> is waiting for a few setup details.</p>`,
    greetingHtml: `<p style="margin:0">Hi ${name},</p>`,
    bodyHtml: [
      '<p style="margin:0 0 12px 0">Finish onboarding by reviewing your business info, services, hours, and call handling preferences.</p>',
      '<p style="margin:0">No card is needed for setup and test calls. Live answering is not active yet.</p>',
    ].join(''),
    ctaLabel: 'Continue setup',
    ctaUrl: onboardingUrl,
    signatureHtml: '<p style="margin:0">Thanks,<br />Luis Pham<br />RingBooker</p>',
  };
  const text = [
    `Hi ${displayNameFromEmail(params.email)},`,
    '',
    `Finish setting up RingBooker for "${params.shopName}".`,
    'No card is needed for setup and test calls.',
    'Live answering is not active yet.',
    '',
    `Continue setup: ${onboardingUrl}`,
    '',
    'Thanks,',
    'Luis Pham',
    'RingBooker',
  ].join('\n');
  return { input, text };
}

export function buildAddPaymentMethodGoLiveEmailPayload(params: {
  email: string;
  shopName: string;
  appBaseUrl: string;
  paddleTrialConfigVerified?: boolean;
}): { input: BaseEmailInput; text: string } {
  const base = ensureAbsoluteBaseUrl(params.appBaseUrl);
  const billingUrl = `${base}/user/billing`;
  const trialCopy = paymentMethodTrialCopy(params.paddleTrialConfigVerified);
  const input: BaseEmailInput = {
    title: 'Start your 14-day trial',
    previewText: 'Start your 14-day trial before RingBooker answers real callers.',
    heroTitle: 'Start your 14-day trial',
    heroSubtitleHtml: `<p style="margin:0">RingBooker setup for <strong>${escapeHtmlText(params.shopName)}</strong> is almost done.</p>`,
    greetingHtml: `<p style="margin:0">Hi ${escapeHtmlText(displayNameFromEmail(params.email))},</p>`,
    bodyHtml: [
      `<p style="margin:0 0 12px 0">${escapeHtmlText(trialCopy)}</p>`,
      `<p style="margin:0 0 12px 0">You&apos;ve set up call forwarding successfully for <strong>${escapeHtmlText(params.shopName)}</strong>.</p>`,
      '<p style="margin:0">To enable live answering, add a payment method to complete your setup.</p>',
    ].join(''),
    ctaLabel: 'Start 14-day trial',
    ctaUrl: billingUrl,
    signatureHtml: '<p style="margin:0">Thanks,<br />Luis Pham<br />RingBooker</p>',
  };
  const text = [
    `RingBooker setup for "${params.shopName}" is almost done.`,
    trialCopy,
    `You've set up call forwarding successfully for "${params.shopName}".`,
    'To enable live answering, add a payment method to complete your setup.',
    `Start 14-day trial: ${billingUrl}`,
  ].join('\n');
  return { input, text };
}

export function buildPaymentMethodAddedEmailPayload(params: {
  shopName: string;
  appBaseUrl: string;
  forwardingVerified?: boolean;
}): { input: BaseEmailInput; text: string } {
  const base = ensureAbsoluteBaseUrl(params.appBaseUrl);
  const phoneSetupUrl = `${base}/user/go-live`;
  const forwardingVerified = params.forwardingVerified === true;
  const input: BaseEmailInput = {
    title: 'Payment method verified',
    previewText: forwardingVerified ? 'Your trial is active — switch on live answering now.' : 'Your trial is active — verify forwarding to go live.',
    heroTitle: 'Payment method verified',
    heroSubtitleHtml: `<p style="margin:0">Billing is ready for <strong>${escapeHtmlText(params.shopName)}</strong>.</p>`,
    bodyHtml: [
      '<p style="margin:0 0 12px 0">Your payment method is verified and your 14-day trial is active.</p>',
      forwardingVerified
        ? '<p style="margin:0">Forwarding is verified. Return to Go Live to switch on live answering.</p>'
        : '<p style="margin:0">To go live, call your business number from another phone — RingBooker will confirm forwarding automatically.</p>',
    ].join(''),
    ctaLabel: forwardingVerified ? 'Switch it on' : 'Verify forwarding',
    ctaUrl: `${phoneSetupUrl}#go-live-forwarding`,
    signatureHtml: '<p style="margin:0">RingBooker Notifications</p>',
  };
  const text = [
    `Payment method verified for "${params.shopName}".`,
    'Your payment method is verified and your 14-day trial is active.',
    forwardingVerified
      ? 'Forwarding is verified. Return to Go Live to switch on live answering.'
      : 'To go live, call your business number from another phone — RingBooker will confirm forwarding automatically.',
    `${phoneSetupUrl}#go-live-forwarding`,
  ].join('\n');
  return { input, text };
}

export function buildPaymentFailedEmailPayload(params: {
  shopName: string;
  appBaseUrl: string;
}): { input: BaseEmailInput; text: string } {
  const base = ensureAbsoluteBaseUrl(params.appBaseUrl);
  const billingUrl = `${base}/user/billing`;
  const businessName = escapeHtmlText(params.shopName);
  const input: BaseEmailInput = {
    title: 'Action required: Update your payment method',
    previewText: 'Your payment did not go through. Update your payment method to restore live answering.',
    heroTitle: "Your payment didn't go through",
    heroSubtitleHtml: `<p style="margin:0">We were unable to charge your card for <strong>${businessName}</strong>.</p>`,
    bodyHtml: [
      `<p style="margin:0 0 12px 0">We were unable to charge your card for <strong>${businessName}</strong>. Your live answering has been paused until your payment method is updated.</p>`,
      '<p style="margin:0">Your account setup, call history, and data are safe.</p>',
    ].join(''),
    ctaLabel: 'Update payment method',
    ctaUrl: billingUrl,
    signatureHtml: '<p style="margin:0">RingBooker Billing</p>',
  };
  const text = [
    "Your payment didn't go through",
    `We were unable to charge your card for "${params.shopName}". Your live answering has been paused until your payment method is updated.`,
    'Your account setup, call history, and data are safe.',
    `Update payment method: ${billingUrl}`,
  ].join('\n');
  return { input, text };
}

export function buildSubscriptionCanceledEmailPayload(params: {
  shopName: string;
  appBaseUrl: string;
}): { input: BaseEmailInput; text: string } {
  const base = ensureAbsoluteBaseUrl(params.appBaseUrl);
  const billingUrl = `${base}/user/billing`;
  const businessName = escapeHtmlText(params.shopName);
  const input: BaseEmailInput = {
    title: 'Your RingBooker subscription has been canceled',
    previewText: 'Live answering has been disabled. You can reactivate anytime.',
    heroTitle: 'Your subscription has been canceled',
    heroSubtitleHtml: `<p style="margin:0">Your RingBooker subscription for <strong>${businessName}</strong> has been canceled.</p>`,
    bodyHtml: [
      `<p style="margin:0 0 12px 0">Your RingBooker subscription for <strong>${businessName}</strong> has been canceled. Live answering has been disabled.</p>`,
      '<p style="margin:0">Your account, call history, and setup are saved. You can reactivate anytime.</p>',
    ].join(''),
    ctaLabel: 'Reactivate subscription',
    ctaUrl: billingUrl,
    signatureHtml: '<p style="margin:0">RingBooker Billing</p>',
  };
  const text = [
    'Your subscription has been canceled',
    `Your RingBooker subscription for "${params.shopName}" has been canceled. Live answering has been disabled.`,
    'Your account, call history, and setup are saved. You can reactivate anytime.',
    `Reactivate subscription: ${billingUrl}`,
  ].join('\n');
  return { input, text };
}

export function buildSubscriptionActivatedEmailPayload(params: {
  shopName: string;
  planName: string;
  periodStart?: string | null;
  periodEnd?: string | null;
  appBaseUrl: string;
}): { input: BaseEmailInput; text: string } {
  const base = ensureAbsoluteBaseUrl(params.appBaseUrl);
  const dashboardUrl = `${base}/user`;
  const businessName = escapeHtmlText(params.shopName);
  const planName = escapeHtmlText(params.planName);
  const periodStart = formatShopLongDate(params.periodStart, 'UTC');
  const periodEnd = formatShopLongDate(params.periodEnd, 'UTC');
  const input: BaseEmailInput = {
    title: "You're live — RingBooker is answering your calls",
    previewText: 'Live answering is active for your business.',
    heroTitle: 'Live answering is active',
    heroSubtitleHtml: `<p style="margin:0">Your <strong>${planName}</strong> subscription for <strong>${businessName}</strong> is now active.</p>`,
    bodyHtml: [
      `<p style="margin:0 0 12px 0">Your <strong>${planName}</strong> subscription for <strong>${businessName}</strong> is now active. RingBooker will answer your calls 24/7.</p>`,
      `<p style="margin:0">Your billing period runs from <strong>${escapeHtmlText(periodStart)}</strong> to <strong>${escapeHtmlText(periodEnd)}</strong>.</p>`,
    ].join(''),
    ctaLabel: 'Go to dashboard',
    ctaUrl: dashboardUrl,
    signatureHtml: '<p style="margin:0">RingBooker Billing</p>',
  };
  const text = [
    'Live answering is active',
    `Your ${params.planName} subscription for "${params.shopName}" is now active. RingBooker will answer your calls 24/7.`,
    `Your billing period runs from ${periodStart} to ${periodEnd}.`,
    `Go to dashboard: ${dashboardUrl}`,
  ].join('\n');
  return { input, text };
}

export function buildForwardingNumberReadyEmailPayload(params: {
  shopName: string;
  forwardingNumber: string;
  appBaseUrl: string;
}): { input: BaseEmailInput; text: string } {
  const base = ensureAbsoluteBaseUrl(params.appBaseUrl);
  const setupUrl = `${base}/user/go-live#forwarding-instructions`;
  const input: BaseEmailInput = {
    title: 'Your RingBooker forwarding number is ready',
    previewText: 'Keep your current business number and forward missed or after-hours calls to RingBooker.',
    heroTitle: 'Your forwarding number is ready',
    heroSubtitleHtml: `<p style="margin:0">RingBooker has created a managed forwarding number for <strong>${escapeHtmlText(params.shopName)}</strong>.</p>`,
    bodyHtml: [
      '<p style="margin:0 0 12px 0">Keep your current business number. Your clients do not need to learn a new number.</p>',
      '<p style="margin:0 0 12px 0">Forward missed, after-hours, or overflow calls to your RingBooker forwarding number:</p>',
      `<p style="margin:0;font-size:20px;font-weight:700;letter-spacing:.02em">${escapeHtmlText(params.forwardingNumber)}</p>`,
      '<p style="margin:12px 0 0 0">Live answering is not active until forwarding is verified and you enable it.</p>',
    ].join(''),
    ctaLabel: 'View forwarding instructions',
    ctaUrl: setupUrl,
    signatureHtml: '<p style="margin:0">RingBooker Notifications</p>',
  };
  const text = [
    `Your RingBooker forwarding number for "${params.shopName}" is ready:`,
    params.forwardingNumber,
    '',
    'Keep your current business number. Forward missed, after-hours, or overflow calls to your RingBooker forwarding number.',
    'Live answering is not active until forwarding is verified and you enable it.',
    `View forwarding instructions: ${setupUrl}`,
  ].join('\n');
  return { input, text };
}

export function buildForwardingProvisionFailedEmailPayload(params: {
  shopName: string;
  appBaseUrl: string;
}): { input: BaseEmailInput; text: string } {
  const base = ensureAbsoluteBaseUrl(params.appBaseUrl);
  const setupUrl = `${base}/user/go-live`;
  const input: BaseEmailInput = {
    title: 'We could not create your forwarding number',
    previewText: 'Retry phone setup or contact support.',
    heroTitle: 'Forwarding number setup needs attention',
    heroSubtitleHtml: `<p style="margin:0">We could not create a RingBooker forwarding number for <strong>${escapeHtmlText(params.shopName)}</strong>.</p>`,
    bodyHtml: [
      '<p style="margin:0 0 12px 0">Live answering is not active yet. Your current business number has not changed.</p>',
      '<p style="margin:0">Please retry phone setup. If it still does not work, contact support and we will help you finish setup.</p>',
    ].join(''),
    ctaLabel: 'Retry phone setup',
    ctaUrl: setupUrl,
    signatureHtml: '<p style="margin:0">RingBooker Support</p>',
  };
  const text = [
    `We could not create a RingBooker forwarding number for "${params.shopName}".`,
    'Live answering is not active yet. Your current business number has not changed.',
    `Retry phone setup: ${setupUrl}`,
  ].join('\n');
  return { input, text };
}

export function buildForwardingNotVerifiedReminderEmailPayload(params: {
  email: string;
  shopName: string;
  forwardingNumber: string;
  appBaseUrl: string;
}): { input: BaseEmailInput; text: string } {
  const base = ensureAbsoluteBaseUrl(params.appBaseUrl);
  const setupUrl = `${base}/user/go-live#forwarding-instructions`;
  const input: BaseEmailInput = {
    title: 'Verify your RingBooker call forwarding',
    previewText: 'Forwarding must be verified before live answering can start.',
    heroTitle: 'Verify call forwarding',
    heroSubtitleHtml: `<p style="margin:0">Your forwarding number for <strong>${escapeHtmlText(params.shopName)}</strong> is ready, but verification is not complete.</p>`,
    greetingHtml: `<p style="margin:0">Hi ${escapeHtmlText(displayNameFromEmail(params.email))},</p>`,
    bodyHtml: [
      `<p style="margin:0 0 12px 0">RingBooker has not detected forwarding yet. Please forward missed or after-hours calls from your current business number to <strong>${escapeHtmlText(params.forwardingNumber)}</strong>.</p>`,
      '<p style="margin:0">After that, call your business number from another phone. RingBooker will confirm forwarding automatically. Live answering is not active until forwarding is verified and enabled.</p>',
    ].join(''),
    ctaLabel: 'Verify forwarding',
    ctaUrl: setupUrl,
    signatureHtml: '<p style="margin:0">Thanks,<br />Luis Pham<br />RingBooker</p>',
  };
  const text = [
    `Please verify call forwarding for "${params.shopName}".`,
    `Forward calls to: ${params.forwardingNumber}`,
    'Call your business number from another phone to verify forwarding is working.',
    'Live answering is not active until forwarding is verified and enabled.',
    `Verify forwarding: ${setupUrl}`,
  ].join('\n');
  return { input, text };
}

export function buildForwardingVerifiedEmailPayload(params: {
  shopName: string;
  appBaseUrl: string;
}): { input: BaseEmailInput; text: string } {
  const base = ensureAbsoluteBaseUrl(params.appBaseUrl);
  const billingUrl = `${base}/user/billing`;
  const input: BaseEmailInput = {
    title: 'Call forwarding verified',
    previewText: 'Forwarded calls are reaching RingBooker. Add your card to start your free trial.',
    heroTitle: 'Forwarding is verified',
    heroSubtitleHtml: `<p style="margin:0">RingBooker confirmed forwarded calls are reaching <strong>${escapeHtmlText(params.shopName)}</strong>.</p>`,
    bodyHtml:
      '<p style="margin:0 0 12px 0">Your phone connection is ready. The last step is adding your card to start your 14-day free trial.</p><p style="margin:0">Once your trial is active, return to Go Live to switch on live answering.</p>',
    ctaLabel: 'Start your free trial',
    ctaUrl: billingUrl,
    signatureHtml: '<p style="margin:0">RingBooker Notifications</p>',
  };
  const text = [
    `Call forwarding is verified for "${params.shopName}".`,
    'Your phone connection is ready. The last step is adding your card to start your 14-day free trial.',
    'Once your trial is active, return to Go Live to switch on live answering.',
    `Start your free trial: ${billingUrl}`,
  ].join('\n');
  return { input, text };
}

export function buildLiveAnsweringEnabledEmailPayload(params: {
  shopName: string;
  appBaseUrl: string;
}): { input: BaseEmailInput; text: string } {
  const base = ensureAbsoluteBaseUrl(params.appBaseUrl);
  const callsUrl = `${base}/user/calls`;
  const input: BaseEmailInput = {
    title: 'Live answering is active',
    previewText: 'RingBooker can now answer forwarded calls.',
    heroTitle: 'Live answering is active',
    heroSubtitleHtml: `<p style="margin:0">RingBooker can now answer forwarded calls for <strong>${escapeHtmlText(params.shopName)}</strong>.</p>`,
    bodyHtml:
      '<p style="margin:0">RingBooker is ready to answer forwarded missed, busy, after-hours, or overflow calls. You can view call logs, summaries, and captured call details from your dashboard.</p>',
    ctaLabel: 'View call logs',
    ctaUrl: callsUrl,
    signatureHtml: '<p style="margin:0">RingBooker Notifications</p>',
  };
  const text = [
    `Live answering is active for "${params.shopName}".`,
    'RingBooker is ready to answer forwarded missed, busy, after-hours, or overflow calls.',
    `View call logs: ${callsUrl}`,
  ].join('\n');
  return { input, text };
}

function billingIssueStatusLabel(status: string): string {
  switch (status.trim().toLowerCase()) {
    case 'past_due':
      return 'Payment failed';
    case 'canceled':
      return 'Subscription canceled';
    case 'paused':
      return 'Subscription paused';
    case 'unpaid':
      return 'Payment overdue';
    default:
      return 'Billing issue';
  }
}

export function buildLiveAnsweringBillingPausedEmailPayload(params: {
  shopName: string;
  status: string;
  appBaseUrl: string;
}): { input: BaseEmailInput; text: string } {
  const base = ensureAbsoluteBaseUrl(params.appBaseUrl);
  const billingUrl = `${base}/user/billing`;
  const statusLabel = billingIssueStatusLabel(params.status);
  const input: BaseEmailInput = {
    title: 'Live answering is paused',
    previewText: 'Resolve your billing issue to restore live answering.',
    heroTitle: 'Live answering is paused',
    heroSubtitleHtml: `<p style="margin:0">Billing status for <strong>${escapeHtmlText(params.shopName)}</strong>: <strong>${escapeHtmlText(statusLabel)}</strong>.</p>`,
    bodyHtml: [
      '<p style="margin:0 0 12px 0">Live answering is paused until billing is resolved. RingBooker will not answer forwarded live calls while this issue is active.</p>',
      '<p style="margin:0">Your dashboard and call history are still available.</p>',
    ].join(''),
    ctaLabel: 'Resolve billing issue',
    ctaUrl: billingUrl,
    signatureHtml: '<p style="margin:0">RingBooker Billing</p>',
  };
  const text = [
    `Live answering is paused for "${params.shopName}".`,
    `Billing status: ${statusLabel}`,
    'RingBooker will not answer forwarded live calls while this issue is active.',
    `Resolve billing issue: ${billingUrl}`,
  ].join('\n');
  return { input, text };
}

export function buildLiveAnsweringBillingRestoredEmailPayload(params: {
  shopName: string;
  appBaseUrl: string;
}): { input: BaseEmailInput; text: string } {
  const base = ensureAbsoluteBaseUrl(params.appBaseUrl);
  const callsUrl = `${base}/user/calls`;
  const input: BaseEmailInput = {
    title: 'Live answering is restored',
    previewText: 'Your billing has been resolved — live answering is active again.',
    heroTitle: 'Live answering is restored',
    heroSubtitleHtml: `<p style="margin:0">Billing for <strong>${escapeHtmlText(params.shopName)}</strong> has been resolved. Live answering is active again.</p>`,
    bodyHtml:
      '<p style="margin:0">RingBooker is ready to answer forwarded calls. Your call logs and captured call details are available from your dashboard.</p>',
    ctaLabel: 'View call logs',
    ctaUrl: callsUrl,
    signatureHtml: '<p style="margin:0">RingBooker Billing</p>',
  };
  const text = [
    `Live answering is restored for "${params.shopName}".`,
    'Billing has been resolved — live answering is active again.',
    `View call logs: ${callsUrl}`,
  ].join('\n');
  return { input, text };
}

export function buildInternalAlertEmailPayload(params: {
  title: string;
  summary: string;
  fields: Record<string, string | number | boolean | null | undefined>;
}): { input: BaseEmailInput; text: string } {
  const safeLines = Object.entries(params.fields)
    .filter(([, value]) => value !== undefined && value !== null && String(value).trim() !== '')
    .map(([key, value]) => `${key}: ${String(value)}`);
  const body = [
    `<p style="margin:0 0 12px 0">${escapeHtmlText(params.summary)}</p>`,
    `<pre style="white-space:pre-wrap;font-family:Arial,sans-serif;margin:0">${escapeHtmlText(safeLines.join('\n'))}</pre>`,
  ].join('');
  const input: BaseEmailInput = {
    title: params.title,
    previewText: params.summary,
    heroTitle: params.title,
    bodyHtml: body,
    signatureHtml: '<p style="margin:0">RingBooker Notifications</p>',
  };
  return { input, text: [params.summary, '', ...safeLines].join('\n') };
}
