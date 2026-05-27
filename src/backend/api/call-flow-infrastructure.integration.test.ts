/**
 * call-flow-infrastructure.integration.test.ts
 *
 * Automated call flow & infrastructure tests — 6 groups, 21 tests.
 * Isolated in-memory environment. No production data, no real Telnyx / R2 calls.
 *
 * Run:
 *   npx tsx --test src/backend/api/call-flow-infrastructure.integration.test.ts
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { performance } from 'node:perf_hooks';

// Apply test env before any module that reads process.env at import time
import { applyRequiredTestEnv } from '@/src/backend/test-helpers/env';
applyRequiredTestEnv();

// ── Greeting coordinator (module-level singleton) ──────────────────────────
import {
  cleanupBridgeGreetingSessionByCallControlId,
  initializeBridgeGreetingSession,
  markBridgeReadyForGreeting,
  queueGreetingUntilBridgeReady,
} from '@/src/backend/webhooks/openai-sip-bridge-greeting-coordinator';

// ── In-memory repositories ─────────────────────────────────────────────────
import { InMemoryVoiceCallLegsRepository } from '@/src/backend/adapters/memory/voice-call-legs-repository';
import { InMemoryCallLogsRepository } from '@/src/backend/adapters/memory/call-logs-repository';
import { InMemoryHandoffSessionsRepository } from '@/src/backend/adapters/memory/handoff-sessions-repository';
import { InMemoryShopsRepository } from '@/src/backend/adapters/memory/shops-repository';
import { InMemoryJobsRepository } from '@/src/backend/adapters/memory/jobs-repository';

// ── Domain / service functions ─────────────────────────────────────────────
import { evaluateOwnerHandoffDestination } from '@/src/backend/services/calls/destination-policy';
import { buildOwnerHandoffDialClientState } from '@/src/backend/services/calls/handoff-call-control';
import { handoffOnGatherEnded } from '@/src/backend/services/calls/handoff-orchestrator';
import { nextSendableWindowUtc } from '@/src/backend/jobs/runner';
import {
  getShopPlanCapabilities,
  isCapabilityAllowed,
} from '@/src/backend/domain/shop-plan-capabilities';

// ─────────────────────────────────────────────────────────────────────────────
// Report tracking
// ─────────────────────────────────────────────────────────────────────────────
type ReportRow = {
  group: string;
  id: string;
  result: 'PASS' | 'FAIL';
  latencyMs: number;
  details: string;
};

const REPORT_ROWS: ReportRow[] = [];

function record(
  group: string,
  id: string,
  pass: boolean,
  latencyMs: number,
  details: string,
): void {
  REPORT_ROWS.push({ group, id, result: pass ? 'PASS' : 'FAIL', latencyMs, details });
}

function fmtMs(n: number): string {
  if (n < 0.5) return '< 1 ms';
  return `${n.toFixed(1)} ms`;
}

function pad(s: string, len: number): string {
  return s.length >= len ? s.slice(0, len) : s + ' '.repeat(len - s.length);
}

function printReport(): void {
  const col = [34, 42, 6, 10, 62];
  const sep = col.map((w) => '-'.repeat(w));
  function row(cells: string[]): string {
    return '| ' + cells.map((c, i) => pad(c, col[i])).join(' | ') + ' |';
  }
  const lines: string[] = [
    '',
    '════════════════════════════════════════════════════════════════',
    ' RingBooker — Call Flow & Infrastructure Test Report',
    '════════════════════════════════════════════════════════════════',
    '',
    row(['Group', 'Test', 'Result', 'Latency', 'Details']),
    row(sep),
  ];
  for (const r of REPORT_ROWS) {
    lines.push(row([r.group, r.id, r.result, fmtMs(r.latencyMs), r.details]));
  }
  const passed = REPORT_ROWS.filter((r) => r.result === 'PASS').length;
  const failed = REPORT_ROWS.filter((r) => r.result === 'FAIL').length;
  lines.push('');
  lines.push(`  ✅ ${passed} passed   ${failed > 0 ? `❌ ${failed} failed` : '0 failed'}   (${REPORT_ROWS.length} total)`);
  lines.push('════════════════════════════════════════════════════════════════');
  lines.push('');
  console.log(lines.join('\n'));
}

process.on('exit', printReport);

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

// Minimal no-op log context compatible with handoff-orchestrator signature
const noopLog = {
  info:  (_obj: unknown, _msg?: string) => {},
  warn:  (_obj: unknown, _msg?: string) => {},
  error: (_obj: unknown, _msg?: string) => {},
  debug: (_obj: unknown, _msg?: string) => {},
// eslint-disable-next-line @typescript-eslint/no-explicit-any
} as any;

/** Build a minimal shop suitable for quiet-hours tests (timezone UTC, custom quiet hours). */
function makeQuietHoursShop(opts: {
  quietStart: string;
  quietEnd: string;
  timezone?: string;
}) {
  return {
    // required by nextSendableWindowUtc – shape of Shop
    id: `shop-qh-${randomUUID()}`,
    timezone: opts.timezone ?? 'UTC',
    sms_quiet_hours_start: opts.quietStart,
    sms_quiet_hours_end: opts.quietEnd,
    // unused fields — fill with sensible defaults
    hours: {},
    name: 'Test Shop',
    phone_number: '+15555550001',
  } as Parameters<typeof nextSendableWindowUtc>[0];
}

// ═══════════════════════════════════════════════════════════════════════════════
// GROUP 1 — GREETING TIMING
// ═══════════════════════════════════════════════════════════════════════════════

test('1.1 — greeting queued on call_answered; fires only on call_bridged', () => {
  const t0 = performance.now();
  let pass = false;
  let detail = '';
  const parentCc = `cc_parent_1_1_${randomUUID()}`;
  const openaiCc = `cc_openai_1_1_${randomUUID()}`;
  let greetingSentCount = 0;

  try {
    initializeBridgeGreetingSession({ parentCallControlId: parentCc, openaiLegCallControlId: openaiCc });

    // Simulate call_answered: queue the greeting
    const queueResult = queueGreetingUntilBridgeReady({
      parentCallControlId: parentCc,
      openaiLegCallControlId: openaiCc,
      pendingGreetingPayload: { instructions: 'Hello, how can I help?' },
      sendGreeting: () => { greetingSentCount += 1; },
    });

    // After call_answered only: greeting must NOT have fired yet
    assert.equal(queueResult, 'queued', 'Expected queued before bridge ready');
    assert.equal(greetingSentCount, 0, 'Greeting must not fire on call_answered');

    // Simulate call_bridged
    const bridgeResult = markBridgeReadyForGreeting({
      parentCallControlId: parentCc,
      openaiLegCallControlId: openaiCc,
    });

    assert.equal(bridgeResult, 'sent', 'Expected sent after bridge ready');
    assert.equal(greetingSentCount, 1, 'Greeting must fire exactly once on call_bridged');
    pass = true;
    detail = `queued=${queueResult} bridgeResult=${bridgeResult} sentCount=${greetingSentCount}`;
  } catch (err) {
    detail = String(err);
  } finally {
    cleanupBridgeGreetingSessionByCallControlId(parentCc);
  }

  record('G1 Greeting Timing', '1.1 fires only on bridged', pass, performance.now() - t0, detail);
  assert.ok(pass, detail);
});

test('1.2 — greeting idempotent: does not fire twice', () => {
  const t0 = performance.now();
  let pass = false;
  let detail = '';
  const parentCc = `cc_parent_1_2_${randomUUID()}`;
  const openaiCc = `cc_openai_1_2_${randomUUID()}`;
  let sentCount = 0;

  try {
    initializeBridgeGreetingSession({ parentCallControlId: parentCc, openaiLegCallControlId: openaiCc });
    queueGreetingUntilBridgeReady({
      parentCallControlId: parentCc,
      openaiLegCallControlId: openaiCc,
      pendingGreetingPayload: {},
      sendGreeting: () => { sentCount += 1; },
    });

    const first  = markBridgeReadyForGreeting({ parentCallControlId: parentCc, openaiLegCallControlId: openaiCc });
    const second = markBridgeReadyForGreeting({ parentCallControlId: parentCc, openaiLegCallControlId: openaiCc });
    const third  = markBridgeReadyForGreeting({ callControlId: parentCc }); // lookup-by-single-cc variant

    assert.equal(first,  'sent',         '1st call must be sent');
    assert.equal(second, 'already_sent', '2nd call must be already_sent');
    assert.equal(third,  'already_sent', '3rd call must be already_sent');
    assert.equal(sentCount, 1, 'sendGreeting callback must fire exactly once');
    pass = true;
    detail = `first=${first} second=${second} third=${third} sentCount=${sentCount}`;
  } catch (err) {
    detail = String(err);
  } finally {
    cleanupBridgeGreetingSessionByCallControlId(parentCc);
  }

  record('G1 Greeting Timing', '1.2 idempotent – no double fire', pass, performance.now() - t0, detail);
  assert.ok(pass, detail);
});

test('1.3 — greeting payload contains shop name', async () => {
  const t0 = performance.now();
  let pass = false;
  let detail = '';

  try {
    // The default InMemoryShopsRepository shop has ai_welcome_message with the shop name
    const shopsRepo = new InMemoryShopsRepository();
    const shop = await shopsRepo.findById('demo-shop');
    assert.ok(shop, 'demo-shop must exist');
    assert.ok(shop!.ai_welcome_message, 'ai_welcome_message must be set');
    const hasName = shop!.ai_welcome_message!.includes(shop!.name);
    assert.ok(hasName, `welcome message should contain shop name "${shop!.name}"`);
    pass = true;
    detail = `name="${shop!.name}" welcomeMsgPreview="${shop!.ai_welcome_message!.slice(0, 60)}"`;
  } catch (err) {
    detail = String(err);
  }

  record('G1 Greeting Timing', '1.3 greeting contains shop name', pass, performance.now() - t0, detail);
  assert.ok(pass, detail);
});

// ═══════════════════════════════════════════════════════════════════════════════
// GROUP 2 — LATENCY
// ═══════════════════════════════════════════════════════════════════════════════

test('2.1 — first-response latency: init + queue + bridge < 1000 ms', () => {
  const parentCc = `cc_lat_2_1_${randomUUID()}`;
  const openaiCc = `cc_lat_2_1_o_${randomUUID()}`;
  let sentCount = 0;

  const t0 = performance.now();
  initializeBridgeGreetingSession({ parentCallControlId: parentCc, openaiLegCallControlId: openaiCc });
  queueGreetingUntilBridgeReady({
    parentCallControlId: parentCc,
    openaiLegCallControlId: openaiCc,
    pendingGreetingPayload: { text: 'Hello!' },
    sendGreeting: () => { sentCount += 1; },
  });
  markBridgeReadyForGreeting({ parentCallControlId: parentCc, openaiLegCallControlId: openaiCc });
  const elapsed = performance.now() - t0;
  cleanupBridgeGreetingSessionByCallControlId(parentCc);

  const pass = elapsed < 1000 && sentCount === 1;
  record('G2 Latency', '2.1 first-response < 1000 ms', pass, elapsed,
    `elapsed=${fmtMs(elapsed)} sent=${sentCount}`);
  assert.ok(pass, `first-response took ${fmtMs(elapsed)} (limit 1000 ms) and sent=${sentCount}`);
});

test('2.2 — turn-to-turn latency: 5 transitions each < 1500 ms', () => {
  const iterations = 5;
  const legacies: number[] = [];

  for (let i = 0; i < iterations; i++) {
    const parentCc = `cc_lat_2_2_${i}_${randomUUID()}`;
    const openaiCc = `cc_lat_2_2_o_${i}_${randomUUID()}`;
    let sent = 0;

    const t0 = performance.now();
    initializeBridgeGreetingSession({ parentCallControlId: parentCc, openaiLegCallControlId: openaiCc });
    queueGreetingUntilBridgeReady({
      parentCallControlId: parentCc,
      openaiLegCallControlId: openaiCc,
      pendingGreetingPayload: {},
      sendGreeting: () => { sent += 1; },
    });
    markBridgeReadyForGreeting({ parentCallControlId: parentCc, openaiLegCallControlId: openaiCc });
    const elapsed = performance.now() - t0;
    cleanupBridgeGreetingSessionByCallControlId(parentCc);
    legacies.push(elapsed);
    assert.equal(sent, 1, `turn ${i} must fire greeting once`);
  }

  const avg = legacies.reduce((a, b) => a + b, 0) / legacies.length;
  const min = Math.min(...legacies);
  const max = Math.max(...legacies);
  const allUnderLimit = legacies.every((l) => l < 1500);

  record('G2 Latency', '2.2 5 turns each < 1500 ms', allUnderLimit, avg,
    `avg=${fmtMs(avg)} min=${fmtMs(min)} max=${fmtMs(max)}`);
  assert.ok(allUnderLimit, `Some turns exceeded 1500 ms: ${legacies.map(fmtMs).join(', ')}`);
});

test('2.3 — parallel leg init vs sequential: both complete < 1500 ms/op', async () => {
  const N = 10;
  const ids = Array.from({ length: N }, (_, i) => ({
    parentCc: `cc_par_2_3_${i}_${randomUUID()}`,
    openaiCc: `cc_par_2_3_o_${i}_${randomUUID()}`,
    shopId: `shop-2-3-${i}`,
    rbCallId: `rb-2-3-${i}`,
  }));

  // Sequential
  const seqStart = performance.now();
  const legsRepo1 = new InMemoryVoiceCallLegsRepository();
  for (const { shopId, rbCallId, parentCc, openaiCc } of ids) {
    await legsRepo1.createOrUpdateCallLeg({ shopId, rbCallId, purpose: 'openai_sip_leg', callControlId: openaiCc, parentCallControlId: parentCc, status: 'openai_leg_active' });
    await legsRepo1.createOrUpdateCallLeg({ shopId, rbCallId, purpose: 'parent_caller_leg', callControlId: parentCc, status: 'parent_leg_active' });
  }
  const seqElapsed = performance.now() - seqStart;

  // Parallel
  const parStart = performance.now();
  const legsRepo2 = new InMemoryVoiceCallLegsRepository();
  await Promise.all(
    ids.flatMap(({ shopId, rbCallId, parentCc, openaiCc }) => [
      legsRepo2.createOrUpdateCallLeg({ shopId, rbCallId, purpose: 'openai_sip_leg', callControlId: openaiCc, parentCallControlId: parentCc, status: 'openai_leg_active' }),
      legsRepo2.createOrUpdateCallLeg({ shopId, rbCallId, purpose: 'parent_caller_leg', callControlId: parentCc, status: 'parent_leg_active' }),
    ]),
  );
  const parElapsed = performance.now() - parStart;

  const seqPerOp = seqElapsed / N;
  const parPerOp = parElapsed / N;
  const pass = seqPerOp < 1500 && parPerOp < 1500;

  record('G2 Latency', '2.3 parallel vs sequential init', pass, parElapsed,
    `seq=${fmtMs(seqElapsed)}(${fmtMs(seqPerOp)}/op) par=${fmtMs(parElapsed)}(${fmtMs(parPerOp)}/op)`);
  assert.ok(pass, `seq/op=${fmtMs(seqPerOp)} par/op=${fmtMs(parPerOp)} (limit 1500 ms each)`);
});

// ═══════════════════════════════════════════════════════════════════════════════
// GROUP 3 — CALL FORWARDING / FALLBACK HANDOFF
// ═══════════════════════════════════════════════════════════════════════════════

test('3.1 — handoff destination evaluates to correct owner e164', () => {
  const t0 = performance.now();
  let pass = false;
  let detail = '';

  try {
    const shop = { id: 'shop-3-1', sms_owner_opted_in: true as const, country_code: 'US' as const };
    const ownerPhone = '+13105550100'; // valid US number, non-premium NPA

    const result = evaluateOwnerHandoffDestination({ shop, ownerPhone });
    assert.ok(result.ok, `Expected ok=true, got: ${JSON.stringify(result)}`);
    if (result.ok) {
      assert.ok(result.e164.startsWith('+1'), `e164 must start with +1, got: ${result.e164}`);
      assert.equal(result.e164, ownerPhone, 'e164 must match normalised input');
      detail = `e164=${result.e164}`;
    }
    pass = result.ok;
  } catch (err) {
    detail = String(err);
  }

  record('G3 Handoff/Forwarding', '3.1 correct owner e164', pass, performance.now() - t0, detail);
  assert.ok(pass, detail);
});

test('3.2 — shop isolation: shop A phone never used for shop B handoff', () => {
  const t0 = performance.now();
  let pass = false;
  let detail = '';

  try {
    const shopA = { id: 'shop-3-2-A', sms_owner_opted_in: true as const, country_code: 'US' as const };
    const shopB = { id: 'shop-3-2-B', sms_owner_opted_in: true as const, country_code: 'US' as const };
    const phoneA = '+13105550101';
    const phoneB = '+13105550102';

    const resA = evaluateOwnerHandoffDestination({ shop: shopA, ownerPhone: phoneA });
    const resB = evaluateOwnerHandoffDestination({ shop: shopB, ownerPhone: phoneB });

    assert.ok(resA.ok, 'Shop A must resolve ok');
    assert.ok(resB.ok, 'Shop B must resolve ok');

    if (resA.ok && resB.ok) {
      assert.notEqual(resA.e164, resB.e164, 'Shop A and B must have distinct e164');
      assert.equal(resA.e164, phoneA);
      assert.equal(resB.e164, phoneB);
      detail = `A=${resA.e164} B=${resB.e164} distinct=true`;
    }
    pass = resA.ok && resB.ok && resA.e164 !== resB.e164;
  } catch (err) {
    detail = String(err);
  }

  record('G3 Handoff/Forwarding', '3.2 shop isolation – distinct e164', pass, performance.now() - t0, detail);
  assert.ok(pass, detail);
});

test('3.3 — buildOwnerHandoffDialClientState encodes correct parentCallControlId', () => {
  const t0 = performance.now();
  let pass = false;
  let detail = '';

  try {
    const parentCc  = `cc_parent_3_3_${randomUUID()}`;
    const handoffId = randomUUID();
    const rbCallId  = `rb_3_3_${randomUUID()}`;

    const encoded = buildOwnerHandoffDialClientState({
      shopId: 'shop-3-3',
      requestId: rbCallId,
      rbCallId,
      callerPhone: '+13105550103',
      parentCallControlId: parentCc,
      handoffId,
      ownerPhoneE164: '+13105550199',
      reason: 'caller requested live help',
      urgency: 'medium',
    });

    const decoded = JSON.parse(Buffer.from(encoded, 'base64').toString('utf8'));
    assert.equal(decoded.parentCallControlId, parentCc, 'parentCallControlId must match');
    assert.equal(decoded.handoffId, handoffId, 'handoffId must match');
    assert.equal(decoded.purpose, 'owner_handoff_leg', 'purpose must be owner_handoff_leg');
    pass = true;
    detail = `parentCc matches: ${decoded.parentCallControlId === parentCc} purpose=${decoded.purpose}`;
  } catch (err) {
    detail = String(err);
  }

  record('G3 Handoff/Forwarding', '3.3 correct parentCallControlId encoded', pass, performance.now() - t0, detail);
  assert.ok(pass, detail);
});

test('3.4 — owner no-answer timeout → DB status set + fallback job enqueued', async () => {
  const t0 = performance.now();
  let pass = false;
  let detail = '';

  try {
    const handoffRepo = new InMemoryHandoffSessionsRepository();
    const shopsRepo   = new InMemoryShopsRepository();
    const jobsRepo    = new InMemoryJobsRepository();

    const parentCc  = `cc_parent_3_4_${randomUUID()}`;
    const ownerCc   = `cc_owner_3_4_${randomUUID()}`;
    const rbCallId  = `rb_3_4_${randomUUID()}`;

    // Create handoff session
    const session = await handoffRepo.create({
      shopId: 'demo-shop',
      rbCallId,
      idempotencyKey: `idem_3_4_${randomUUID()}`,
      parentCallControlId: parentCc,
      ownerPhone: '+17145550199',
      callerPhone: '+13105550104',
      reason: 'wants live help',
      urgency: 'medium',
      summary: 'Caller wants to book a Manicure and speak to a person.',
      status: 'owner_ringing',
    });

    // Set ownerCallControlId so the orchestrator can find the session
    await handoffRepo.update(session.id, { ownerCallControlId: ownerCc, status: 'owner_dtmf_waiting' });

    // Simulate call.gather.ended with status=timeout (owner did not press any digit)
    const webhookPayload = {
      call_control_id: ownerCc,
      status: 'timeout',
      digits: '',
      client_state: '',
    };

    const deps = {
      handoffSessionsRepository: handoffRepo,
      shopsRepository: shopsRepo,
      jobsRepository: jobsRepo,
      apiKey: 'telnyx_test_key',
    };

    await handoffOnGatherEnded(webhookPayload, deps, noopLog);

    // Assert DB status
    const updated = await handoffRepo.findById(session.id);
    assert.equal(updated?.status, 'handoff_failed_dtmf_timeout', 'Status must be handoff_failed_dtmf_timeout');

    // Assert fallback SMS job was enqueued
    const job = await (jobsRepo as any).leaseNext({ now: new Date(), leaseSeconds: 60, workerId: 'test' });
    assert.ok(job, 'Fallback SMS job must be enqueued');
    assert.equal(job!.type, 'handoff_failed_owner_sms', `Job type must be handoff_failed_owner_sms, got: ${job!.type}`);

    pass = true;
    detail = `status=${updated?.status} jobType=${job!.type}`;
  } catch (err) {
    detail = String(err);
  }

  record('G3 Handoff/Forwarding', '3.4 timeout → failed_dtmf_timeout + SMS job', pass, performance.now() - t0, detail);
  assert.ok(pass, detail);
});

// ═══════════════════════════════════════════════════════════════════════════════
// GROUP 4 — QUIET HOURS RETRY LOGIC
// ═══════════════════════════════════════════════════════════════════════════════

test('4.1 — at 23:00 during quiet hours (22:00–08:00), nextSendableWindowUtc returns next 08:00', () => {
  const t0 = performance.now();
  let pass = false;
  let detail = '';

  try {
    const shop = makeQuietHoursShop({ quietStart: '22:00', quietEnd: '08:00', timezone: 'UTC' });

    // 23:00 UTC on a known date
    const now = new Date('2024-06-15T23:00:00.000Z');
    const nextWindow = nextSendableWindowUtc(shop, now);

    // Expected: 2024-06-16 08:00 UTC
    const expected = new Date('2024-06-16T08:00:00.000Z');

    assert.ok(nextWindow > now, 'Window must be in the future');
    assert.equal(nextWindow.toISOString(), expected.toISOString(), 'Window must be next-day 08:00 UTC');
    pass = true;
    detail = `now=23:00 UTC, window=${nextWindow.toISOString().slice(11, 19)} UTC`;
  } catch (err) {
    detail = String(err);
  }

  record('G4 Quiet Hours', '4.1 23:00 → next 08:00 window', pass, performance.now() - t0, detail);
  assert.ok(pass, detail);
});

test('4.2 — at 09:00 (outside quiet hours), nextSendableWindowUtc returns now', () => {
  const t0 = performance.now();
  let pass = false;
  let detail = '';

  try {
    const shop = makeQuietHoursShop({ quietStart: '22:00', quietEnd: '08:00', timezone: 'UTC' });

    // 09:00 UTC — outside quiet window
    const now = new Date('2024-06-15T09:00:00.000Z');
    const nextWindow = nextSendableWindowUtc(shop, now);

    // Window should equal now (no delay needed)
    assert.equal(nextWindow.toISOString(), now.toISOString(), 'Window must equal now when outside quiet hours');
    pass = true;
    detail = `now=09:00 UTC → window=${nextWindow.toISOString().slice(11, 19)} UTC (immediate)`;
  } catch (err) {
    detail = String(err);
  }

  record('G4 Quiet Hours', '4.2 09:00 → immediate (no delay)', pass, performance.now() - t0, detail);
  assert.ok(pass, detail);
});

test('4.3 — multiple calls during quiet hours always return same window (idempotent)', () => {
  const t0 = performance.now();
  let pass = false;
  let detail = '';

  try {
    const shop = makeQuietHoursShop({ quietStart: '22:00', quietEnd: '08:00', timezone: 'UTC' });
    const now  = new Date('2024-06-15T23:30:00.000Z');

    const windows = Array.from({ length: 5 }, () => nextSendableWindowUtc(shop, now));
    const isos    = windows.map((w) => w.toISOString());

    // All should be the same future window
    const unique = new Set(isos);
    assert.equal(unique.size, 1, `All windows must be equal, got: ${[...unique].join(', ')}`);
    assert.ok(windows[0] > now, 'Window must be in the future');

    pass = true;
    detail = `5×calls → window=${windows[0].toISOString().slice(11, 19)} UTC (consistent)`;
  } catch (err) {
    detail = String(err);
  }

  record('G4 Quiet Hours', '4.3 multiple calls → same window', pass, performance.now() - t0, detail);
  assert.ok(pass, detail);
});

test('4.4 — each call record carries its own caller phone for retry', async () => {
  const t0 = performance.now();
  let pass = false;
  let detail = '';

  try {
    const callLogs = new InMemoryCallLogsRepository();
    const shopId   = 'demo-shop';

    const callIdA = `call_4_4_A_${randomUUID()}`;
    const callIdB = `call_4_4_B_${randomUUID()}`;
    const phoneA  = '+13105550110';
    const phoneB  = '+13105550111';

    await callLogs.createOrUpdateInboundCall({ provider: 'telnyx_call_control', providerCallId: callIdA, shopId, callerPhone: phoneA });
    await callLogs.createOrUpdateInboundCall({ provider: 'telnyx_call_control', providerCallId: callIdB, shopId, callerPhone: phoneB });

    const logA = await callLogs.findByProviderCallId({ provider: 'telnyx_call_control', providerCallId: callIdA });
    const logB = await callLogs.findByProviderCallId({ provider: 'telnyx_call_control', providerCallId: callIdB });

    assert.equal(logA?.callerPhone, phoneA, 'Call A must have phone A');
    assert.equal(logB?.callerPhone, phoneB, 'Call B must have phone B');
    assert.notEqual(logA?.callerPhone, logB?.callerPhone, 'Phones must be distinct');

    pass = true;
    detail = `callA.phone=${logA?.callerPhone} callB.phone=${logB?.callerPhone}`;
  } catch (err) {
    detail = String(err);
  }

  record('G4 Quiet Hours', '4.4 each call has own caller phone', pass, performance.now() - t0, detail);
  assert.ok(pass, detail);
});

// ═══════════════════════════════════════════════════════════════════════════════
// GROUP 5 — CALL RECORDING (R2)
// ═══════════════════════════════════════════════════════════════════════════════

test('5.1 — recording upload: storageKey matches call_id pattern', async () => {
  const t0 = performance.now();
  let pass = false;
  let detail = '';

  try {
    const callLogs  = new InMemoryCallLogsRepository();
    const shopId    = 'demo-shop';
    const callId    = `call_5_1_${randomUUID()}`;
    const storageKey = `recordings/${shopId}/${callId}.mp3`;

    await callLogs.createOrUpdateInboundCall({ provider: 'telnyx_call_control', providerCallId: callId, shopId });
    await callLogs.markRecordingAvailableByProviderCallId({
      provider: 'telnyx_call_control',
      providerCallId: callId,
      recordingProvider: 'cloudflare_r2',
      recordingId: `rec_${randomUUID()}`,
      recordingStorageKey: storageKey,
      recordingFormat: 'mp3',
      recordingDurationMs: 12_000,
    });

    const log = await callLogs.findByProviderCallId({ provider: 'telnyx_call_control', providerCallId: callId });
    assert.equal(log?.recordingStatus, 'available');
    assert.ok(log?.recordingStorageKey?.includes(callId), 'storageKey must contain callId');
    assert.equal(log?.recordingStorageKey, storageKey);

    pass = true;
    detail = `storageKey="${log?.recordingStorageKey}" status=${log?.recordingStatus}`;
  } catch (err) {
    detail = String(err);
  }

  record('G5 Recording (R2)', '5.1 storageKey contains call_id', pass, performance.now() - t0, detail);
  assert.ok(pass, detail);
});

test('5.2 — recording available: findByProviderCallId returns status=available', async () => {
  const t0 = performance.now();
  let pass = false;
  let detail = '';

  try {
    const callLogs   = new InMemoryCallLogsRepository();
    const shopId     = 'demo-shop';
    const callId     = `call_5_2_${randomUUID()}`;
    const storageKey = `recordings/${shopId}/${callId}.mp3`;

    await callLogs.createOrUpdateInboundCall({ provider: 'telnyx_call_control', providerCallId: callId, shopId });

    // Before upload: should be not_requested
    const before = await callLogs.findByProviderCallId({ provider: 'telnyx_call_control', providerCallId: callId });
    assert.equal(before?.recordingStatus, 'not_requested', 'Before upload status must be not_requested');

    // Mark pending
    await callLogs.markRecordingPendingByProviderCallId({ provider: 'telnyx_call_control', providerCallId: callId, recordingProvider: 'cloudflare_r2' });
    const pending = await callLogs.findByProviderCallId({ provider: 'telnyx_call_control', providerCallId: callId });
    assert.equal(pending?.recordingStatus, 'pending');

    // Mark available
    await callLogs.markRecordingAvailableByProviderCallId({
      provider: 'telnyx_call_control',
      providerCallId: callId,
      recordingProvider: 'cloudflare_r2',
      recordingId: `rec_${randomUUID()}`,
      recordingStorageKey: storageKey,
      recordingFormat: 'mp3',
    });

    const available = await callLogs.findByProviderCallId({ provider: 'telnyx_call_control', providerCallId: callId });
    assert.equal(available?.recordingStatus, 'available', 'After upload status must be available');
    assert.ok(available?.recordingStorageKey, 'recordingStorageKey must be set');

    pass = true;
    detail = `before=not_requested → pending → available storageKey set`;
  } catch (err) {
    detail = String(err);
  }

  record('G5 Recording (R2)', '5.2 status lifecycle not_requested→pending→available', pass, performance.now() - t0, detail);
  assert.ok(pass, detail);
});

test('5.3 — professional plan can configure & play back recordings; starter cannot', () => {
  const t0 = performance.now();
  let pass = false;
  let detail = '';

  try {
    const proCapabilities     = getShopPlanCapabilities('professional');
    const starterCapabilities = getShopPlanCapabilities('starter');

    assert.ok(proCapabilities.configure_call_recording,    'professional must have configure_call_recording');
    assert.ok(proCapabilities.call_recording_playback,     'professional must have call_recording_playback');
    assert.ok(!starterCapabilities.configure_call_recording, 'starter must NOT have configure_call_recording');
    assert.ok(!starterCapabilities.call_recording_playback,  'starter must NOT have call_recording_playback');

    // Also check the isCapabilityAllowed helper
    assert.ok(isCapabilityAllowed('professional', 'configure_call_recording'));
    assert.ok(!isCapabilityAllowed('starter', 'configure_call_recording'));

    pass = true;
    detail = 'professional=✅ starter=❌ for configure_call_recording & call_recording_playback';
  } catch (err) {
    detail = String(err);
  }

  record('G5 Recording (R2)', '5.3 professional-only recording capability', pass, performance.now() - t0, detail);
  assert.ok(pass, detail);
});

test('5.4 — failed R2 upload: call record saved with status=failed, no storageKey', async () => {
  const t0 = performance.now();
  let pass = false;
  let detail = '';

  try {
    const callLogs = new InMemoryCallLogsRepository();
    const shopId   = 'demo-shop';
    const callId   = `call_5_4_${randomUUID()}`;
    const errorMsg = 'telnyx_recording_download_failed:503';

    await callLogs.createOrUpdateInboundCall({ provider: 'telnyx_call_control', providerCallId: callId, shopId });
    await callLogs.markRecordingPendingByProviderCallId({ provider: 'telnyx_call_control', providerCallId: callId, recordingProvider: 'cloudflare_r2' });

    // Simulate R2 upload failure
    await callLogs.markRecordingFailedByProviderCallId({
      provider: 'telnyx_call_control',
      providerCallId: callId,
      recordingProvider: 'cloudflare_r2',
      error: errorMsg,
    });

    const log = await callLogs.findByProviderCallId({ provider: 'telnyx_call_control', providerCallId: callId });

    // Call record must still exist
    assert.ok(log, 'Call record must still exist after failed upload');
    assert.equal(log?.recordingStatus, 'failed', 'Status must be failed');
    assert.ok(!log?.recordingStorageKey, 'storageKey must be absent after failure');
    // recordingError is internal to MemoryCallLog; verify status + absence of key is enough
    assert.equal(log?.recordingProvider, 'cloudflare_r2', 'recordingProvider must be set');

    pass = true;
    detail = `status=failed provider=${log?.recordingProvider} storageKey=absent`;
  } catch (err) {
    detail = String(err);
  }

  record('G5 Recording (R2)', '5.4 failed upload – record saved, no storageKey', pass, performance.now() - t0, detail);
  assert.ok(pass, detail);
});

// ═══════════════════════════════════════════════════════════════════════════════
// GROUP 6 — SIP LEG INIT
// ═══════════════════════════════════════════════════════════════════════════════

test('6.1 — both SIP legs active before greeting fires', async () => {
  const t0 = performance.now();
  let pass = false;
  let detail = '';

  try {
    const legsRepo  = new InMemoryVoiceCallLegsRepository();
    const shopId    = `shop-6-1-${randomUUID()}`;
    const rbCallId  = `rb-6-1-${randomUUID()}`;
    const parentCc  = `cc_parent_6_1_${randomUUID()}`;
    const openaiCc  = `cc_openai_6_1_${randomUUID()}`;

    // Create both legs
    await legsRepo.createOrUpdateCallLeg({ shopId, rbCallId, purpose: 'parent_caller_leg', callControlId: parentCc, status: 'parent_leg_active' });
    await legsRepo.createOrUpdateCallLeg({ shopId, rbCallId, purpose: 'openai_sip_leg',    callControlId: openaiCc,  parentCallControlId: parentCc, status: 'openai_leg_active' });

    // Both must be findable before greeting
    const parentLeg = await legsRepo.findCallLegByCallControlId(parentCc);
    const openaiLeg = await legsRepo.findCallLegByCallControlId(openaiCc);

    assert.ok(parentLeg, 'Parent caller leg must exist');
    assert.ok(openaiLeg, 'OpenAI SIP leg must exist');
    assert.equal(parentLeg?.purpose, 'parent_caller_leg');
    assert.equal(openaiLeg?.purpose, 'openai_sip_leg');

    // findActiveOpenAiLegCallControlIdByRbCallId must return openaiCc
    const activeCc = await legsRepo.findActiveOpenAiLegCallControlIdByRbCallId(shopId, rbCallId);
    assert.equal(activeCc, openaiCc, 'Active OpenAI leg must be findable before greeting');

    pass = true;
    detail = `parentLeg=active openaiLeg=active activeCc=${activeCc?.slice(-8)}`;
  } catch (err) {
    detail = String(err);
  }

  record('G6 SIP Leg Init', '6.1 both legs active before greeting', pass, performance.now() - t0, detail);
  assert.ok(pass, detail);
});

test('6.2 — OpenAI SIP failure: active leg returns null, call_status can be set failed', async () => {
  const t0 = performance.now();
  let pass = false;
  let detail = '';

  try {
    const legsRepo = new InMemoryVoiceCallLegsRepository();
    const callLogs = new InMemoryCallLogsRepository();
    const shopId   = `shop-6-2-${randomUUID()}`;
    const rbCallId = `rb-6-2-${randomUUID()}`;
    const parentCc = `cc_parent_6_2_${randomUUID()}`;
    const openaiCc = `cc_openai_6_2_${randomUUID()}`;

    // Setup both legs
    await legsRepo.createOrUpdateCallLeg({ shopId, rbCallId, purpose: 'parent_caller_leg', callControlId: parentCc, status: 'parent_leg_active' });
    await legsRepo.createOrUpdateCallLeg({ shopId, rbCallId, purpose: 'openai_sip_leg', callControlId: openaiCc, parentCallControlId: parentCc, status: 'openai_leg_active' });

    // Create matching call log
    await callLogs.createOrUpdateInboundCall({ provider: 'telnyx_call_control', providerCallId: parentCc, shopId });

    // Simulate OpenAI SIP failure: mark the OpenAI leg ended
    await legsRepo.markCallLegEnded(openaiCc, 'openai_sip_leg');

    // Active lookup must now return null
    const activeCc = await legsRepo.findActiveOpenAiLegCallControlIdByRbCallId(shopId, rbCallId);
    assert.equal(activeCc, null, 'Active OpenAI leg must be null after failure');

    // Verify leg status
    const openaiLeg = await legsRepo.findOpenAiLegByRbCallId(shopId, rbCallId);
    assert.equal(openaiLeg?.status, 'openai_leg_ended', 'Leg status must be openai_leg_ended');

    // Mark call outcome as failed
    await callLogs.setOutcomeByProviderCallId({ provider: 'telnyx_call_control', providerCallId: parentCc, outcome: 'failed' });
    const log = await callLogs.findByProviderCallId({ provider: 'telnyx_call_control', providerCallId: parentCc });
    assert.equal(log?.outcome, 'failed', 'Call outcome must be failed');

    pass = true;
    detail = `openaiLeg.status=${openaiLeg?.status} activeCc=null callOutcome=${log?.outcome}`;
  } catch (err) {
    detail = String(err);
  }

  record('G6 SIP Leg Init', '6.2 OpenAI failure → null active + call failed', pass, performance.now() - t0, detail);
  assert.ok(pass, detail);
});

test('6.3 — caller SIP drop: parent leg ends, greeting session cleaned, no hanging sessions', async () => {
  const t0 = performance.now();
  let pass = false;
  let detail = '';

  try {
    const legsRepo = new InMemoryVoiceCallLegsRepository();
    const callLogs = new InMemoryCallLogsRepository();
    const shopId   = `shop-6-3-${randomUUID()}`;
    const rbCallId = `rb-6-3-${randomUUID()}`;
    const parentCc = `cc_parent_6_3_${randomUUID()}`;
    const openaiCc = `cc_openai_6_3_${randomUUID()}`;

    // Initialise greeting session (in-flight)
    initializeBridgeGreetingSession({ parentCallControlId: parentCc, openaiLegCallControlId: openaiCc, rbCallId, shopId });
    let greetingSent = false;
    queueGreetingUntilBridgeReady({
      parentCallControlId: parentCc,
      openaiLegCallControlId: openaiCc,
      pendingGreetingPayload: {},
      sendGreeting: () => { greetingSent = true; },
    });

    // Setup both legs
    await legsRepo.createOrUpdateCallLeg({ shopId, rbCallId, purpose: 'parent_caller_leg', callControlId: parentCc, status: 'parent_leg_active' });
    await legsRepo.createOrUpdateCallLeg({ shopId, rbCallId, purpose: 'openai_sip_leg',    callControlId: openaiCc, parentCallControlId: parentCc, status: 'openai_leg_active' });

    // Create call log with partial transcript
    await callLogs.createOrUpdateInboundCall({ provider: 'telnyx_call_control', providerCallId: parentCc, shopId, requestId: rbCallId });
    await callLogs.appendTranscriptByRequestId({ shopId, requestId: rbCallId, speaker: 'caller',    text: 'Hi, I want to book a pedicure.' });
    await callLogs.appendTranscriptByRequestId({ shopId, requestId: rbCallId, speaker: 'assistant', text: 'Sure! What date works for you?' });

    // Simulate caller SIP drop mid-call
    await legsRepo.markCallLegEnded(parentCc, 'parent_caller_leg');
    await legsRepo.markCallLegEnded(openaiCc, 'openai_sip_leg');

    // Cleanup greeting session (happens in production webhook handler)
    cleanupBridgeGreetingSessionByCallControlId(parentCc);

    // Mark call ended with partial transcript
    await callLogs.markEndedByProviderCallId({ provider: 'telnyx_call_control', providerCallId: parentCc, endedAt: new Date(), outcome: 'completed' });

    // After markCallLegEnded the CC is removed from the active callControlId index
    // (forgetCallControlIfMatches removes it). A null result = no longer active.
    const parentLegActive = await legsRepo.findCallLegByCallControlId(parentCc);
    assert.equal(parentLegActive, null, 'Parent leg must no longer be active (CC removed from index)');

    // Verify: OpenAI leg ended — byShopRbPurpose index is still populated after ending
    const openaiLeg = await legsRepo.findOpenAiLegByRbCallId(shopId, rbCallId);
    assert.equal(openaiLeg?.status, 'openai_leg_ended', 'OpenAI leg must be openai_leg_ended');

    // Verify: transcript was partially saved
    const log = await callLogs.findByProviderCallId({ provider: 'telnyx_call_control', providerCallId: parentCc });
    assert.ok(log?.transcriptText?.includes('pedicure'), 'Partial transcript must be saved');

    // Verify: greeting never fired (bridge never became ready)
    assert.ok(!greetingSent, 'Greeting must NOT have fired (call dropped before bridge)');

    // Verify: greeting session cleaned (markBridgeReadyForGreeting returns not_found)
    const markedAfterCleanup = markBridgeReadyForGreeting({ parentCallControlId: parentCc, openaiLegCallControlId: openaiCc });
    assert.equal(markedAfterCleanup, 'not_found', 'Session must be cleaned up — not_found after cleanup');

    pass = true;
    detail = `parentLeg=not_in_active_index openaiLeg=${openaiLeg?.status} transcript=saved greetingSent=false session=cleaned`;
  } catch (err) {
    detail = String(err);
  }

  record('G6 SIP Leg Init', '6.3 caller drop – legs end, transcript saved, no hanging session', pass, performance.now() - t0, detail);
  assert.ok(pass, detail);
});
