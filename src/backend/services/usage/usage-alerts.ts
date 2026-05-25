import type { Shop, ShopUsageAlertType } from '@/src/backend/domain/types';
import { getPlanCatalogEntry } from '@/src/backend/domain/plan-catalog';
import { logger } from '@/src/backend/observability/logger';
import type {
  AuthUsersRepository,
  BillingSubscriptionsRepository,
  CallLogsRepository,
  ShopActiveCallSessionsRepository,
  ShopUsageAlertsRepository,
} from '@/src/backend/ports/repositories';
import { renderBaseEmailHtml } from '@/src/backend/services/email/base-email-mjml';
import type { BaseEmailInput } from '@/src/backend/services/email/base-email-types';
import { escapeHtmlText } from '@/src/backend/services/email/base-email-escape';
import { emailFounderFrom, emailReplyTo } from '@/src/backend/services/email/config';
import type { EmailCategory, EmailService } from '@/src/backend/services/email/types';
import { getBillingPeriodForShop } from '@/src/backend/services/usage/period';
import { getShopUsageForPeriod, type ShopUsageForPeriod } from '@/src/backend/services/usage/shop-usage';

export type UsageAlertDeps = {
  usageAlertsRepository?: ShopUsageAlertsRepository | null;
  authUsersRepository?: AuthUsersRepository | null;
  emailService?: EmailService | null;
  callLogsRepository: CallLogsRepository;
  billingSubscriptionsRepository?: BillingSubscriptionsRepository | null;
  shopActiveCallSessionsRepository?: ShopActiveCallSessionsRepository;
};

function appBaseUrl(): string {
  return (process.env.APP_BASE_URL ?? 'http://localhost:3000').replace(/\/+$/, '');
}

function formatDate(value: Date | string): string {
  return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' }).format(
    typeof value === 'string' ? new Date(value) : value,
  );
}

function money(amountCents: number): string {
  return (amountCents / 100).toFixed(2);
}

function usageDashboardUrl(): string {
  return `${appBaseUrl()}/user/billing`;
}

function upgradeUrl(): string {
  return `${appBaseUrl()}/user/billing#upgrade`;
}

function emailCategory(alertType: ShopUsageAlertType): EmailCategory {
  if (alertType === '80pct_warning') return 'usage_80pct_warning';
  if (alertType === '100pct_overage') return 'usage_100pct_overage';
  return 'usage_overage_charged';
}

function nextPlanCopy(shop: Shop): { line: string | null; ctaLabel: string | null } {
  if (shop.plan !== 'starter') return { line: null, ctaLabel: null };
  return {
    line: 'Need more capacity? Upgrade to Professional for 200 captured calls per billing period.',
    ctaLabel: 'Upgrade to Professional',
  };
}

function buildUsageAlertEmail(params: {
  shop: Shop;
  alertType: '80pct_warning' | '100pct_overage';
  usage: ShopUsageForPeriod;
  periodEnd: Date;
}): { subject: string; text: string; input: BaseEmailInput } | null {
  const limit = params.usage.capturedCallersLimit;
  if (!limit) return null;

  const used = params.usage.capturedCallersUsed;
  const remaining = Math.max(0, limit - used);
  const overageCallers = Math.max(0, used - limit);
  const estimatedCents = overageCallers * 75;
  const planName = getPlanCatalogEntry(params.shop.plan).label;
  const nextPlan = nextPlanCopy(params.shop);
  const dashboard = usageDashboardUrl();
  const upgrade = upgradeUrl();

  if (params.alertType === '80pct_warning') {
    const subject = "You've used 80% of your caller limit this period";
    const text = [
      `Hi ${params.shop.name},`,
      `You've used ${used} of ${limit} captured calls this billing period.`,
      `You have ${remaining} calls remaining before overage charges apply.`,
      `Once you reach ${limit} calls, additional captured calls will be billed at $0.75 each at the end of your billing period.`,
      `Current period ends: ${formatDate(params.periodEnd)}`,
      `View usage dashboard: ${dashboard}`,
      nextPlan.line,
      nextPlan.ctaLabel ? `Upgrade plan: ${upgrade}` : null,
      'The RingBooker team',
    ].filter(Boolean).join('\n');
    return {
      subject,
      text,
      input: {
        title: subject,
        previewText: `${used} of ${limit} captured calls used this billing period.`,
        heroTitle: 'Caller usage update',
        heroSubtitleHtml: `<p style="margin:0"><strong>${used}</strong> of <strong>${limit}</strong> calls used this billing period.</p>`,
        greetingHtml: `<p style="margin:0">Hi ${escapeHtmlText(params.shop.name)},</p>`,
        bodyHtml: [
          `<p style="margin:0 0 12px 0">You've used ${used} of ${limit} captured calls this billing period.</p>`,
          `<p style="margin:0 0 12px 0">You have ${remaining} calls remaining before overage charges apply.</p>`,
          `<p style="margin:0 0 12px 0">Once you reach ${limit} calls, additional captured calls will be billed at $0.75 each at the end of your billing period.</p>`,
          `<p style="margin:0">Current period ends: ${escapeHtmlText(formatDate(params.periodEnd))}</p>`,
          nextPlan.line ? `<p style="margin:12px 0 0 0">${escapeHtmlText(nextPlan.line)}</p>` : '',
          nextPlan.ctaLabel ? `<p style="margin:12px 0 0 0"><a href="${escapeHtmlText(upgrade)}">${escapeHtmlText(nextPlan.ctaLabel)}</a></p>` : '',
        ].join(''),
        ctaLabel: 'View usage dashboard',
        ctaUrl: dashboard,
        signatureHtml: '<p style="margin:0">The RingBooker team</p>',
      },
    };
  }

  const subject = 'Caller limit reached — overage now applies';
  const text = [
    `Hi ${params.shop.name},`,
    `You've reached your ${planName} captured call limit of ${limit} calls this billing period.`,
    'Your AI receptionist is still answering calls.',
    `Additional captured calls will be billed at $0.75 each at the end of your billing period on ${formatDate(params.periodEnd)}.`,
    `Current overage: ${overageCallers} calls = $${money(estimatedCents)} estimated`,
    `View usage dashboard: ${dashboard}`,
    params.shop.plan === 'starter' ? `To avoid overage charges, upgrade your plan: ${upgrade}` : null,
    'The RingBooker team',
  ].filter(Boolean).join('\n');
  return {
    subject,
    text,
    input: {
      title: subject,
      previewText: `${planName} captured call limit reached; overage now applies.`,
      heroTitle: 'Caller limit reached',
      heroSubtitleHtml: `<p style="margin:0">Additional captured calls are now billed at $0.75 each.</p>`,
      greetingHtml: `<p style="margin:0">Hi ${escapeHtmlText(params.shop.name)},</p>`,
      bodyHtml: [
        `<p style="margin:0 0 12px 0">You've reached your ${escapeHtmlText(planName)} captured call limit of ${limit} calls this billing period.</p>`,
        '<p style="margin:0 0 12px 0">Your AI receptionist is still answering calls.</p>',
        `<p style="margin:0 0 12px 0">Additional captured calls will be billed at $0.75 each at the end of your billing period on ${escapeHtmlText(formatDate(params.periodEnd))}.</p>`,
        `<p style="margin:0">Current overage: ${overageCallers} calls = $${money(estimatedCents)} estimated</p>`,
        params.shop.plan === 'starter' ? `<p style="margin:12px 0 0 0">To avoid overage charges, <a href="${escapeHtmlText(upgrade)}">upgrade your plan</a>.</p>` : '',
      ].join(''),
      ctaLabel: 'View usage dashboard',
      ctaUrl: dashboard,
      signatureHtml: '<p style="margin:0">The RingBooker team</p>',
    },
  };
}

export function buildOverageChargeReceiptEmail(params: {
  shop: Shop;
  periodEnd: Date;
  includedCallers: number;
  capturedCallers: number;
  overageCallers: number;
  amountCents: number;
}): { subject: string; text: string; input: BaseEmailInput } {
  const planName = getPlanCatalogEntry(params.shop.plan).label;
  const dashboard = usageDashboardUrl();
  const subject = `Your RingBooker overage charge: $${money(params.amountCents)}`;
  const text = [
    `Hi ${params.shop.name},`,
    `Your billing period ended on ${formatDate(params.periodEnd)}.`,
    "Here's a summary of your usage:",
    `Plan:              ${planName}`,
    `Included calls:    ${params.includedCallers}`,
    `Calls used:        ${params.capturedCallers}`,
    `Overage calls:     ${params.overageCallers}`,
    'Overage rate:      $0.75/call',
    `Overage charge:    $${money(params.amountCents)}`,
    'This charge has been applied to your payment method on file.',
    `View billing history: ${dashboard}`,
    'The RingBooker team',
  ].join('\n');
  return {
    subject,
    text,
    input: {
      title: subject,
      previewText: `Captured call overage charge: $${money(params.amountCents)}.`,
      heroTitle: 'Overage charge receipt',
      heroSubtitleHtml: `<p style="margin:0">$${money(params.amountCents)} charged for ${params.overageCallers} additional calls.</p>`,
      greetingHtml: `<p style="margin:0">Hi ${escapeHtmlText(params.shop.name)},</p>`,
      bodyHtml: [
        `<p style="margin:0 0 12px 0">Your billing period ended on ${escapeHtmlText(formatDate(params.periodEnd))}.</p>`,
        '<p style="margin:0 0 12px 0">Here is a summary of your usage:</p>',
        `<p style="margin:0">Plan: ${escapeHtmlText(planName)}<br />Included calls: ${params.includedCallers}<br />Calls used: ${params.capturedCallers}<br />Overage calls: ${params.overageCallers}<br />Overage rate: $0.75/call<br />Overage charge: $${money(params.amountCents)}</p>`,
        '<p style="margin:12px 0 0 0">This charge has been applied to your payment method on file.</p>',
      ].join(''),
      ctaLabel: 'View billing history',
      ctaUrl: dashboard,
      signatureHtml: '<p style="margin:0">The RingBooker team</p>',
    },
  };
}

async function sendAlertEmail(params: {
  shop: Shop;
  alertType: ShopUsageAlertType;
  periodStart: Date;
  deps: UsageAlertDeps;
  message: { subject: string; text: string; input: BaseEmailInput };
}): Promise<void> {
  if (!params.deps.usageAlertsRepository || !params.deps.authUsersRepository || !params.deps.emailService) return;
  const idempotencyKey = `${params.shop.id}:${params.periodStart.toISOString()}:${params.alertType}`;
  const existing = await params.deps.usageAlertsRepository.findByIdempotencyKey(idempotencyKey);
  if (existing) return;

  const authUser = await params.deps.authUsersRepository.findByShopId(params.shop.id);
  if (!authUser?.email || !authUser.emailVerifiedAt) return;

  await params.deps.emailService.sendEmail({
    to: authUser.email,
    subject: params.message.subject,
    text: params.message.text,
    html: await renderBaseEmailHtml(params.message.input),
    category: emailCategory(params.alertType),
    idempotencyKey,
    shopId: params.shop.id,
    from: emailFounderFrom(),
    replyTo: emailReplyTo(),
  });

  await params.deps.usageAlertsRepository.create({
    shopId: params.shop.id,
    alertType: params.alertType,
    periodStart: params.periodStart,
    idempotencyKey,
  });
}

export async function maybeSendUsageAlert(
  shop: Shop,
  alertType: '80pct_warning' | '100pct_overage',
  usage: ShopUsageForPeriod,
  periodStart: Date,
  deps: UsageAlertDeps,
): Promise<void> {
  const limit = usage.capturedCallersLimit;
  if (!limit) return;
  if (alertType === '80pct_warning' && usage.capturedCallersUsed >= limit) return;
  if (alertType === '100pct_overage' && usage.capturedCallersUsed < limit) return;
  if (alertType === '80pct_warning' && usage.capturedCallersUsed < Math.floor(limit * 0.8)) return;

  const message = buildUsageAlertEmail({
    shop,
    alertType,
    usage,
    periodEnd: new Date(usage.periodEnd),
  });
  if (!message) return;
  await sendAlertEmail({ shop, alertType, periodStart, deps, message });
}

export async function checkAndSendUsageAlerts(shop: Shop, deps: UsageAlertDeps): Promise<void> {
  const period = await getBillingPeriodForShop(shop.id, deps, { shopTimezone: shop.timezone });
  const usage = await getShopUsageForPeriod(
    {
      callLogsRepository: deps.callLogsRepository,
      billingSubscriptionsRepository: deps.billingSubscriptionsRepository ?? undefined,
      shopActiveCallSessionsRepository: deps.shopActiveCallSessionsRepository,
    },
    { shop, period },
  );
  const limit = usage.capturedCallersLimit;
  if (!limit) return;
  if (usage.capturedCallersUsed >= limit) {
    await maybeSendUsageAlert(shop, '100pct_overage', usage, period.start, deps);
    return;
  }
  if (usage.capturedCallersUsed >= Math.floor(limit * 0.8)) {
    await maybeSendUsageAlert(shop, '80pct_warning', usage, period.start, deps);
  }
}

export function scheduleUsageAlertCheck(shop: Shop, deps: UsageAlertDeps): void {
  void checkAndSendUsageAlerts(shop, deps).catch((err) => {
    logger.error({ err, shopId: shop.id }, 'usage_alert_check_failed');
  });
}

export async function maybeSendOverageChargeReceipt(
  shop: Shop,
  params: {
    periodStart: Date;
    periodEnd: Date;
    includedCallers: number;
    capturedCallers: number;
    overageCallers: number;
    amountCents: number;
  },
  deps: UsageAlertDeps,
): Promise<void> {
  if (params.overageCallers <= 0 || params.amountCents <= 0) return;
  const message = buildOverageChargeReceiptEmail({ shop, ...params });
  await sendAlertEmail({
    shop,
    alertType: 'overage_charged',
    periodStart: params.periodStart,
    deps,
    message,
  });
}
