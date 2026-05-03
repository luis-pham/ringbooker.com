import test from 'node:test';
import assert from 'node:assert/strict';

import { InMemoryVoiceCallLegsRepository } from '@/src/backend/adapters/memory/voice-call-legs-repository';

test('voice_call_legs upsert by shop+rb+purpose and find active OpenAI cc', async () => {
  const repo = new InMemoryVoiceCallLegsRepository();
  await repo.createOrUpdateCallLeg({
    shopId: 'shop-1',
    rbCallId: 'rb-1',
    purpose: 'openai_sip_leg',
    parentCallControlId: 'cc_parent',
    status: 'openai_leg_created',
    callControlId: null,
  });
  await repo.createOrUpdateCallLeg({
    shopId: 'shop-1',
    rbCallId: 'rb-1',
    purpose: 'openai_sip_leg',
    callControlId: 'cc_openai',
    parentCallControlId: 'cc_parent',
    status: 'openai_leg_created',
  });
  const cc = await repo.findActiveOpenAiLegCallControlIdByRbCallId('shop-1', 'rb-1');
  assert.equal(cc, 'cc_openai');
  const byParent = await repo.findActiveOpenAiLegCallControlIdByParent('cc_parent');
  assert.equal(byParent, 'cc_openai');
  await repo.markCallLegEnded('cc_openai', 'openai_sip_leg');
  assert.equal(await repo.findActiveOpenAiLegCallControlIdByRbCallId('shop-1', 'rb-1'), null);
});

test('voice_call_legs duplicate upsert does not create second parent row', async () => {
  const repo = new InMemoryVoiceCallLegsRepository();
  const a = await repo.createOrUpdateCallLeg({
    shopId: 'shop-1',
    rbCallId: 'rb-2',
    purpose: 'parent_caller_leg',
    callControlId: 'cc_p',
    status: 'parent_leg_answered',
  });
  const b = await repo.createOrUpdateCallLeg({
    shopId: 'shop-1',
    rbCallId: 'rb-2',
    purpose: 'parent_caller_leg',
    callControlId: 'cc_p',
    status: 'parent_leg_answered',
  });
  assert.equal(a.id, b.id);
});
