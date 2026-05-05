import test from 'node:test';
import assert from 'node:assert/strict';

import {
  shouldDefaultTranscriptionToVietnamese,
  shouldUseVietnameseFallbackGreeting,
} from '@/src/agent/realtime/livekit-language-policy';

test('missing shopPlan on non-demo dispatch does not default Vietnamese and invokes warn callback', () => {
  let warned = false;
  const v = shouldDefaultTranscriptionToVietnamese({
    callerPhone: '+84901234567',
    destinationPhone: '+15551234567',
    shopPlan: undefined,
    demoIsolated: false,
    onMissingShopPlanProduction: () => {
      warned = true;
    },
  });
  assert.equal(v, false);
  assert.equal(warned, true);
});

test('missing shopPlan on demo isolated dispatch keeps +84 Vietnamese heuristic', () => {
  const v = shouldDefaultTranscriptionToVietnamese({
    callerPhone: '+84901234567',
    destinationPhone: '+15551234567',
    shopPlan: undefined,
    demoIsolated: true,
  });
  assert.equal(v, true);
});

test('starter +84 does not default Vietnamese transcription', () => {
  assert.equal(
    shouldDefaultTranscriptionToVietnamese({
      callerPhone: '+84901234567',
      destinationPhone: '+15551234567',
      shopPlan: 'starter',
      demoIsolated: false,
    }),
    false,
  );
});

test('professional +84 still allows Vietnamese transcription default', () => {
  assert.equal(
    shouldDefaultTranscriptionToVietnamese({
      callerPhone: '+84901234567',
      destinationPhone: '+15551234567',
      shopPlan: 'professional',
      demoIsolated: false,
    }),
    true,
  );
});

test('enterprise US numbers do not match +84 heuristic', () => {
  assert.equal(
    shouldDefaultTranscriptionToVietnamese({
      callerPhone: '+15551234567',
      destinationPhone: '+15559876543',
      shopPlan: 'enterprise',
      demoIsolated: false,
    }),
    false,
  );
});

test('starter ignores Vietnamese greeting env even if transcription would default VI', () => {
  assert.equal(
    shouldUseVietnameseFallbackGreeting({
      shopPlan: 'starter',
      demoIsolated: false,
      greetingLanguageEnv: 'vi',
      transcriptionDefaultsVietnamese: true,
    }),
    false,
  );
});

test('missing shopPlan non-demo ignores Vietnamese greeting env', () => {
  assert.equal(
    shouldUseVietnameseFallbackGreeting({
      shopPlan: undefined,
      demoIsolated: false,
      greetingLanguageEnv: 'vietnamese',
      transcriptionDefaultsVietnamese: false,
    }),
    false,
  );
});

test('demo isolated without shopPlan still allows Vietnamese greeting env', () => {
  assert.equal(
    shouldUseVietnameseFallbackGreeting({
      shopPlan: undefined,
      demoIsolated: true,
      greetingLanguageEnv: 'vi',
      transcriptionDefaultsVietnamese: false,
    }),
    true,
  );
});

test('professional allows Vietnamese greeting from env', () => {
  assert.equal(
    shouldUseVietnameseFallbackGreeting({
      shopPlan: 'professional',
      demoIsolated: false,
      greetingLanguageEnv: 'vi',
      transcriptionDefaultsVietnamese: false,
    }),
    true,
  );
});
