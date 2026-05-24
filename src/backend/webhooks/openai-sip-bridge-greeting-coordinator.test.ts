import test from 'node:test';
import assert from 'node:assert/strict';

import {
  cleanupBridgeGreetingSessionByCallControlId,
  initializeBridgeGreetingSession,
  markBridgeReadyForGreeting,
  queueGreetingUntilBridgeReady,
} from '@/src/backend/webhooks/openai-sip-bridge-greeting-coordinator';

test('queues production greeting until Telnyx bridge is ready', () => {
  initializeBridgeGreetingSession({
    parentCallControlId: 'cc_parent_wait',
    openaiLegCallControlId: 'cc_openai_wait',
    rbCallId: 'rb_wait',
    shopId: 'shop_wait',
  });

  let sent = 0;
  const queued = queueGreetingUntilBridgeReady({
    parentCallControlId: 'cc_parent_wait',
    openaiLegCallControlId: 'cc_openai_wait',
    pendingGreetingPayload: { instructions: 'Hello' },
    sendGreeting: () => {
      sent += 1;
    },
    fallbackMs: 30_000,
  });

  assert.equal(queued, 'queued');
  assert.equal(sent, 0);

  const marked = markBridgeReadyForGreeting({
    parentCallControlId: 'cc_parent_wait',
    openaiLegCallControlId: 'cc_openai_wait',
  });

  assert.equal(marked, 'sent');
  assert.equal(sent, 1);

  const duplicate = markBridgeReadyForGreeting({
    parentCallControlId: 'cc_parent_wait',
    openaiLegCallControlId: 'cc_openai_wait',
  });

  assert.equal(duplicate, 'already_sent');
  assert.equal(sent, 1);
  cleanupBridgeGreetingSessionByCallControlId('cc_parent_wait');
});

test('sends production greeting immediately when bridge event already arrived', () => {
  initializeBridgeGreetingSession({
    parentCallControlId: 'cc_parent_ready',
    openaiLegCallControlId: 'cc_openai_ready',
  });

  const marked = markBridgeReadyForGreeting({
    callControlId: 'cc_openai_ready',
    peerCallControlId: 'cc_parent_ready',
  });
  assert.equal(marked, 'ready');

  let sent = 0;
  const result = queueGreetingUntilBridgeReady({
    parentCallControlId: 'cc_parent_ready',
    openaiLegCallControlId: 'cc_openai_ready',
    pendingGreetingPayload: { instructions: 'Hello' },
    sendGreeting: () => {
      sent += 1;
    },
    fallbackMs: 30_000,
  });

  assert.equal(result, 'sent_immediately');
  assert.equal(sent, 1);
  cleanupBridgeGreetingSessionByCallControlId('cc_openai_ready');
});

test('fallback timer sends greeting when bridge event never arrives', async () => {
  initializeBridgeGreetingSession({
    parentCallControlId: 'cc_parent_fallback',
    openaiLegCallControlId: 'cc_openai_fallback',
  });

  let sent = 0;
  const result = queueGreetingUntilBridgeReady({
    parentCallControlId: 'cc_parent_fallback',
    openaiLegCallControlId: 'cc_openai_fallback',
    pendingGreetingPayload: { instructions: 'Hello' },
    sendGreeting: () => {
      sent += 1;
    },
    fallbackMs: 10,
  });

  assert.equal(result, 'queued');
  assert.equal(sent, 0);
  await new Promise((resolve) => setTimeout(resolve, 30));
  assert.equal(sent, 1);
  cleanupBridgeGreetingSessionByCallControlId('cc_parent_fallback');
});
