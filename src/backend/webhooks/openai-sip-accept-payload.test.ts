import test from 'node:test';
import assert from 'node:assert/strict';

import { getSipShopToolsForOpenAiAccept } from '@/src/agent/sip/sip-tool-definitions';
import { buildOpenAiSipAcceptAudioInputFromEnv, buildOpenAiSipAcceptBody } from '@/src/backend/webhooks/openai-sip-accept-payload';

function withEnv(updates: Record<string, string | undefined>, fn: () => void) {
  const prev: Record<string, string | undefined> = {};
  for (const key of Object.keys(updates)) {
    prev[key] = process.env[key];
    const v = updates[key];
    if (v === undefined) delete process.env[key];
    else process.env[key] = v;
  }
  try {
    fn();
  } finally {
    for (const key of Object.keys(updates)) {
      const old = prev[key];
      if (old === undefined) delete process.env[key];
      else process.env[key] = old;
    }
  }
}

test('SIP accept audio.input uses semantic_vad when AGENT_OPENAI_TURN_DETECTION=semantic_vad', () => {
  withEnv(
    {
      AGENT_OPENAI_SERVER_VAD_ENABLED: 'true',
      AGENT_OPENAI_TURN_DETECTION: 'semantic_vad',
      AGENT_OPENAI_SEMANTIC_VAD_EAGERNESS: 'medium',
      AGENT_OPENAI_CREATE_RESPONSE: 'true',
      AGENT_OPENAI_INTERRUPT_RESPONSE: 'true',
    },
    () => {
      const input = buildOpenAiSipAcceptAudioInputFromEnv();
      assert.equal(input.turn_detection?.type, 'semantic_vad');
      assert.equal(input.turn_detection?.eagerness, 'medium');
    },
  );
});

test('SIP accept audio.input turn_detection null when VAD disabled', () => {
  withEnv(
    {
      AGENT_OPENAI_SERVER_VAD_ENABLED: 'false',
    },
    () => {
      const input = buildOpenAiSipAcceptAudioInputFromEnv();
      assert.equal(input.turn_detection, null);
    },
  );
});

test('buildOpenAiSipAcceptBody nests audio.input + audio.output', () => {
  withEnv(
    {
      AGENT_OPENAI_SERVER_VAD_ENABLED: 'true',
      AGENT_OPENAI_TURN_DETECTION: 'server_vad',
      AGENT_OPENAI_VAD_THRESHOLD: '0.6',
      AGENT_OPENAI_VAD_PREFIX_MS: '250',
      AGENT_OPENAI_VAD_SILENCE_MS: '400',
      AGENT_OPENAI_VAD_IDLE_TIMEOUT_MS: '8000',
    },
    () => {
      const body = buildOpenAiSipAcceptBody({
        instructions: 'Test',
        model: 'gpt-realtime',
        voice: 'alloy',
        includeDemoNoopTool: false,
      });
      assert.equal(body.audio?.output?.voice, 'alloy');
      assert.equal(body.audio?.input?.turn_detection?.type, 'server_vad');
      assert.equal(body.audio?.input?.turn_detection?.threshold, 0.6);
      assert.equal(body.audio?.input?.turn_detection?.prefix_padding_ms, 250);
      assert.equal(body.audio?.input?.turn_detection?.silence_duration_ms, 400);
      assert.equal(body.audio?.input?.turn_detection?.idle_timeout_ms, 8000);
    },
  );
});

test('buildOpenAiSipAcceptBody adds shop tools + tool_choice when provided', () => {
  withEnv(
    {
      AGENT_OPENAI_SERVER_VAD_ENABLED: 'true',
      AGENT_OPENAI_TURN_DETECTION: 'server_vad',
      VOICE_TRANSPORT: 'openai_sip_direct',
    },
    () => {
      const body = buildOpenAiSipAcceptBody({
        instructions: 'Prod',
        model: 'gpt-realtime',
        voice: 'alloy',
        shopBusinessTools: getSipShopToolsForOpenAiAccept(),
        toolChoice: 'auto',
      });
      assert.ok(body.tools && body.tools.length >= 4);
      assert.ok(body.tools?.some((t) => t.name === 'check_availability'));
      assert.equal(body.tool_choice, 'auto');
    },
  );
});
