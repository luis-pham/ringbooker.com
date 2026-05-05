import { isShopSetupWizardComplete } from '@/src/backend/domain/shop-onboarding';
import type { Shop } from '@/src/backend/domain/types';
import type {
  BillingSubscriptionsRepository,
  ForwardingTestSessionsRepository,
  ShopAccessStatesRepository,
  ShopsRepository,
  TestCallAttemptsRepository,
} from '@/src/backend/ports/repositories';
import { getShopBillingAccess, isBillingTrialStillValid } from '@/src/backend/services/billing/access';
import { normalizeInboundE164 } from '@/src/backend/services/calls/shop-resolver';

export const FORWARDING_TEST_INSTRUCTION =
  'Call your current business number from another phone and let it forward to RingBooker.';

export type StartForwardingTestSessionResult =
  | {
      ok: true;
      status: 'pending';
      expiresAt: string;
      instruction: string;
      sessionId: string;
    }
  | {
      ok: false;
      httpStatus: number;
      error: string;
      message?: string;
      billingUrl?: string;
    };

export async function startOrReuseForwardingTestSession(params: {
  deps: {
    shopsRepository: ShopsRepository;
    billingSubscriptionsRepository: BillingSubscriptionsRepository;
    shopAccessStatesRepository: ShopAccessStatesRepository;
    forwardingTestSessionsRepository: ForwardingTestSessionsRepository;
    testCallAttemptsRepository?: TestCallAttemptsRepository;
  };
  shop: Shop;
  now?: Date;
}): Promise<StartForwardingTestSessionResult> {
  const now = params.now ?? new Date();
  const { deps, shop } = params;

  const access = await getShopBillingAccess(
    {
      shopsRepository: deps.shopsRepository,
      billingSubscriptionsRepository: deps.billingSubscriptionsRepository,
      shopAccessStatesRepository: deps.shopAccessStatesRepository,
      testCallAttemptsRepository: deps.testCallAttemptsRepository,
    },
    { shopId: shop.id },
  );

  if (access.liveCallsEnabled) {
    return {
      ok: false,
      httpStatus: 409,
      error: 'live_already_enabled',
      message: 'Live answering is already on.',
    };
  }

  if (!isShopSetupWizardComplete(shop)) {
    return {
      ok: false,
      httpStatus: 409,
      error: 'onboarding_incomplete',
      message: 'Finish the setup wizard first.',
    };
  }

  if (access.paymentMethodStatus !== 'valid') {
    return {
      ok: false,
      httpStatus: 402,
      error: 'payment_method_required',
      message: 'Add a valid payment method before running this test.',
      billingUrl: '/user/billing',
    };
  }

  const subscription = await deps.billingSubscriptionsRepository.findCurrentByShopId(shop.id);
  const subscriptionActiveLike =
    subscription &&
    (subscription.status === 'active' || (subscription.status === 'trialing' && isBillingTrialStillValid(subscription, now)));
  if (!subscriptionActiveLike) {
    return {
      ok: false,
      httpStatus: 409,
      error: 'subscription_inactive',
      message: 'Your subscription must be active or trialing to run this test.',
    };
  }

  const tn = shop.telnyx_number?.trim();
  if (!tn) {
    return {
      ok: false,
      httpStatus: 409,
      error: 'forwarding_number_required',
      message: 'Provision your RingBooker forwarding number first.',
    };
  }

  const forwardingNumber = normalizeInboundE164(tn) ?? tn;
  const existing = await deps.forwardingTestSessionsRepository.findPendingUnexpiredByShopId({ shopId: shop.id, now });
  if (existing) {
    return {
      ok: true,
      status: 'pending',
      expiresAt: existing.expiresAt,
      instruction: FORWARDING_TEST_INSTRUCTION,
      sessionId: existing.id,
    };
  }

  const startedAt = now;
  const expiresAt = new Date(now.getTime() + 10 * 60 * 1000);
  const expectedBusiness = normalizeInboundE164(shop.phone_number);
  const session = await deps.forwardingTestSessionsRepository.createSession({
    shopId: shop.id,
    forwardingNumber,
    expectedBusinessPhone: expectedBusiness,
    startedAt,
    expiresAt,
  });

  return {
    ok: true,
    status: 'pending',
    expiresAt: session.expiresAt,
    instruction: FORWARDING_TEST_INSTRUCTION,
    sessionId: session.id,
  };
}
