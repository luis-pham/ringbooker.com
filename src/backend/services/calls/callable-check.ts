import type { Shop } from '@/src/backend/domain/types';
import { getShopPlanCapabilities } from '@/src/backend/domain/shop-plan-capabilities';

/**
 * Gates answering inbound AI calls before Telnyx Call Control `answer`.
 *
 * Rules (Phase 1 — DB only, no billing API):
 * - Shop must be active (also enforced in lookups; repeated here for clarity).
 * - Need either bookable services OR scripted AI context (*welcome / custom instructions).
 * - Plan must allow inbound automation surface: `starter`+ passes; we additionally require
 *   professional+ OR starter with explicit greeting/script so starter tenants without AI config
 *   do not accept expensive realtime sessions (adjust when billing gates land).
 */
export function isShopCallable(shop: Shop): { ok: true } | { ok: false; reason: string } {
  if (!shop.active) {
    return { ok: false, reason: 'shop_inactive' };
  }

  const hasServices = shop.services.length > 0;
  const hasScript =
    Boolean(shop.ai_welcome_message?.trim()) || Boolean(shop.ai_custom_instructions?.trim());
  if (!hasServices && !hasScript) {
    return { ok: false, reason: 'insufficient_config' };
  }

  const caps = getShopPlanCapabilities(shop.plan);
  const planAllowsAiSurface = caps.edit_ai_greeting || caps.edit_ai_voice;
  if (shop.plan === 'starter' && !planAllowsAiSurface && !hasScript) {
    return { ok: false, reason: 'plan_requires_ai_config' };
  }

  return { ok: true };
}
