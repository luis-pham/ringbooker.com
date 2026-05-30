import test from 'node:test';
import assert from 'node:assert/strict';

import {
  createBookingDraft,
  deriveBookingDraftReasonCodes,
  normalizeSpokenDigits,
  updateBookingDraftFromTranscript,
} from '@/src/agent/booking/booking-draft';

const NOW = new Date('2026-05-28T12:00:00.000Z');
const CALLER_ID = '+15550001111';

test('accumulates booking slots from Vietnamese-accent English booking request', () => {
  const draft = updateBookingDraftFromTranscript(
    createBookingDraft(NOW),
    'Hi, I want to book color tomorrow at nine AM.',
    { now: NOW, callerPhone: CALLER_ID },
  );

  assert.equal(draft.intent, 'book_appointment');
  assert.equal(draft.intentSource, 'transcript');
  assert.deepEqual(draft.serviceCandidates, ['color']);
  assert.deepEqual(draft.dateCandidates, ['tomorrow']);
  assert.deepEqual(draft.timeCandidates, ['9 AM']);
  assert.ok((draft.confidence.intent ?? 0) >= 0.8);
  assert.ok((draft.confidence.time ?? 0) >= 0.75);
  assert.equal(draft.missingFields.includes('phone'), false);
  assert.ok(draft.missingFields.includes('callerName'));
});

test('marks phone missing when caller ID is unavailable', () => {
  const draft = updateBookingDraftFromTranscript(
    createBookingDraft(NOW),
    'Hi, I want to book color tomorrow at nine AM.',
    { now: NOW, callerPhone: null },
  );

  assert.ok(draft.missingFields.includes('phone'));
});

test('accumulates slowly spoken phone digits across multiple caller turns', () => {
  let draft = updateBookingDraftFromTranscript(
    createBookingDraft(NOW),
    'I want to book color tomorrow at nine AM. My number is five one two.',
    { now: NOW, callerPhone: null },
  );
  draft = updateBookingDraftFromTranscript(draft, 'three four five', { now: NOW, callerPhone: null });
  draft = updateBookingDraftFromTranscript(draft, 'six seven eight nine', { now: NOW, callerPhone: null });

  assert.equal(draft.phoneDigits.join(''), '5123456789');
  assert.equal(draft.phoneCaptureActive, false);
  assert.equal(draft.callerRequestedNewPhone, true);
  assert.equal(draft.confidence.phone, 0.85);
  assert.equal(draft.missingFields.includes('phone'), false);
});

test('does not treat filler words as phone digits', () => {
  assert.deepEqual(normalizeSpokenDigits('uh, maybe yes'), []);

  const draft = updateBookingDraftFromTranscript(createBookingDraft(NOW), 'uh, maybe yes', { now: NOW, callerPhone: CALLER_ID });
  assert.deepEqual(draft.phoneDigits, []);
  assert.equal(draft.intent, 'unknown');
});

test('keeps accent/noisy time as low-confidence evidence instead of a confirmed time', () => {
  let draft = updateBookingDraftFromTranscript(createBookingDraft(NOW), 'I want to book color tomorrow', { now: NOW, callerPhone: CALLER_ID });
  const before = draft;

  draft = updateBookingDraftFromTranscript(draft, 'now I am', { now: NOW, callerPhone: CALLER_ID });

  assert.deepEqual(draft.timeCandidates, ['9 AM']);
  assert.ok((draft.confidence.time ?? 0) < 0.55);
  assert.ok(draft.missingFields.includes('time'));
  assert.deepEqual(deriveBookingDraftReasonCodes(before, draft), [
    'time_candidate_accumulated',
    'time_candidate_low_confidence',
  ]);
});

test('normalizes numeric phone formatting without duplicating digits', () => {
  const draft = updateBookingDraftFromTranscript(
    createBookingDraft(NOW),
    'My phone number is plus one, seven one four, five five five, zero one two three.',
    { now: NOW, callerPhone: null },
  );

  assert.equal(draft.phoneDigits.join(''), '17145550123');
  assert.equal(draft.confidence.phone, 0.85);
  assert.equal(draft.missingFields.includes('phone'), false);
});
