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
  await new Promise<void>((resolve) => wss.close(() => resolve()));
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

  await serverSocket;
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
  srv.close(1000, 'test complete');
  cleanupBridgeGreetingSessionByCallControlId('cc_parent_no_delay');
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
});
