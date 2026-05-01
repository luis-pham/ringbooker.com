import test from 'node:test';
import assert from 'node:assert/strict';

import { InMemoryCallLogsRepository } from '@/src/backend/adapters/memory/call-logs-repository';
import { InMemoryJobsRepository } from '@/src/backend/adapters/memory/jobs-repository';
import { executeSingleJobsWorkerTickWithRuntime } from '@/src/backend/jobs/runner';
import { extractCallSummary, SAFE_CALL_SUMMARY_DEFAULTS } from './extract-call-summary';

function mockOpenAiResponse(payload: Record<string, unknown>) {
  globalThis.fetch = (async () =>
    new Response(
      JSON.stringify({
        choices: [{ message: { content: JSON.stringify(payload) } }],
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } },
    )) as typeof fetch;
}

test('extractCallSummary returns high urgency for cancellation', async () => {
  process.env.OPENAI_API_KEY = 'test-key';
  mockOpenAiResponse({
    service_request: null,
    urgency: 'high',
    next_action: 'cancellation_requested',
    caller_question: 'Can I cancel my appointment?',
    caller_name: 'Jane',
    preferred_tech: null,
    preferred_datetime: 'Friday afternoon',
    follow_up_required: true,
  });

  const result = await extractCallSummary(
    'CALLER: Hi, this is Jane. I want to cancel my appointment this Friday afternoon because something came up. ASSISTANT: I can help record that cancellation request.',
  );

  assert.equal(result.urgency, 'high');
  assert.equal(result.nextAction, 'cancellation_requested');
  assert.equal(result.followUpRequired, true);
  assert.equal(result.callerName, 'Jane');
});

test('extractCallSummary returns low urgency for hours inquiry', async () => {
  process.env.OPENAI_API_KEY = 'test-key';
  mockOpenAiResponse({
    service_request: null,
    urgency: 'low',
    next_action: 'info_provided',
    caller_question: 'What time do you open on Saturday?',
    caller_name: null,
    preferred_tech: null,
    preferred_datetime: null,
    follow_up_required: false,
  });

  const result = await extractCallSummary(
    'CALLER: Hello, what time do you open on Saturday morning? ASSISTANT: We open at 9 AM on Saturday and close at 6 PM. CALLER: Great, thank you for the information.',
  );

  assert.equal(result.urgency, 'low');
  assert.equal(result.nextAction, 'info_provided');
  assert.equal(result.followUpRequired, false);
});

test('extractCallSummary returns safe defaults on OpenAI error', async () => {
  process.env.OPENAI_API_KEY = 'test-key';
  globalThis.fetch = (async () => {
    throw new Error('network down');
  }) as typeof fetch;

  const result = await extractCallSummary(
    'CALLER: I want to book a gel manicure tomorrow afternoon. ASSISTANT: I can help with booking and checking availability for your requested appointment time.',
  );

  assert.deepEqual(result, SAFE_CALL_SUMMARY_DEFAULTS);
});

test('extractCallSummary returns safe defaults for empty transcript', async () => {
  let called = false;
  globalThis.fetch = (async () => {
    called = true;
    throw new Error('should not be called');
  }) as typeof fetch;

  const result = await extractCallSummary('');

  assert.deepEqual(result, SAFE_CALL_SUMMARY_DEFAULTS);
  assert.equal(called, false);
});

test('post_call_summary job saves structured fields', async () => {
  process.env.OPENAI_API_KEY = 'test-key';
  mockOpenAiResponse({
    service_request: 'gel manicure',
    urgency: 'medium',
    next_action: 'booking_link_sent',
    caller_question: 'Can I book a gel manicure?',
    caller_name: 'Mary',
    preferred_tech: 'Sarah',
    preferred_datetime: 'Saturday morning',
    follow_up_required: false,
  });

  const jobsRepository = new InMemoryJobsRepository();
  const callLogsRepository = new InMemoryCallLogsRepository();
  await callLogsRepository.createOrUpdateInboundCall({
    provider: 'telnyx',
    providerCallId: 'call-1',
    shopId: 'shop-1',
    requestId: 'req-1',
    callerPhone: '+15550001111',
    startedAt: new Date('2026-05-01T00:00:00.000Z'),
  });
  await callLogsRepository.appendTranscriptByRequestId({
    shopId: 'shop-1',
    requestId: 'req-1',
    speaker: 'caller',
    text: 'Hi, this is Mary. Can I book a gel manicure with Sarah this Saturday morning?',
  });
  await callLogsRepository.appendTranscriptByRequestId({
    shopId: 'shop-1',
    requestId: 'req-1',
    speaker: 'assistant',
    text: 'I sent you the booking link so you can choose that appointment time.',
  });
  await jobsRepository.enqueue({
    shopId: 'shop-1',
    type: 'post_call_summary',
    payload: { requestId: 'req-1', status: 'completed' },
    runAt: new Date('2026-05-01T00:00:01.000Z'),
    idempotencyKey: 'post-summary-test',
  });

  const result = await executeSingleJobsWorkerTickWithRuntime({
    jobsRepository,
    callLogsRepository,
  } as any);

  assert.equal(result.processed, true);
  const [call] = await callLogsRepository.listByShop('shop-1', { limit: 1 });
  assert.equal(call.summaryServiceRequest, 'gel manicure');
  assert.equal(call.summaryUrgency, 'medium');
  assert.equal(call.summaryNextAction, 'booking_link_sent');
  assert.equal(call.summaryCallerName, 'Mary');
  assert.equal(call.summaryPreferredTech, 'Sarah');
  assert.equal(call.summaryPreferredDatetime, 'Saturday morning');
});
