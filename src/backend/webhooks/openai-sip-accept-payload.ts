/**
 * Body for `POST /v1/realtime/calls/{call_id}/accept` — aligned with OpenAI Realtime SIP docs.
 * @see https://platform.openai.com/docs/guides/realtime-sip
 */
export type OpenAiRealtimeAcceptBody = {
  type: 'realtime';
  model: string;
  instructions: string;
  /** Output TTS voice (OpenAI accept-call expects this under `audio.output`, not top-level). */
  audio?: {
    output?: {
      voice?: string;
    };
  };
  tools?: Array<{
    type: 'function';
    name: string;
    description: string;
    parameters: Record<string, unknown>;
  }>;
};

export function buildOpenAiSipAcceptBody(params: {
  instructions: string;
  model: string;
  voice: string;
  includeDemoNoopTool: boolean;
}): OpenAiRealtimeAcceptBody {
  const tools = params.includeDemoNoopTool
    ? [
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
      ]
    : undefined;

  return {
    type: 'realtime',
    model: params.model,
    instructions: params.instructions,
    audio: {
      output: {
        voice: params.voice,
      },
    },
    ...(tools ? { tools } : {}),
  };
}
