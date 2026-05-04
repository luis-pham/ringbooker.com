import { getPlanCatalogEntry, type SelfServePlan } from '@/src/backend/domain/plan-catalog';
import type { BillingSubscription, ShopAccessState } from '@/src/backend/domain/types';
import type {
  BillingCustomersRepository,
  BillingSubscriptionsRepository,
  ShopAccessStatesRepository,
} from '@/src/backend/ports/repositories';

function addDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * 24 * 60 * 60 * 1000);
}

export type CreateNoCardTrialParams = {
  shopId: string;
  email: string;
  plan: SelfServePlan;
  now?: Date;
};

export type CreateNoCardTrialResult = {
  subscription: BillingSubscription;
  accessState: ShopAccessState;
};

export async function createNoCardTrialForShop(
  deps: {
    billingCustomersRepository: BillingCustomersRepository;
    billingSubscriptionsRepository: BillingSubscriptionsRepository;
    shopAccessStatesRepository: ShopAccessStatesRepository;
  },
  params: CreateNoCardTrialParams,
): Promise<CreateNoCardTrialResult> {
  const existing = await deps.billingSubscriptionsRepository.findCurrentByShopId(params.shopId);
  if (existing && (existing.status === 'trialing' || existing.status === 'active')) {
    const accessState = await deps.shopAccessStatesRepository.upsert({
      shopId: params.shopId,
      liveCallsEnabled: false,
      liveCallsPausedReason: 'payment_method_required_before_go_live',
    });
    return { subscription: existing, accessState };
  }

  const plan = getPlanCatalogEntry(params.plan);
  if (!plan.selfServeTrial || plan.amountCents == null) {
    throw new Error(`plan_not_self_serve_trial:${params.plan}`);
  }

  const now = params.now ?? new Date();
  const trialStartedAt = now.toISOString();
  const trialEndsAt = addDays(now, plan.trialDays).toISOString();

  await deps.billingCustomersRepository.upsert({
    shopId: params.shopId,
    provider: 'paddle',
    providerCustomerId: null,
    email: params.email,
    metadata: { source: 'signup_no_card_trial' },
  });

  const subscription = await deps.billingSubscriptionsRepository.upsert({
    shopId: params.shopId,
    provider: 'internal',
    providerSubscriptionId: null,
    providerCustomerId: null,
    plan: params.plan,
    status: 'trialing',
    interval: plan.interval,
    currency: plan.currency,
    amount: plan.amountCents / 100,
    amountCents: plan.amountCents,
    currentPeriodStart: trialStartedAt,
    currentPeriodEnd: trialEndsAt,
    trialStartedAt,
    trialEndsAt,
    paymentMethodStatus: 'none',
    metadata: {
      source: 'signup_no_card_trial',
      no_card_trial: true,
      trial_days: plan.trialDays,
    },
  });

  const accessState = await deps.shopAccessStatesRepository.upsert({
    shopId: params.shopId,
    liveCallsEnabled: false,
    goLiveAt: null,
    liveCallsPausedReason: 'payment_method_required_before_go_live',
    liveCallsPausedAt: null,
  });

  return { subscription, accessState };
}
