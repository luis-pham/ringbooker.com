import type { Shop } from '@/src/backend/domain/types';

/**
 * Gates answering inbound AI calls before Telnyx Call Control `answer`.
 *
 * Rules:
 * - Shop must be active.
 * - Must have at least one configured service (legacy list or service catalog) OR an AI script.
 *   Services alone are sufficient for all plans — a greeting is optional.
 */
export function isShopCallable(shop: Shop): { ok: true } | { ok: false; reason: string } {
  if (!shop.active) {
    return { ok: false, reason: 'shop_inactive' };
  }

  const hasServices =
    shop.services.length > 0 ||
    Boolean(
      shop.service_catalog?.services.some(
        (s) => s.active !== false && typeof s.name === 'string' && s.name.trim().length > 0,
      ),
    );
  const hasScript =
    Boolean(shop.ai_welcome_message?.trim()) || Boolean(shop.ai_custom_instructions?.trim());
  if (!hasServices && !hasScript) {
    return { ok: false, reason: 'insufficient_config' };
  }

  return { ok: true };
}
