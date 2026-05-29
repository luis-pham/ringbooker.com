/**
 * Sideband timer behaviour tests.
 *
 * Strategy: spin up a real local WebSocket server so startOpenAiRealtimeSipSideband
 * connects to it, then use fake timers (mock.timers) to control setTimeout without
 * waiting real wall-clock time.
 *
 * Covers:
 *   1. onWsDropped fires on unexpected close code (not 1000/1001)
 *   2. onWsDropped does NOT fire on clean close (code 1000)
 *   3. onHardLimit fires after hardLimitMs from WS open
 *   4. Hard-limit timer is cleared on clean close — onHardLimit does NOT fire
 *   5. onEndCall fires when server sends end_call tool then output_audio_buffer.stopped
 *   6. onEndCall fires via fallback timer when output_audio_buffer.stopped never arrives
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { AddressInfo } from 'node:net';

import { WebSocketServer, WebSocket } from 'ws';

import { startOpenAiRealtimeSipSideband } from './openai-realtime-sip-sideband';
import {
  cleanupBridgeGreetingSessionByCallControlId,
  initializeBridgeGreetingSession,
  markBridgeReadyForGreeting,
} from './openai-sip-bridge-greeting-coordinator';

// ---------------------------------------------------------------------------
// Local WS server (shared across all tests in this file)
// ---------------------------------------------------------------------------
let wss: InstanceType<typeof WebSocketServer>;
let wssPort: number;

test.before(() => {
  wss = new WebSocketServer({ port: 0 });
  wssPort = (wss.address() as AddressInfo).port;
});

test.after(async () => {
  for (const client of wss.clients) {
    client.terminate();
  }
  await new Promise<void>((resolve) => {
    const fallback = setTimeout(resolve, 500);
    fallback.unref?.();
    wss.close(() => {
      clearTimeout(fallback);
      resolve();
    });
  });
  (wss as unknown as { _server?: { unref?: () => void } })._server?.unref?.();
});

/** Returns a promise that resolves with the next server-side socket connection. */
function nextServerSocket(): Promise<WebSocket> {
  return new Promise((resolve) => {
    wss.once('connection', (socket) => resolve(socket as WebSocket));
  });
}

/** Yields to the event loop so queued I/O callbacks can run. */
function flushIO(ms = 50): Promise<void> {
  return new Promise((resolve) => {
    // Real setTimeout (not faked) — use setImmediate-based polling.
    const start = Date.now();
    function check() {
      if (Date.now() - start >= ms) return resolve();
      setImmediate(check);
    }
    setImmediate(check);
  });
}

function sidebandUrl(callId: string) {
  return `ws://127.0.0.1:${wssPort}?call_id=${encodeURIComponent(callId)}`;
}

const TOOL_IMPL = async () => JSON.stringify({ ok: true });

// ---------------------------------------------------------------------------
// Test 1: onWsDropped fires on unexpected close code
// ---------------------------------------------------------------------------
test('onWsDropped fires when server closes with unexpected code', async () => {
  const serverSocket = nextServerSocket();

  const drops: number[] = [];
  startOpenAiRealtimeSipSideband(
    {
      variant: 'shop',
      callId: 'drop-test',
      apiKey: 'sk-test',
      executeBusinessTool: TOOL_IMPL,
      onWsDropped: (code) => drops.push(code),
    },
    { wsUrlOverride: sidebandUrl('drop-test'), greetingDelayMs: 0 },
  );

  const srv = await serverSocket;
  // Wait for sideband open event to propagate
  await flushIO(30);

  // Server closes with an unexpected code
  srv.close(4500, 'simulated drop');
  await flushIO(80);

  assert.deepEqual(drops, [4500]);
});

// ---------------------------------------------------------------------------
// Test 2: onWsDropped does NOT fire on clean close (code 1000)
// ---------------------------------------------------------------------------
test('onWsDropped does NOT fire on clean close code 1000', async () => {
  const serverSocket = nextServerSocket();

  const drops: number[] = [];
  startOpenAiRealtimeSipSideband(
    {
      variant: 'shop',
      callId: 'clean-close-test',
      apiKey: 'sk-test',
      executeBusinessTool: TOOL_IMPL,
      onWsDropped: (code) => drops.push(code),
    },
    { wsUrlOverride: sidebandUrl('clean-close-test'), greetingDelayMs: 0 },
  );

  const srv = await serverSocket;
  await flushIO(30);

  srv.close(1000, 'normal');
  await flushIO(80);

  assert.deepEqual(drops, []);
});

// ---------------------------------------------------------------------------
// Test 3: onHardLimit fires after hardLimitMs (fake timers)
// ---------------------------------------------------------------------------
test('onHardLimit fires after hardLimitMs from WS open', async (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] });

  const serverSocket = nextServerSocket();

  let hardLimitFired = false;
  startOpenAiRealtimeSipSideband(
    {
      variant: 'shop',
      callId: 'hard-limit-test',
      apiKey: 'sk-test',
      executeBusinessTool: TOOL_IMPL,
      hardLimitMs: 5_000,
      onHardLimit: () => {
        hardLimitFired = true;
      },
    },
    { wsUrlOverride: sidebandUrl('hard-limit-test'), greetingDelayMs: 0 },
  );

  // Wait for the real WS connection to be established (I/O is not faked)
  const srv = await serverSocket;
  await flushIO(30);

  // Timer has been set; advance fake clock past hardLimitMs
  t.mock.timers.tick(5_001);

  assert.equal(hardLimitFired, true, 'onHardLimit should have fired after tick(5001)');
  srv.close(1000, 'test complete');
  t.mock.timers.reset();
});

// ---------------------------------------------------------------------------
// Test 4: Hard-limit timer is cleared on clean close — onHardLimit never fires
// ---------------------------------------------------------------------------
test('hard-limit timer is cleared when WS closes with code 1000', async (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] });

  const serverSocket = nextServerSocket();

  let hardLimitFired = false;
  startOpenAiRealtimeSipSideband(
    {
      variant: 'shop',
      callId: 'timer-clear-test',
      apiKey: 'sk-test',
      executeBusinessTool: TOOL_IMPL,
      hardLimitMs: 5_000,
      onHardLimit: () => {
        hardLimitFired = true;
      },
    },
    { wsUrlOverride: sidebandUrl('timer-clear-test'), greetingDelayMs: 0 },
  );

  const srv = await serverSocket;
  await flushIO(30);

  // Server closes cleanly before the hard limit fires
  srv.close(1000, 'call ended');
  // Let the close event propagate (I/O, not timer-based)
  await flushIO(80);

  // Advance fake clock well past hardLimitMs — timer should already be cleared
  t.mock.timers.tick(10_000);

  assert.equal(hardLimitFired, false, 'onHardLimit must not fire after clean WS close');
  t.mock.timers.reset();
});

test('bridge-ready production greeting sends immediately without fixed sideband delay', async () => {
  initializeBridgeGreetingSession({
    parentCallControlId: 'cc_parent_no_delay',
    openaiLegCallControlId: 'cc_openai_no_delay',
  });
  markBridgeReadyForGreeting({
    parentCallControlId: 'cc_parent_no_delay',
    openaiLegCallControlId: 'cc_openai_no_delay',
  });

  const serverSocket = nextServerSocket();
  startOpenAiRealtimeSipSideband(
    {
      variant: 'shop',
      callId: 'bridge-no-delay-test',
      apiKey: 'sk-test',
      executeBusinessTool: TOOL_IMPL,
      initialResponseInstructions: 'Hello',
      initialResponseBridgeGate: {
        parentCallControlId: 'cc_parent_no_delay',
        openaiLegCallControlId: 'cc_openai_no_delay',
      },
    },
    { wsUrlOverride: sidebandUrl('bridge-no-delay-test'), greetingDelayMs: 30_000 },
  );

  const srv = await serverSocket;
  const messages: string[] = [];
  srv.on('message', (data) => messages.push(String(data)));
  await flushIO(30);

  assert.equal(messages.length, 1);
  assert.match(messages[0] ?? '', /response\.create/);
  srv.send(JSON.stringify({ type: 'output_audio_buffer.started' }));
  srv.send(JSON.stringify({ type: 'output_audio_buffer.stopped' }));
  await flushIO(30);
  assert.ok(messages.some((message) => message.includes('session.update')));
  assert.ok(messages.some((message) => message.includes('"create_response":false')));
  srv.close(1000, 'test complete');
  cleanupBridgeGreetingSessionByCallControlId('cc_parent_no_delay');
});

test('bridge-gated shop injects appointment validation before responding to a requested time', async () => {
  initializeBridgeGreetingSession({
    parentCallControlId: 'cc_parent_time_validation',
    openaiLegCallControlId: 'cc_openai_time_validation',
  });
  markBridgeReadyForGreeting({
    parentCallControlId: 'cc_parent_time_validation',
    openaiLegCallControlId: 'cc_openai_time_validation',
  });

  const serverSocket = nextServerSocket();
  startOpenAiRealtimeSipSideband(
    {
      variant: 'shop',
      callId: 'time-validation-turn-test',
      apiKey: 'sk-test',
      executeBusinessTool: TOOL_IMPL,
      initialResponseInstructions: 'Hello',
      initialResponseBridgeGate: {
        parentCallControlId: 'cc_parent_time_validation',
        openaiLegCallControlId: 'cc_openai_time_validation',
      },
      onCallerTranscriptPrePopulate: () => ({
        preview: { date: '2099-01-06', time: '21:00' },
        result: Promise.resolve({
          date: '2099-01-06',
          time: '21:00',
          valid: true,
          reason: 'within_business_hours',
          normalizedDatetimeUtc: '2099-01-07T05:00:00.000Z',
          messageForAi: 'The requested time may be captured.',
          timestamp: new Date().toISOString(),
          status: 'set',
        }),
      }),
    },
    { wsUrlOverride: sidebandUrl('time-validation-turn-test'), greetingDelayMs: 0 },
  );

  const srv = await serverSocket;
  const messages: string[] = [];
  srv.on('message', (data) => messages.push(String(data)));
  await flushIO(30);

  srv.send(JSON.stringify({ type: 'output_audio_buffer.started' }));
  srv.send(JSON.stringify({ type: 'output_audio_buffer.stopped' }));
  await flushIO(30);
  srv.send(JSON.stringify({
    type: 'response.output_audio_transcript.done',
    transcript: 'What date and time would you like for your booking?',
  }));
  srv.send(JSON.stringify({
    type: 'conversation.item.input_audio_transcription.completed',
    transcript: 'Tomorrow at 9 PM.',
  }));
  await flushIO(30);

  const parsed = messages
    .map((message) => JSON.parse(message) as {
      type?: string;
      item?: { type?: string; name?: string; call_id?: string; output?: string };
      response?: { tool_choice?: unknown; instructions?: string };
    });
  const injectedCall = parsed.find((message) =>
    message.type === 'conversation.item.create' &&
    message.item?.type === 'function_call' &&
    message.item.name === 'validate_appointment_time'
  );
  const injectedOutput = parsed.find((message) =>
    message.type === 'conversation.item.create' &&
    message.item?.type === 'function_call_output' &&
    message.item.call_id === injectedCall?.item?.call_id
  );
  const turnResponse = parsed.find((message) =>
    message.type === 'response.create' &&
    /already validated/.test(message.response?.instructions ?? '')
  );
  assert.ok(injectedCall, 'validation function_call should be injected');
  assert.ok(injectedOutput, 'validation function_call_output should be injected');
  assert.ok(turnResponse, 'response.create should use injected validation evidence');
  assert.equal(turnResponse?.response?.tool_choice, undefined, 'valid time without availability should leave tool choice unset');
  assert.equal(
    parsed.some((message) =>
      typeof message.response?.tool_choice === 'object' &&
      (message.response.tool_choice as { name?: string }).name === 'validate_appointment_time'
    ),
    false,
    'sideband should not force a validate_appointment_time model round-trip',
  );
  srv.close(1000, 'test complete');
  cleanupBridgeGreetingSessionByCallControlId('cc_parent_time_validation');
});

test('bridge-gated shop injects availability before response when prefetch is ready', async () => {
  initializeBridgeGreetingSession({
    parentCallControlId: 'cc_parent_availability_inject',
    openaiLegCallControlId: 'cc_openai_availability_inject',
  });
  markBridgeReadyForGreeting({
    parentCallControlId: 'cc_parent_availability_inject',
    openaiLegCallControlId: 'cc_openai_availability_inject',
  });

  const serverSocket = nextServerSocket();
  let validationCompleteCalled = false;
  startOpenAiRealtimeSipSideband(
    {
      variant: 'shop',
      callId: 'availability-inject-turn-test',
      apiKey: 'sk-test',
      executeBusinessTool: TOOL_IMPL,
      initialResponseInstructions: 'Hello',
      initialResponseBridgeGate: {
        parentCallControlId: 'cc_parent_availability_inject',
        openaiLegCallControlId: 'cc_openai_availability_inject',
      },
      onCallerTranscriptPrePopulate: () => ({
        preview: { date: '2099-01-06', time: '09:00' },
        result: Promise.resolve({
          date: '2099-01-06',
          time: '09:00',
          valid: true,
          reason: 'within_business_hours',
          normalizedDatetimeUtc: '2099-01-06T17:00:00.000Z',
          messageForAi: 'The requested time may be captured.',
          timestamp: new Date().toISOString(),
          status: 'set',
        }),
      }),
      onValidationPrePopulateComplete: () => {
        validationCompleteCalled = true;
      },
      onBeforeResponseCreate: async () => ({
        availabilityResult: {
          providerId: 'google_calendar',
          service: 'Manicure',
          date: '2099-01-06',
          time: '09:00',
          available: true,
          suggestions: [{ date: '2099-01-06', time: '09:00' }],
          raw: { available: true },
          fetchedAtMs: Date.now(),
          prefetchStartedAtMs: Date.now() - 50,
        },
      }),
    },
    { wsUrlOverride: sidebandUrl('availability-inject-turn-test'), greetingDelayMs: 0 },
  );

  const srv = await serverSocket;
  const messages: string[] = [];
  srv.on('message', (data) => messages.push(String(data)));
  await flushIO(30);

  srv.send(JSON.stringify({ type: 'output_audio_buffer.started' }));
  srv.send(JSON.stringify({ type: 'output_audio_buffer.stopped' }));
  await flushIO(30);
  srv.send(JSON.stringify({
    type: 'response.output_audio_transcript.done',
    transcript: 'What date and time would you like for your booking?',
  }));
  srv.send(JSON.stringify({
    type: 'conversation.item.input_audio_transcription.completed',
    transcript: 'Tomorrow at 9 AM.',
  }));
  await flushIO(30);

  const parsed = messages
    .map((message) => JSON.parse(message) as {
      type?: string;
      item?: { type?: string; name?: string; call_id?: string; output?: string };
      response?: { tool_choice?: unknown; instructions?: string };
    });
  const injectedItems = parsed
    .filter((message) => message.type === 'conversation.item.create')
    .map((message) => {
      if (message.item?.type === 'function_call') return `call:${message.item.name}`;
      if (message.item?.type === 'function_call_output') return 'output';
      return message.item?.type ?? 'unknown';
    });
  const turnResponse = parsed.find((message) =>
    message.type === 'response.create' &&
    /already validated/.test(message.response?.instructions ?? '')
  );

  assert.equal(validationCompleteCalled, true);
  assert.deepEqual(injectedItems.slice(-4), [
    'call:validate_appointment_time',
    'output',
    'call:check_availability',
    'output',
  ]);
  assert.equal(turnResponse?.response?.tool_choice, 'none');
  assert.match(turnResponse?.response?.instructions ?? '', /Availability checked/);
  srv.close(1000, 'test complete');
  cleanupBridgeGreetingSessionByCallControlId('cc_parent_availability_inject');
});

test('bridge-gated shop creates an ordinary response for a caller question without an appointment time', async () => {
  initializeBridgeGreetingSession({
    parentCallControlId: 'cc_parent_general_turn',
    openaiLegCallControlId: 'cc_openai_general_turn',
  });
  markBridgeReadyForGreeting({
    parentCallControlId: 'cc_parent_general_turn',
    openaiLegCallControlId: 'cc_openai_general_turn',
  });

  const serverSocket = nextServerSocket();
  startOpenAiRealtimeSipSideband(
    {
      variant: 'shop',
      callId: 'general-turn-test',
      apiKey: 'sk-test',
      executeBusinessTool: TOOL_IMPL,
      initialResponseInstructions: 'Hello',
      initialResponseBridgeGate: {
        parentCallControlId: 'cc_parent_general_turn',
        openaiLegCallControlId: 'cc_openai_general_turn',
      },
    },
    { wsUrlOverride: sidebandUrl('general-turn-test'), greetingDelayMs: 0 },
  );

  const srv = await serverSocket;
  const messages: string[] = [];
  srv.on('message', (data) => messages.push(String(data)));
  await flushIO(30);
  srv.send(JSON.stringify({ type: 'output_audio_buffer.started' }));
  srv.send(JSON.stringify({ type: 'output_audio_buffer.stopped' }));
  await flushIO(30);
  srv.send(JSON.stringify({
    type: 'conversation.item.input_audio_transcription.completed',
    transcript: 'What are your hours?',
  }));
  await flushIO(30);

  const responseMessages = messages
    .map((message) => JSON.parse(message) as { type?: string; response?: { tool_choice?: unknown } })
    .filter((message) => message.type === 'response.create');
  const callerTurnResponse = responseMessages.at(-1);
  assert.equal(responseMessages.length, 2);
  assert.equal(callerTurnResponse?.response?.tool_choice, undefined);
  srv.send(JSON.stringify({ type: 'response.done' }));
  await flushIO(30);
  srv.send(JSON.stringify({ type: 'conversation.item.input_audio_transcription.failed' }));
  await flushIO(30);
  const responseCountAfterFailedTranscript = messages
    .map((message) => JSON.parse(message) as { type?: string })
    .filter((message) => message.type === 'response.create').length;
  assert.equal(responseCountAfterFailedTranscript, 3);
  srv.close(1000, 'test complete');
  cleanupBridgeGreetingSessionByCallControlId('cc_parent_general_turn');
});

test('bridge-gated shop ignores filler transcripts while a response is in-flight', async () => {
  initializeBridgeGreetingSession({
    parentCallControlId: 'cc_parent_filler_lock',
    openaiLegCallControlId: 'cc_openai_filler_lock',
  });
  markBridgeReadyForGreeting({
    parentCallControlId: 'cc_parent_filler_lock',
    openaiLegCallControlId: 'cc_openai_filler_lock',
  });

  const serverSocket = nextServerSocket();
  startOpenAiRealtimeSipSideband(
    {
      variant: 'shop',
      callId: 'filler-lock-test',
      apiKey: 'sk-test',
      executeBusinessTool: TOOL_IMPL,
      initialResponseInstructions: 'Hello',
      initialResponseBridgeGate: {
        parentCallControlId: 'cc_parent_filler_lock',
        openaiLegCallControlId: 'cc_openai_filler_lock',
      },
    },
    { wsUrlOverride: sidebandUrl('filler-lock-test'), greetingDelayMs: 0 },
  );

  const srv = await serverSocket;
  const messages: string[] = [];
  srv.on('message', (data) => messages.push(String(data)));
  await flushIO(30);
  srv.send(JSON.stringify({ type: 'output_audio_buffer.started' }));
  srv.send(JSON.stringify({ type: 'output_audio_buffer.stopped' }));
  await flushIO(30);

  srv.send(JSON.stringify({
    type: 'conversation.item.input_audio_transcription.completed',
    transcript: 'I want to book.',
  }));
  await flushIO(30);
  const responseCountBeforeFiller = messages
    .map((message) => JSON.parse(message) as { type?: string })
    .filter((message) => message.type === 'response.create').length;

  srv.send(JSON.stringify({
    type: 'conversation.item.input_audio_transcription.completed',
    transcript: 'Hello',
  }));
  await flushIO(30);
  const responseCountAfterFiller = messages
    .map((message) => JSON.parse(message) as { type?: string })
    .filter((message) => message.type === 'response.create').length;

  assert.equal(responseCountBeforeFiller, 2);
  assert.equal(responseCountAfterFiller, 2);
  srv.close(1000, 'test complete');
  cleanupBridgeGreetingSessionByCallControlId('cc_parent_filler_lock');
});

test('bridge-gated shop queues booking details while a response is in-flight', async () => {
  initializeBridgeGreetingSession({
    parentCallControlId: 'cc_parent_queue_lock',
    openaiLegCallControlId: 'cc_openai_queue_lock',
  });
  markBridgeReadyForGreeting({
    parentCallControlId: 'cc_parent_queue_lock',
    openaiLegCallControlId: 'cc_openai_queue_lock',
  });

  const serverSocket = nextServerSocket();
  startOpenAiRealtimeSipSideband(
    {
      variant: 'shop',
      callId: 'queue-lock-test',
      apiKey: 'sk-test',
      executeBusinessTool: TOOL_IMPL,
      initialResponseInstructions: 'Hello',
      initialResponseBridgeGate: {
        parentCallControlId: 'cc_parent_queue_lock',
        openaiLegCallControlId: 'cc_openai_queue_lock',
      },
    },
    { wsUrlOverride: sidebandUrl('queue-lock-test'), greetingDelayMs: 0 },
  );

  const srv = await serverSocket;
  const messages: string[] = [];
  srv.on('message', (data) => messages.push(String(data)));
  await flushIO(30);
  srv.send(JSON.stringify({ type: 'output_audio_buffer.started' }));
  srv.send(JSON.stringify({ type: 'output_audio_buffer.stopped' }));
  await flushIO(30);

  srv.send(JSON.stringify({
    type: 'conversation.item.input_audio_transcription.completed',
    transcript: 'I want to book.',
  }));
  await flushIO(30);
  srv.send(JSON.stringify({
    type: 'conversation.item.input_audio_transcription.completed',
    transcript: 'My name is Huy.',
  }));
  await flushIO(30);
  const responseCountBeforeRelease = messages
    .map((message) => JSON.parse(message) as { type?: string })
    .filter((message) => message.type === 'response.create').length;

  srv.send(JSON.stringify({ type: 'response.done' }));
  await flushIO(50);
  const responseCountAfterRelease = messages
    .map((message) => JSON.parse(message) as { type?: string })
    .filter((message) => message.type === 'response.create').length;

  assert.equal(responseCountBeforeRelease, 2);
  assert.equal(responseCountAfterRelease, 3);
  srv.close(1000, 'test complete');
  cleanupBridgeGreetingSessionByCallControlId('cc_parent_queue_lock');
});

// ---------------------------------------------------------------------------
// Helpers for end_call tool tests
// ---------------------------------------------------------------------------

/** JSON the sideband sends when it receives response.function_call_arguments.done */
function makeEndCallEvent(callId = 'tool-call-1') {
  return JSON.stringify({
    type: 'response.function_call_arguments.done',
    name: 'end_call',
    call_id: callId,
    arguments: JSON.stringify({ reason: 'booking_completed' }),
  });
}

function makeBusinessToolEvent(toolName: string, callId: string, args: Record<string, unknown> = {}) {
  return JSON.stringify({
    type: 'response.function_call_arguments.done',
    name: toolName,
    call_id: callId,
    arguments: JSON.stringify(args),
  });
}

function makeAudioStoppedEvent() {
  return JSON.stringify({ type: 'output_audio_buffer.stopped' });
}

// ---------------------------------------------------------------------------
// Test 5: onEndCall fires after end_call tool + output_audio_buffer.stopped
// ---------------------------------------------------------------------------
test('onEndCall fires when AI calls end_call tool then audio buffer stops', async () => {
  const serverSocket = nextServerSocket();

  let endCallFired = false;
  startOpenAiRealtimeSipSideband(
    {
      variant: 'shop',
      callId: 'end-call-audio-test',
      apiKey: 'sk-test',
      executeBusinessTool: TOOL_IMPL,
      onEndCall: () => { endCallFired = true; },
    },
    { wsUrlOverride: sidebandUrl('end-call-audio-test'), greetingDelayMs: 0 },
  );

  const srv = await serverSocket;
  await flushIO(30);

  // Server sends end_call tool event (simulating OpenAI Realtime API)
  srv.send(makeEndCallEvent());
  await flushIO(50);

  assert.equal(endCallFired, false, 'onEndCall must not fire before audio stops');

  // Server sends output_audio_buffer.stopped
  srv.send(makeAudioStoppedEvent());
  await flushIO(50);

  assert.equal(endCallFired, true, 'onEndCall must fire after output_audio_buffer.stopped');

  srv.close(1000);
});

// ---------------------------------------------------------------------------
// Test 6: onEndCall fires via fallback timer if audio-stopped never arrives
// ---------------------------------------------------------------------------
test('onEndCall fires via 5s fallback when output_audio_buffer.stopped never arrives', async (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] });

  const serverSocket = nextServerSocket();

  let endCallFired = false;
  startOpenAiRealtimeSipSideband(
    {
      variant: 'shop',
      callId: 'end-call-fallback-test',
      apiKey: 'sk-test',
      executeBusinessTool: TOOL_IMPL,
      onEndCall: () => { endCallFired = true; },
    },
    { wsUrlOverride: sidebandUrl('end-call-fallback-test'), greetingDelayMs: 0 },
  );

  const srv = await serverSocket;
  await flushIO(30);

  // Server sends end_call — no audio-stopped follows
  srv.send(makeEndCallEvent('tool-call-fb'));
  await flushIO(50);

  assert.equal(endCallFired, false, 'onEndCall must not fire before fallback timer ticks');

  // Advance fake clock past the 5s fallback
  t.mock.timers.tick(5_001);

  assert.equal(endCallFired, true, 'onEndCall must fire after 5s fallback timer');

  srv.close(1000);
  t.mock.timers.reset();
});

test('send_booking_link success uses final instruction and skips generic response.create', async () => {
  const serverSocket = nextServerSocket();
  startOpenAiRealtimeSipSideband(
    {
      variant: 'shop',
      callId: 'booking-link-final-response-test',
      apiKey: 'sk-test',
      executeBusinessTool: async () => JSON.stringify({ success: true, message: 'Booking link sent to +15551234567' }),
    },
    { wsUrlOverride: sidebandUrl('booking-link-final-response-test'), greetingDelayMs: 0 },
  );

  const srv = await serverSocket;
  const messages: string[] = [];
  srv.on('message', (data) => messages.push(String(data)));
  await flushIO(30);
  messages.length = 0;

  srv.send(makeBusinessToolEvent('send_booking_link', 'booking-link-call', { callerName: 'Huy' }));
  await flushIO(80);

  const parsed = messages.map((message) => JSON.parse(message) as {
    type?: string;
    response?: { instructions?: string };
    item?: { type?: string; call_id?: string };
  });
  const toolOutputs = parsed.filter((message) =>
    message.type === 'conversation.item.create' &&
    message.item?.type === 'function_call_output'
  );
  const responses = parsed.filter((message) => message.type === 'response.create');

  assert.equal(toolOutputs.length, 1);
  assert.equal(responses.length, 1, 'generic response.create must not also be sent');
  assert.match(responses[0]?.response?.instructions ?? '', /booking link was sent successfully/i);
  assert.match(responses[0]?.response?.instructions ?? '', /Deliver ONE final message combining confirmation and goodbye/);
  assert.match(responses[0]?.response?.instructions ?? '', /Then call end_call immediately/);
  assert.match(responses[0]?.response?.instructions ?? '', /Do not say 'One moment'/);

  srv.close(1000);
});

test('send_booking_link final audio auto-hangups when model skips end_call', async () => {
  const serverSocket = nextServerSocket();
  let endCallCount = 0;
  startOpenAiRealtimeSipSideband(
    {
      variant: 'shop',
      callId: 'booking-link-auto-hangup-test',
      apiKey: 'sk-test',
      executeBusinessTool: async () => JSON.stringify({ success: true, message: 'Booking link sent to +15551234567' }),
      onEndCall: () => { endCallCount += 1; },
    },
    { wsUrlOverride: sidebandUrl('booking-link-auto-hangup-test'), greetingDelayMs: 0 },
  );

  const srv = await serverSocket;
  await flushIO(30);

  srv.send(makeBusinessToolEvent('send_booking_link', 'booking-link-auto-call', { callerName: 'Huy' }));
  await flushIO(80);
  assert.equal(endCallCount, 0);

  srv.send(makeAudioStoppedEvent());
  await flushIO(50);

  assert.equal(endCallCount, 1);
  srv.close(1000);
});

test('send_booking_link final response does not double hangup when model calls end_call', async () => {
  const serverSocket = nextServerSocket();
  let endCallCount = 0;
  startOpenAiRealtimeSipSideband(
    {
      variant: 'shop',
      callId: 'booking-link-model-end-call-test',
      apiKey: 'sk-test',
      executeBusinessTool: async () => JSON.stringify({ success: true, message: 'Booking link sent to +15551234567' }),
      onEndCall: () => { endCallCount += 1; },
    },
    { wsUrlOverride: sidebandUrl('booking-link-model-end-call-test'), greetingDelayMs: 0 },
  );

  const srv = await serverSocket;
  await flushIO(30);

  srv.send(makeBusinessToolEvent('send_booking_link', 'booking-link-model-call', { callerName: 'Huy' }));
  await flushIO(80);
  srv.send(makeEndCallEvent('end-call-after-link'));
  await flushIO(50);
  assert.equal(endCallCount, 0, 'end_call should wait for final audio stop');

  srv.send(makeAudioStoppedEvent());
  await flushIO(50);
  srv.send(makeAudioStoppedEvent());
  await flushIO(50);

  assert.equal(endCallCount, 1);
  srv.close(1000);
});

test('send_booking_link failure keeps generic response path and no auto-end', async () => {
  const serverSocket = nextServerSocket();
  let endCallCount = 0;
  startOpenAiRealtimeSipSideband(
    {
      variant: 'shop',
      callId: 'booking-link-failure-test',
      apiKey: 'sk-test',
      executeBusinessTool: async () => JSON.stringify({
        success: false,
        reason: 'no_phone',
        fallback: 'url',
        bookingUrl: 'https://example.test/book',
        message: 'Unable to send booking link via SMS.',
      }),
      onEndCall: () => { endCallCount += 1; },
    },
    { wsUrlOverride: sidebandUrl('booking-link-failure-test'), greetingDelayMs: 0 },
  );

  const srv = await serverSocket;
  const messages: string[] = [];
  srv.on('message', (data) => messages.push(String(data)));
  await flushIO(30);
  messages.length = 0;

  srv.send(makeBusinessToolEvent('send_booking_link', 'booking-link-failure-call', { callerName: 'Huy' }));
  await flushIO(80);

  const responses = messages
    .map((message) => JSON.parse(message) as { type?: string; response?: { instructions?: string } })
    .filter((message) => message.type === 'response.create');
  assert.equal(responses.length, 1);
  assert.equal(responses[0]?.response?.instructions, undefined);

  srv.send(makeAudioStoppedEvent());
  await flushIO(50);

  assert.equal(endCallCount, 0);
  srv.close(1000);
});

test('send_booking_link fallback URL success-shaped output does not trigger final auto-end path', async () => {
  const serverSocket = nextServerSocket();
  let endCallCount = 0;
  startOpenAiRealtimeSipSideband(
    {
      variant: 'shop',
      callId: 'booking-link-fallback-success-shaped-test',
      apiKey: 'sk-test',
      executeBusinessTool: async () => JSON.stringify({
        success: true,
        fallback: 'url',
        bookingUrl: 'https://example.test/book',
        message: 'Use the fallback booking URL.',
      }),
      onEndCall: () => { endCallCount += 1; },
    },
    { wsUrlOverride: sidebandUrl('booking-link-fallback-success-shaped-test'), greetingDelayMs: 0 },
  );

  const srv = await serverSocket;
  const messages: string[] = [];
  srv.on('message', (data) => messages.push(String(data)));
  await flushIO(30);
  messages.length = 0;

  srv.send(makeBusinessToolEvent('send_booking_link', 'booking-link-fallback-success-call', { callerName: 'Huy' }));
  await flushIO(80);

  const responses = messages
    .map((message) => JSON.parse(message) as { type?: string; response?: { instructions?: string } })
    .filter((message) => message.type === 'response.create');
  assert.equal(responses.length, 1);
  assert.equal(responses[0]?.response?.instructions, undefined);

  srv.send(makeAudioStoppedEvent());
  await flushIO(50);

  assert.equal(endCallCount, 0);
  srv.close(1000);
});

test('booking-link auto-end and model end_call race hangs up exactly once', async () => {
  const serverSocket = nextServerSocket();
  let endCallCount = 0;
  startOpenAiRealtimeSipSideband(
    {
      variant: 'shop',
      callId: 'booking-link-end-call-race-test',
      apiKey: 'sk-test',
      executeBusinessTool: async () => JSON.stringify({ success: true, message: 'Booking link sent to +15551234567' }),
      onEndCall: () => { endCallCount += 1; },
    },
    { wsUrlOverride: sidebandUrl('booking-link-end-call-race-test'), greetingDelayMs: 0 },
  );

  const srv = await serverSocket;
  await flushIO(30);

  srv.send(makeBusinessToolEvent('send_booking_link', 'booking-link-race-call', { callerName: 'Huy' }));
  await flushIO(80);

  srv.send(makeAudioStoppedEvent());
  srv.send(makeEndCallEvent('end-call-after-auto-link'));
  srv.send(makeAudioStoppedEvent());
  await flushIO(80);

  assert.equal(endCallCount, 1);
  srv.close(1000);
});
