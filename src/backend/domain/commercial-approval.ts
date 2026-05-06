import type { ShopAccessState, ShopPlan } from '@/src/backend/domain/types';

export function requiresCommercialGoLiveApproval(plan: ShopPlan): boolean {
  return plan === 'enterprise';
}

export function hasCommercialGoLiveApproval(accessState: ShopAccessState | null | undefined): boolean {
  return Boolean(accessState?.commercialGoLiveApprovedAt?.trim());
}

export function isCommercialGoLiveApprovalRequired(params: {
  plan: ShopPlan;
  accessState: ShopAccessState | null | undefined;
}): boolean {
  return requiresCommercialGoLiveApproval(params.plan) && !hasCommercialGoLiveApproval(params.accessState);
}
