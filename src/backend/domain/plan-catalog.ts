import type { BillingInterval, ShopPlan } from '@/src/backend/domain/types';

export type SelfServePlan = Extract<ShopPlan, 'starter' | 'professional'>;

export type PlanCatalogEntry = {
  slug: ShopPlan;
  label: string;
  amountCents: number | null;
  currency: 'USD';
  interval: BillingInterval;
  trialDays: number;
  paddlePriceEnv?: string;
  paddlePriceEnvByInterval?: Partial<Record<BillingInterval, string>>;
  selfServeTrial: boolean;
  contactSalesOnly?: boolean;
};

export const PLAN_CATALOG: Record<ShopPlan, PlanCatalogEntry> = {
  starter: {
    slug: 'starter',
    label: 'Starter',
    amountCents: 7900,
    currency: 'USD',
    interval: 'month',
    trialDays: 14,
    paddlePriceEnv: 'PADDLE_PRICE_STARTER',
    paddlePriceEnvByInterval: {
      month: 'PADDLE_PRICE_STARTER_MONTHLY',
      year: 'PADDLE_PRICE_STARTER_ANNUAL',
    },
    selfServeTrial: true,
  },
  professional: {
    slug: 'professional',
    label: 'Professional',
    amountCents: 14900,
    currency: 'USD',
    interval: 'month',
    trialDays: 14,
    paddlePriceEnv: 'PADDLE_PRICE_PROFESSIONAL',
    paddlePriceEnvByInterval: {
      month: 'PADDLE_PRICE_PROFESSIONAL_MONTHLY',
      year: 'PADDLE_PRICE_PROFESSIONAL_ANNUAL',
    },
    selfServeTrial: true,
  },
  enterprise: {
    slug: 'enterprise',
    label: 'Custom',
    amountCents: null,
    currency: 'USD',
    interval: 'month',
    trialDays: 0,
    paddlePriceEnv: 'PADDLE_PRICE_ENTERPRISE',
    selfServeTrial: false,
    contactSalesOnly: true,
  },
};

export function isSelfServeTrialPlan(plan: string | null | undefined): plan is SelfServePlan {
  return plan === 'starter' || plan === 'professional';
}

export function getPlanCatalogEntry(plan: ShopPlan): PlanCatalogEntry {
  return PLAN_CATALOG[plan];
}

export function formatPlanPrice(entry: PlanCatalogEntry): string {
  if (entry.amountCents == null) return 'Custom';
  const dollars = entry.amountCents / 100;
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: entry.currency,
    maximumFractionDigits: dollars % 1 === 0 ? 0 : 2,
  }).format(dollars);
}

export function resolvePaddlePriceIdFromCatalog(
  plan: ShopPlan,
  interval: BillingInterval = 'month',
  env: NodeJS.ProcessEnv = process.env,
): string {
  const entry = getPlanCatalogEntry(plan);
  const intervalKey = entry.paddlePriceEnvByInterval?.[interval];
  const legacyKey = interval === 'month' ? entry.paddlePriceEnv : undefined;
  const value = (intervalKey ? env[intervalKey]?.trim() : '') || (legacyKey ? env[legacyKey]?.trim() : '');
  if (!value) {
    throw new Error(`missing_paddle_price_id:${plan}:${interval}`);
  }
  return value;
}
