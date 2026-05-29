import test from 'node:test';
import assert from 'node:assert/strict';

import { getSipShopToolsForOpenAiAccept } from '@/src/agent/sip/sip-tool-definitions';
import {
  buildDirectWebDemoClientSecretAudioInput,
  buildOpenAiSipAcceptAudioInputFromEnv,
  buildOpenAiSipAcceptBody,
  buildOpenAiTurnDetectionAudioInputFromEnv,
} from '@/src/backend/webhooks/openai-sip-accept-payload';

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

test('SIP accept audio.input uses slower production-safe server VAD defaults', () => {
  withEnv(
    {
      AGENT_OPENAI_SERVER_VAD_ENABLED: 'true',
      AGENT_OPENAI_TURN_DETECTION: 'server_vad',
      AGENT_OPENAI_VAD_THRESHOLD: undefined,
      AGENT_OPENAI_VAD_PREFIX_MS: undefined,
      AGENT_OPENAI_VAD_SILENCE_MS: undefined,
      AGENT_OPENAI_VAD_IDLE_TIMEOUT_MS: undefined,
    },
    () => {
      const input = buildOpenAiSipAcceptAudioInputFromEnv();
      assert.equal(input.turn_detection?.type, 'server_vad');
      assert.equal(input.turn_detection?.threshold, 0.45);
      assert.equal(input.turn_detection?.prefix_padding_ms, 500);
      assert.equal(input.turn_detection?.silence_duration_ms, 900);
      assert.equal(input.turn_detection?.idle_timeout_ms, 10000);
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

test('buildOpenAiSipAcceptBody can suppress VAD create_response for SIP demo pilot', () => {
  withEnv(
    {
      AGENT_OPENAI_SERVER_VAD_ENABLED: 'true',
      AGENT_OPENAI_TURN_DETECTION: 'semantic_vad',
      AGENT_OPENAI_CREATE_RESPONSE: 'true',
    },
    () => {
      const body = buildOpenAiSipAcceptBody({
        instructions: 'Demo',
        model: 'gpt-realtime',
        voice: 'alloy',
        includeDemoNoopTool: true,
        sipPilotSuppressVadCreateResponse: true,
      });
      assert.equal(body.audio?.input?.turn_detection?.create_response, false);
      assert.equal(body.audio?.input?.turn_detection?.interrupt_response, false);
      assert.ok(body.tools?.some((t) => t.name === 'demo_noop'));
      assert.ok(body.tools?.some((t) => t.name === 'end_call'));
    },
  );
});

test('buildOpenAiSipAcceptBody suppresses VAD interruption for a bridge-gated shop greeting', () => {
  withEnv(
    {
      AGENT_OPENAI_SERVER_VAD_ENABLED: 'true',
      AGENT_OPENAI_TURN_DETECTION: 'server_vad',
      AGENT_OPENAI_CREATE_RESPONSE: 'true',
      AGENT_OPENAI_INTERRUPT_RESPONSE: 'true',
    },
    () => {
      const body = buildOpenAiSipAcceptBody({
        instructions: 'Shop',
        model: 'gpt-realtime',
        voice: 'alloy',
        sipPilotSuppressVadCreateResponse: true,
      });
      assert.equal(body.audio?.input?.turn_detection?.create_response, false);
      assert.equal(body.audio?.input?.turn_detection?.interrupt_response, false);
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
      AGENT_OPENAI_INPUT_TRANSCRIPTION_LANGUAGE: undefined,
      AGENT_OPENAI_INPUT_TRANSCRIPTION_MODEL: undefined,
      AGENT_OPENAI_LANGUAGE: undefined,
      AGENT_OPENAI_TRANSCRIPTION_MODEL: undefined,
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
      assert.deepEqual(body.audio?.input?.transcription, {
        model: 'gpt-4o-mini-transcribe',
        language: 'en',
      });
    },
  );
});

test('buildOpenAiSipAcceptBody allows explicit transcription language override', () => {
  withEnv(
    {
      AGENT_OPENAI_INPUT_TRANSCRIPTION_LANGUAGE: 'vi',
      AGENT_OPENAI_INPUT_TRANSCRIPTION_MODEL: 'gpt-4o-transcribe',
    },
    () => {
      const body = buildOpenAiSipAcceptBody({
        instructions: 'Test',
        model: 'gpt-realtime',
        voice: 'alloy',
      });
      assert.deepEqual(body.audio?.input?.transcription, {
        model: 'gpt-4o-transcribe',
        language: 'vi',
      });
    },
  );
});

test('buildOpenAiSipAcceptBody omits transcription language when shop policy enables bilingual auto-detect', () => {
  withEnv(
    {
      AGENT_OPENAI_INPUT_TRANSCRIPTION_LANGUAGE: undefined,
      AGENT_OPENAI_LANGUAGE: undefined,
      AGENT_OPENAI_INPUT_TRANSCRIPTION_MODEL: undefined,
      AGENT_OPENAI_TRANSCRIPTION_MODEL: undefined,
    },
    () => {
      const body = buildOpenAiSipAcceptBody({
        instructions: 'Test',
        model: 'gpt-realtime',
        voice: 'alloy',
        transcriptionLanguage: undefined,
      });
      assert.deepEqual(body.audio?.input?.transcription, {
        model: 'gpt-4o-mini-transcribe',
      });
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
      assert.ok(body.tools?.some((t) => t.name === 'validate_appointment_time'));
      assert.ok(body.tools?.some((t) => t.name === 'end_call'));
      assert.ok(body.tools?.some((t) => t.name === 'check_availability'));
      assert.equal(body.tool_choice, 'auto');
    },
  );
});

test('buildDirectWebDemoClientSecretAudioInput uses public demo VAD profile before AGENT fallback', () => {
  withEnv(
    {
      AGENT_OPENAI_SERVER_VAD_ENABLED: 'true',
      AGENT_OPENAI_TURN_DETECTION: 'server_vad',
      AGENT_OPENAI_CREATE_RESPONSE: 'true',
      PUBLIC_DEMO_OPENAI_TURN_DETECTION: 'semantic_vad',
      PUBLIC_DEMO_OPENAI_SEMANTIC_VAD_EAGERNESS: 'medium',
      PUBLIC_DEMO_OPENAI_CREATE_RESPONSE: 'true',
    },
    () => {
      const { turnDetectionForSecret, turnDetectionAfterWelcome } = buildDirectWebDemoClientSecretAudioInput();
      assert.equal(turnDetectionForSecret?.create_response, false);
      assert.equal(turnDetectionAfterWelcome?.create_response, true);
      assert.equal(turnDetectionForSecret?.type, 'semantic_vad');
      assert.equal(turnDetectionAfterWelcome?.type, 'semantic_vad');
    },
  );
});

test('buildDirectWebDemoClientSecretAudioInput uses user demo VAD profile for onboarding embed', () => {
  withEnv(
    {
      AGENT_OPENAI_SERVER_VAD_ENABLED: 'true',
      AGENT_OPENAI_TURN_DETECTION: 'server_vad',
      PUBLIC_DEMO_OPENAI_TURN_DETECTION: 'semantic_vad',
      USER_DEMO_OPENAI_TURN_DETECTION: 'server_vad',
      USER_DEMO_OPENAI_VAD_THRESHOLD: '0.6',
      USER_DEMO_OPENAI_VAD_PREFIX_MS: '120',
      USER_DEMO_OPENAI_VAD_SILENCE_MS: '120',
      USER_DEMO_OPENAI_VAD_IDLE_TIMEOUT_MS: '5000',
      USER_DEMO_OPENAI_CREATE_RESPONSE: 'true',
      USER_DEMO_OPENAI_INTERRUPT_RESPONSE: 'true',
    },
    () => {
      const { turnDetectionForSecret, turnDetectionAfterWelcome } = buildDirectWebDemoClientSecretAudioInput('user_demo');
      assert.equal(turnDetectionForSecret?.type, 'server_vad');
      assert.equal(turnDetectionForSecret?.threshold, 0.6);
      assert.equal(turnDetectionForSecret?.prefix_padding_ms, 120);
      assert.equal(turnDetectionForSecret?.silence_duration_ms, 120);
      assert.equal(turnDetectionForSecret?.idle_timeout_ms, 5000);
      assert.equal(turnDetectionForSecret?.create_response, false);
      assert.equal(turnDetectionForSecret?.interrupt_response, false);
      assert.equal(turnDetectionAfterWelcome?.type, 'server_vad');
      assert.equal(turnDetectionAfterWelcome?.create_response, true);
      assert.equal(turnDetectionAfterWelcome?.interrupt_response, true);
    },
  );
});

test('web demo VAD profiles fall back to shared WEB_DEMO then AGENT env', () => {
  withEnv(
    {
      AGENT_OPENAI_SERVER_VAD_ENABLED: 'true',
      AGENT_OPENAI_TURN_DETECTION: 'server_vad',
      WEB_DEMO_OPENAI_TURN_DETECTION: 'semantic_vad',
      WEB_DEMO_OPENAI_SEMANTIC_VAD_EAGERNESS: 'high',
      PUBLIC_DEMO_OPENAI_TURN_DETECTION: undefined,
      PUBLIC_DEMO_OPENAI_SEMANTIC_VAD_EAGERNESS: undefined,
      USER_DEMO_OPENAI_TURN_DETECTION: undefined,
      USER_DEMO_OPENAI_SEMANTIC_VAD_EAGERNESS: undefined,
    },
    () => {
      assert.equal(buildOpenAiTurnDetectionAudioInputFromEnv('public_demo').turn_detection?.type, 'semantic_vad');
      assert.equal(buildOpenAiTurnDetectionAudioInputFromEnv('public_demo').turn_detection?.eagerness, 'high');
      assert.equal(buildOpenAiTurnDetectionAudioInputFromEnv('user_demo').turn_detection?.type, 'semantic_vad');
      assert.equal(buildOpenAiTurnDetectionAudioInputFromEnv('user_demo').turn_detection?.eagerness, 'high');
    },
  );
});

test('buildDirectWebDemoClientSecretAudioInput returns nulls when VAD disabled', () => {
  withEnv({ AGENT_OPENAI_SERVER_VAD_ENABLED: 'false', PUBLIC_DEMO_OPENAI_SERVER_VAD_ENABLED: undefined }, () => {
    const { turnDetectionForSecret, turnDetectionAfterWelcome } = buildDirectWebDemoClientSecretAudioInput();
    assert.equal(turnDetectionForSecret, null);
    assert.equal(turnDetectionAfterWelcome, null);
  });
});
