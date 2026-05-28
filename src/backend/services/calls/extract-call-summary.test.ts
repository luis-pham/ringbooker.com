import test from 'node:test';
import assert from 'node:assert/strict';

import { InMemoryBookingsRepository } from '@/src/backend/adapters/memory/bookings-repository';
import { InMemoryCallLogsRepository } from '@/src/backend/adapters/memory/call-logs-repository';
import { InMemoryJobsRepository } from '@/src/backend/adapters/memory/jobs-repository';
import { InMemoryShopsRepository } from '@/src/backend/adapters/memory/shops-repository';
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
    'CALLER: Hello, what time do you open on Saturday morning? ASSISTANT: We open at 9 AM on Saturday and close at 6 PM.',
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

test('extractCallSummary protects partial booking intent from no_action_needed', async () => {
  process.env.OPENAI_API_KEY = 'test-key';
  mockOpenAiResponse({
    service_request: null,
    urgency: 'low',
    next_action: 'no_action_needed',
    caller_question: null,
    caller_name: null,
    preferred_tech: null,
    preferred_datetime: null,
    follow_up_required: false,
  });

  const result = await extractCallSummary(
    'CALLER: I want to book color tomorrow at 9 AM. ASSISTANT: Can I have your name for the request?',
    { callerPhone: '+15550001111' },
  );

  assert.equal(result.nextAction, 'booking_request_incomplete');
  assert.equal(result.followUpRequired, true);
  assert.equal(result.serviceRequest, 'color');
  assert.equal(result.preferredDatetime, 'tomorrow');
});

test('extractCallSummary protects latest booking transcript from unknown outcome', async () => {
  process.env.OPENAI_API_KEY = 'test-key';
  mockOpenAiResponse({
    service_request: null,
    urgency: 'low',
    next_action: 'no_action_needed',
    caller_question: null,
    caller_name: null,
    preferred_tech: null,
    preferred_datetime: null,
    follow_up_required: false,
  });

  const result = await extractCallSummary(
    [
      '[2026-05-28T14:03:33.593Z] CALLER: I want book service.',
      '[2026-05-28T14:03:34.797Z] ASSISTANT: Sure, what service would you like to book?',
      '[2026-05-28T14:04:00.664Z] CALLER: 10 AM tomorrow.',
      '[2026-05-28T14:04:08.451Z] ASSISTANT: Thanks for confirming. Could I have your full name for the booking?',
      '[2026-05-28T14:04:19.704Z] CALLER: My name is Huy.',
      '[2026-05-28T14:04:31.364Z] ASSISTANT: What’s the best phone number to reach you, just in case?',
    ].join('\n'),
    { callerPhone: '+84978613802' },
  );

  assert.equal(result.nextAction, 'booking_request_incomplete');
  assert.equal(result.followUpRequired, true);
  assert.equal(result.preferredDatetime, '10 AM');
});

test('extractCallSummary prompt treats phone as missing only when caller ID is unavailable', async () => {
  process.env.OPENAI_API_KEY = 'test-key';
  let prompt = '';
  globalThis.fetch = (async (_input, init) => {
    const body = JSON.parse(String(init?.body ?? '{}')) as { messages?: Array<{ content?: string }> };
    prompt = body.messages?.[0]?.content ?? '';
    return new Response(
      JSON.stringify({
        choices: [{ message: { content: JSON.stringify(SAFE_CALL_SUMMARY_DEFAULTS) } }],
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } },
    );
  }) as typeof fetch;

  await extractCallSummary(
    'CALLER: I want to book color tomorrow at 9 AM. ASSISTANT: I have the service and time.',
    { callerPhone: '+15550001111' },
  );

  assert.match(prompt, /Treat phone as already available when caller ID was available/);
  assert.match(prompt, /treat phone as missing only if caller ID was unavailable/);
  assert.doesNotMatch(prompt, /required details such as phone, name, service/);
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
    shopsRepository: new InMemoryShopsRepository(),
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

test('post_call_summary job labels partial booking as incomplete instead of unknown', async () => {
  process.env.OPENAI_API_KEY = 'test-key';
  mockOpenAiResponse({
    service_request: null,
    urgency: 'low',
    next_action: 'no_action_needed',
    caller_question: null,
    caller_name: null,
    preferred_tech: null,
    preferred_datetime: null,
    follow_up_required: false,
  });

  const jobsRepository = new InMemoryJobsRepository();
  const callLogsRepository = new InMemoryCallLogsRepository();
  await callLogsRepository.createOrUpdateInboundCall({
    provider: 'telnyx_call_control',
    providerCallId: 'partial-booking-call',
    shopId: 'shop-1',
    requestId: 'req-partial-booking',
    callerPhone: '+15550001111',
    startedAt: new Date('2026-05-01T00:00:00.000Z'),
  });
  await callLogsRepository.appendTranscriptByRequestId({
    shopId: 'shop-1',
    requestId: 'req-partial-booking',
    speaker: 'caller',
    text: 'I want to book color tomorrow at 9 AM.',
  });
  await callLogsRepository.appendTranscriptByRequestId({
    shopId: 'shop-1',
    requestId: 'req-partial-booking',
    speaker: 'assistant',
    text: 'Can I have your name for the request?',
  });
  await jobsRepository.enqueue({
    shopId: 'shop-1',
    type: 'post_call_summary',
    payload: { requestId: 'req-partial-booking', status: 'completed' },
    runAt: new Date('2026-05-01T00:00:01.000Z'),
    idempotencyKey: 'post-summary-partial-booking',
  });

  const result = await executeSingleJobsWorkerTickWithRuntime({
    jobsRepository,
    callLogsRepository,
    shopsRepository: new InMemoryShopsRepository(),
  } as any);

  assert.equal(result.processed, true);
  const [call] = await callLogsRepository.listByShop('shop-1', { limit: 1 });
  assert.equal(call.summaryNextAction, 'booking_request_incomplete');
  assert.equal(call.summaryFollowUpRequired, true);
  assert.match(call.transcriptText ?? '', /outcome=booking_request_incomplete/);
});

test('post_call_summary job upgrades an existing unknown summary for partial booking intent', async () => {
  process.env.OPENAI_API_KEY = 'test-key';
  mockOpenAiResponse({
    service_request: null,
    urgency: 'low',
    next_action: 'no_action_needed',
    caller_question: null,
    caller_name: null,
    preferred_tech: null,
    preferred_datetime: null,
    follow_up_required: false,
  });

  const jobsRepository = new InMemoryJobsRepository();
  const callLogsRepository = new InMemoryCallLogsRepository();
  await callLogsRepository.createOrUpdateInboundCall({
    provider: 'telnyx_call_control',
    providerCallId: 'partial-booking-call-with-old-summary',
    shopId: 'shop-1',
    requestId: 'req-partial-booking-old-summary',
    callerPhone: '+15550001111',
    startedAt: new Date('2026-05-01T00:00:00.000Z'),
  });
  await callLogsRepository.markEndedByProviderCallId({
    provider: 'telnyx_call_control',
    providerCallId: 'partial-booking-call-with-old-summary',
    endedAt: new Date('2026-05-01T00:00:30.000Z'),
    outcome: 'unknown',
  });
  await callLogsRepository.appendTranscriptByRequestId({
    shopId: 'shop-1',
    requestId: 'req-partial-booking-old-summary',
    speaker: 'caller',
    text: 'I want book service.',
  });
  await callLogsRepository.appendTranscriptByRequestId({
    shopId: 'shop-1',
    requestId: 'req-partial-booking-old-summary',
    speaker: 'caller',
    text: '10 AM tomorrow.',
  });
  await callLogsRepository.appendTranscriptByRequestId({
    shopId: 'shop-1',
    requestId: 'req-partial-booking-old-summary',
    speaker: 'system',
    text: '[POST_CALL_SUMMARY] status=completed | outcome=unknown',
  });
  await jobsRepository.enqueue({
    shopId: 'shop-1',
    type: 'post_call_summary',
    payload: { requestId: 'req-partial-booking-old-summary', status: 'completed' },
    runAt: new Date('2026-05-01T00:00:01.000Z'),
    idempotencyKey: 'post-summary-upgrade-unknown',
  });

  const result = await executeSingleJobsWorkerTickWithRuntime({
    jobsRepository,
    callLogsRepository,
    shopsRepository: new InMemoryShopsRepository(),
  } as any);

  assert.equal(result.processed, true);
  const [call] = await callLogsRepository.listByShop('shop-1', { limit: 1 });
  assert.equal(call.outcome, 'booking_request_incomplete');
  assert.equal(call.summaryNextAction, 'booking_request_incomplete');
  assert.match(call.transcriptText ?? '', /outcome=booking_request_incomplete/);
});

test('post_call_summary job upgrades unknown outcome when booking link was sent', async () => {
  process.env.OPENAI_API_KEY = 'test-key';
  mockOpenAiResponse({
    service_request: 'highlights',
    urgency: 'medium',
    next_action: 'booking_link_sent',
    caller_question: null,
    caller_name: 'Huy',
    preferred_tech: null,
    preferred_datetime: 'tomorrow at 9 AM',
    follow_up_required: false,
  });

  const jobsRepository = new InMemoryJobsRepository();
  const callLogsRepository = new InMemoryCallLogsRepository();
  await callLogsRepository.createOrUpdateInboundCall({
    provider: 'telnyx_call_control',
    providerCallId: 'booking-link-sent-call',
    shopId: 'shop-1',
    requestId: 'req-booking-link-sent',
    callerPhone: '+15550001111',
    startedAt: new Date('2026-05-01T00:00:00.000Z'),
  });
  await callLogsRepository.markEndedByProviderCallId({
    provider: 'telnyx_call_control',
    providerCallId: 'booking-link-sent-call',
    endedAt: new Date('2026-05-01T00:00:30.000Z'),
    outcome: 'unknown',
  });
  await callLogsRepository.appendTranscriptByRequestId({
    shopId: 'shop-1',
    requestId: 'req-booking-link-sent',
    speaker: 'caller',
    text: 'I want to book highlights tomorrow at 9 AM. My name is Huy.',
  });
  await callLogsRepository.appendTranscriptByRequestId({
    shopId: 'shop-1',
    requestId: 'req-booking-link-sent',
    speaker: 'assistant',
    text: 'The booking link has been sent.',
  });
  await jobsRepository.enqueue({
    shopId: 'shop-1',
    type: 'post_call_summary',
    payload: { requestId: 'req-booking-link-sent', status: 'completed' },
    runAt: new Date('2026-05-01T00:00:01.000Z'),
    idempotencyKey: 'post-summary-booking-link-sent',
  });

  const result = await executeSingleJobsWorkerTickWithRuntime({
    jobsRepository,
    callLogsRepository,
    shopsRepository: new InMemoryShopsRepository(),
    bookingsRepository: new InMemoryBookingsRepository(),
  } as any);

  assert.equal(result.processed, true);
  const [call] = await callLogsRepository.listByShop('shop-1', { limit: 1 });
  assert.notEqual(call.outcome, 'unknown');
  assert.equal(call.outcome, 'booking_link_sent');
  assert.equal(call.summaryNextAction, 'booking_link_sent');
  assert.match(call.transcriptText ?? '', /outcome=booking_link_sent/);
});

test('post_call_summary job upgrades unknown outcome when booking was created', async () => {
  process.env.OPENAI_API_KEY = 'test-key';
  mockOpenAiResponse({
    service_request: 'highlights',
    urgency: 'medium',
    next_action: 'booking_created',
    caller_question: null,
    caller_name: 'Huy',
    preferred_tech: null,
    preferred_datetime: 'tomorrow at 9 AM',
    follow_up_required: false,
  });

  const jobsRepository = new InMemoryJobsRepository();
  const callLogsRepository = new InMemoryCallLogsRepository();
  await callLogsRepository.createOrUpdateInboundCall({
    provider: 'telnyx_call_control',
    providerCallId: 'booking-created-call',
    shopId: 'shop-1',
    requestId: 'req-booking-created',
    callerPhone: '+15550001111',
    startedAt: new Date('2026-05-01T00:00:00.000Z'),
  });
  await callLogsRepository.markEndedByProviderCallId({
    provider: 'telnyx_call_control',
    providerCallId: 'booking-created-call',
    endedAt: new Date('2026-05-01T00:00:30.000Z'),
    outcome: 'unknown',
  });
  await callLogsRepository.appendTranscriptByRequestId({
    shopId: 'shop-1',
    requestId: 'req-booking-created',
    speaker: 'caller',
    text: 'I want to book highlights tomorrow at 9 AM. My name is Huy.',
  });
  await callLogsRepository.appendTranscriptByRequestId({
    shopId: 'shop-1',
    requestId: 'req-booking-created',
    speaker: 'assistant',
    text: 'Your booking has been created.',
  });
  await jobsRepository.enqueue({
    shopId: 'shop-1',
    type: 'post_call_summary',
    payload: { requestId: 'req-booking-created', status: 'completed' },
    runAt: new Date('2026-05-01T00:00:01.000Z'),
    idempotencyKey: 'post-summary-booking-created',
  });

  const result = await executeSingleJobsWorkerTickWithRuntime({
    jobsRepository,
    callLogsRepository,
    shopsRepository: new InMemoryShopsRepository(),
    bookingsRepository: new InMemoryBookingsRepository(),
  } as any);

  assert.equal(result.processed, true);
  const [call] = await callLogsRepository.listByShop('shop-1', { limit: 1 });
  assert.notEqual(call.outcome, 'unknown');
  assert.equal(call.outcome, 'booking_created');
  assert.equal(call.summaryNextAction, 'booking_created');
  assert.match(call.transcriptText ?? '', /outcome=booking_created/);
});

test('post_call_summary job upgrades unknown outcome when linked booking exists', async () => {
  process.env.OPENAI_API_KEY = 'test-key';
  mockOpenAiResponse({
    service_request: null,
    urgency: 'low',
    next_action: 'no_action_needed',
    caller_question: null,
    caller_name: null,
    preferred_tech: null,
    preferred_datetime: null,
    follow_up_required: false,
  });

  const jobsRepository = new InMemoryJobsRepository();
  const callLogsRepository = new InMemoryCallLogsRepository();
  const bookingsRepository = new InMemoryBookingsRepository();
  await callLogsRepository.createOrUpdateInboundCall({
    provider: 'telnyx_call_control',
    providerCallId: 'linked-booking-call',
    shopId: 'shop-1',
    requestId: 'req-linked-booking',
    callerPhone: '+15550001111',
    startedAt: new Date('2026-05-01T00:00:00.000Z'),
  });
  await callLogsRepository.markEndedByProviderCallId({
    provider: 'telnyx_call_control',
    providerCallId: 'linked-booking-call',
    endedAt: new Date('2026-05-01T00:00:30.000Z'),
    outcome: 'unknown',
  });
  await callLogsRepository.appendTranscriptByRequestId({
    shopId: 'shop-1',
    requestId: 'req-linked-booking',
    speaker: 'caller',
    text: 'Thanks.',
  });
  await bookingsRepository.create({
    id: 'booking-linked-1',
    shopId: 'shop-1',
    customerPhone: '+15550001111',
    customerName: 'Huy',
    service: 'highlights',
    datetimeUtc: '2026-05-02T16:00:00.000Z',
    timezone: 'America/Los_Angeles',
    status: 'new',
    callLogId: 'req-linked-booking',
  });
  await jobsRepository.enqueue({
    shopId: 'shop-1',
    type: 'post_call_summary',
    payload: { requestId: 'req-linked-booking', status: 'completed' },
    runAt: new Date('2026-05-01T00:00:01.000Z'),
    idempotencyKey: 'post-summary-linked-booking',
  });

  const result = await executeSingleJobsWorkerTickWithRuntime({
    jobsRepository,
    callLogsRepository,
    shopsRepository: new InMemoryShopsRepository(),
    bookingsRepository,
  } as any);

  assert.equal(result.processed, true);
  const [call] = await callLogsRepository.listByShop('shop-1', { limit: 1 });
  assert.equal(call.outcome, 'captured_call');
  assert.match(call.transcriptText ?? '', /outcome=captured_call/);
});

test('post_call_summary job keeps unknown outcome when there is no booking evidence', async () => {
  process.env.OPENAI_API_KEY = 'test-key';
  mockOpenAiResponse({
    service_request: null,
    urgency: 'low',
    next_action: 'no_action_needed',
    caller_question: null,
    caller_name: null,
    preferred_tech: null,
    preferred_datetime: null,
    follow_up_required: false,
  });

  const jobsRepository = new InMemoryJobsRepository();
  const callLogsRepository = new InMemoryCallLogsRepository();
  await callLogsRepository.createOrUpdateInboundCall({
    provider: 'telnyx_call_control',
    providerCallId: 'unknown-no-evidence-call',
    shopId: 'shop-1',
    requestId: 'req-unknown-no-evidence',
    callerPhone: '+15550001111',
    startedAt: new Date('2026-05-01T00:00:00.000Z'),
  });
  await callLogsRepository.markEndedByProviderCallId({
    provider: 'telnyx_call_control',
    providerCallId: 'unknown-no-evidence-call',
    endedAt: new Date('2026-05-01T00:00:30.000Z'),
    outcome: 'unknown',
  });
  await callLogsRepository.appendTranscriptByRequestId({
    shopId: 'shop-1',
    requestId: 'req-unknown-no-evidence',
    speaker: 'caller',
    text: 'Thank you.',
  });
  await jobsRepository.enqueue({
    shopId: 'shop-1',
    type: 'post_call_summary',
    payload: { requestId: 'req-unknown-no-evidence', status: 'completed' },
    runAt: new Date('2026-05-01T00:00:01.000Z'),
    idempotencyKey: 'post-summary-unknown-no-evidence',
  });

  const result = await executeSingleJobsWorkerTickWithRuntime({
    jobsRepository,
    callLogsRepository,
    shopsRepository: new InMemoryShopsRepository(),
    bookingsRepository: new InMemoryBookingsRepository(),
  } as any);

  assert.equal(result.processed, true);
  const [call] = await callLogsRepository.listByShop('shop-1', { limit: 1 });
  assert.equal(call.outcome, 'unknown');
  assert.match(call.transcriptText ?? '', /outcome=unknown/);
});

test('post_call_summary job does not infer a captured outcome when only the assistant spoke', async () => {
  process.env.OPENAI_API_KEY = 'test-key';
  let called = false;
  globalThis.fetch = (async () => {
    called = true;
    throw new Error('summary extraction should not run without caller speech');
  }) as typeof fetch;

  const jobsRepository = new InMemoryJobsRepository();
  const callLogsRepository = new InMemoryCallLogsRepository();
  await callLogsRepository.createOrUpdateInboundCall({
    provider: 'telnyx_call_control',
    providerCallId: 'assistant-only-call',
    shopId: 'shop-1',
    requestId: 'req-assistant-only',
    callerPhone: '+15550001111',
    startedAt: new Date('2026-05-01T00:00:00.000Z'),
  });
  await callLogsRepository.appendTranscriptByRequestId({
    shopId: 'shop-1',
    requestId: 'req-assistant-only',
    speaker: 'assistant',
    text: 'Thank you for calling. How can I help you today?',
  });
  await jobsRepository.enqueue({
    shopId: 'shop-1',
    type: 'post_call_summary',
    payload: { requestId: 'req-assistant-only', status: 'completed' },
    runAt: new Date('2026-05-01T00:00:01.000Z'),
    idempotencyKey: 'post-summary-assistant-only',
  });

  const result = await executeSingleJobsWorkerTickWithRuntime({
    jobsRepository,
    callLogsRepository,
    shopsRepository: new InMemoryShopsRepository(),
  } as any);

  assert.equal(result.processed, true);
  assert.equal(called, false);
  const [call] = await callLogsRepository.listByShop('shop-1', { limit: 1 });
  assert.equal(call.summaryNextAction, 'no_action_needed');
  assert.equal(call.isCapturedCaller, false);
});
