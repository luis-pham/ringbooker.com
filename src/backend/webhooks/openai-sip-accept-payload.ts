/**
 * Body for `POST /v1/realtime/calls/{call_id}/accept` — aligned with OpenAI Realtime SIP docs.
 * `audio.input.turn_detection` mirrors `AGENT_OPENAI_*` used by LiveKit / WebSocket Realtime workers
 * so Telnyx → OpenAI direct SIP uses the same VAD mode (e.g. semantic_vad) as other agent paths.
 * @see https://platform.openai.com/docs/guides/realtime-sip
 * @see https://platform.openai.com/docs/api-reference/realtime-calls/accept-call
 */
export type OpenAiSipFunctionTool = {
  type: 'function';
  name: string;
  description: string;
  parameters: Record<string, unknown>;
};

export type OpenAiRealtimeAcceptBody = {
  type: 'realtime';
  model: string;
  instructions: string;
  /** Realtime accept: nested `audio` per Accept call schema (not legacy flat `session.update`). */
  audio?: {
    input?: {
      turn_detection?: Record<string, unknown> | null;
    };
    output?: {
      voice?: string;
    };
  };
  tools?: OpenAiSipFunctionTool[];
  tool_choice?: 'auto';
};

function parseBoolean(value: string | undefined, defaultValue: boolean): boolean {
  if (!value) return defaultValue;
  const normalized = value.trim().toLowerCase();
  if (['1', 'true', 'yes', 'on'].includes(normalized)) return true;
  if (['0', 'false', 'no', 'off'].includes(normalized)) return false;
  return defaultValue;
}

function parseNumber(value: string | undefined, defaultValue: number): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : defaultValue;
}

/**
 * Builds `audio.input` for SIP accept. Reads `process.env` so backend webhook matches deployment VAD config.
 * `AGENT_OPENAI_SERVER_VAD_ENABLED` is a legacy name: it toggles turn detection on/off, not “server VAD only”.
 */
export function buildOpenAiSipAcceptAudioInputFromEnv(): { turn_detection: Record<string, unknown> | null } {
  const turnDetectionEnabled = parseBoolean(process.env.AGENT_OPENAI_SERVER_VAD_ENABLED, true);
  if (!turnDetectionEnabled) {
    return { turn_detection: null };
  }

  const mode =
    process.env.AGENT_OPENAI_TURN_DETECTION?.trim().toLowerCase() === 'semantic_vad' ? 'semantic_vad' : 'server_vad';
  const createResponse = parseBoolean(process.env.AGENT_OPENAI_CREATE_RESPONSE, true);
  const interruptResponse = parseBoolean(process.env.AGENT_OPENAI_INTERRUPT_RESPONSE, true);

  if (mode === 'server_vad') {
    const threshold = Math.max(0, Math.min(1, parseNumber(process.env.AGENT_OPENAI_VAD_THRESHOLD, 0.5)));
    const prefix_padding_ms = Math.max(0, Math.round(parseNumber(process.env.AGENT_OPENAI_VAD_PREFIX_MS, 300)));
    const silence_duration_ms = Math.max(1, Math.round(parseNumber(process.env.AGENT_OPENAI_VAD_SILENCE_MS, 500)));
    const idleRaw = Math.round(parseNumber(process.env.AGENT_OPENAI_VAD_IDLE_TIMEOUT_MS, 5000));
    const idle_timeout_ms = Math.max(5000, Math.min(30_000, idleRaw));
    return {
      turn_detection: {
        type: 'server_vad',
        threshold,
        prefix_padding_ms,
        silence_duration_ms,
        idle_timeout_ms,
        create_response: createResponse,
        interrupt_response: interruptResponse,
      },
    };
  }

  const eagernessRaw = process.env.AGENT_OPENAI_SEMANTIC_VAD_EAGERNESS?.trim().toLowerCase();
  const eagerness =
    eagernessRaw === 'low' || eagernessRaw === 'medium' || eagernessRaw === 'high' || eagernessRaw === 'auto'
      ? eagernessRaw
      : 'auto';

  return {
    turn_detection: {
      type: 'semantic_vad',
      eagerness,
      create_response: createResponse,
      interrupt_response: interruptResponse,
    },
  };
}

export function buildOpenAiSipAcceptBody(params: {
  instructions: string;
  model: string;
  voice: string;
  /** Demo pilot: single `demo_noop` tool (mutually exclusive with `shopBusinessTools` in callers). */
  includeDemoNoopTool?: boolean;
  /** When true, force `create_response: false` on VAD so the first turn is not doubled with sideband `response.create`. */
  sipPilotSuppressVadCreateResponse?: boolean;
  /** Production shop SIP: business tools from shared Realtime definitions. */
  shopBusinessTools?: OpenAiSipFunctionTool[];
  toolChoice?: 'auto';
}): OpenAiRealtimeAcceptBody {
  let tools: OpenAiSipFunctionTool[] | undefined;
  if (params.includeDemoNoopTool) {
    tools = [
      {
        type: 'function' as const,
        name: 'demo_noop',
        description:
          'Pilot tool: acknowledge a test ping. Returns a short static string. Do not use for real bookings.',
        parameters: {
          type: 'object',
          properties: {},
          additionalProperties: false,
        },
      },
    ];
  } else if (params.shopBusinessTools?.length) {
    tools = params.shopBusinessTools;
  }

  let audioInput = buildOpenAiSipAcceptAudioInputFromEnv();
  if (
    params.sipPilotSuppressVadCreateResponse &&
    audioInput.turn_detection &&
    typeof audioInput.turn_detection === 'object' &&
    !Array.isArray(audioInput.turn_detection)
  ) {
    audioInput = {
      turn_detection: { ...audioInput.turn_detection, create_response: false },
    };
  }

  return {
    type: 'realtime',
    model: params.model,
    instructions: params.instructions,
    audio: {
      input: audioInput,
      output: {
        voice: params.voice,
      },
    },
    ...(params.toolChoice && tools?.length ? { tool_choice: params.toolChoice } : {}),
    ...(tools ? { tools } : {}),
  };
}
