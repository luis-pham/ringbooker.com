import { incrementMetric } from '@/src/backend/observability/metrics';
import type { ShopAccessStatesRepository, ForwardingTestSessionsRepository } from '@/src/backend/ports/repositories';

/**
 * When an inbound call hits `shop.telnyx_number` during an active forwarding test session,
 * mark the session passed and persist forwarding verification on the shop access state.
 */
export async function completeForwardingTestFromInboundCall(params: {
  forwardingTestSessionsRepository: ForwardingTestSessionsRepository;
  shopAccessStatesRepository: ShopAccessStatesRepository;
  shopId: string;
  inboundDidE164: string | null;
  inboundCallSessionId: string | null;
  inboundCallControlId: string | null;
  callerPhone: string | null;
  now: Date;
}): Promise<boolean> {
  if (!params.inboundDidE164?.trim()) return false;

  const updated = await params.forwardingTestSessionsRepository.markPassedIfEligible({
    shopId: params.shopId,
    forwardingNumberE164: params.inboundDidE164,
    inboundCallSessionId: params.inboundCallSessionId,
    inboundCallControlId: params.inboundCallControlId,
    callerPhone: params.callerPhone,
    now: params.now,
  });

  if (!updated) return false;

  await params.shopAccessStatesRepository.upsert({
    shopId: params.shopId,
    forwardingSetupVerifiedAt: params.now.toISOString(),
    forwardingSetupVerifiedVia: 'inbound_test_call',
  });

  incrementMetric('forwarding_test_passed_total', { shopId: params.shopId });
  return true;
}
