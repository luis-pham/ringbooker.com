import type { CallbackJob, Shop } from '@/src/backend/domain/types';
import { buildSystemPrompt } from '@/src/backend/prompts/build-system-prompt';

export function buildCallbackPrompt(shop: Shop, callback: CallbackJob): string {
  return [
    buildSystemPrompt({
      shop,
      customer: null,
      mode: 'callback',
    }),
    `CALLBACK_CONTEXT: Customer requested a callback from ${shop.name}.`,
    `CALLBACK_REASON: ${callback.reason}.`,
  ].join('\n');
}
