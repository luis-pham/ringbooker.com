import { z } from 'zod';

import { launchLiveKitGeminiWorker } from '@/src/agent/realtime/livekit-agent-launcher';
import { withLogContext } from '@/src/backend/observability/logger';
import type { CallLogsRepository } from '@/src/backend/ports/repositories';

const realtimeDispatchSchema = z.object({
  requestId: z.string().min(1),
  roomName: z.string().min(1),
  destinationPhone: z.string().min(1),
  callerPhone: z.string().min(1),
  systemPrompt: z.string().min(1),
  dispatchedAt: z.string().datetime().optional(),
  realtime: z.object({
    mode: z.enum(['mock', 'livekit_realtime']),
    sessionId: z.string().min(1),
    roomName: z.string().min(1),
    status: z.enum(['started', 'simulated']),
    metadata: z.record(z.string(), z.unknown()).optional(),
  }),
});

export type RealtimeDispatchInput = z.infer<typeof realtimeDispatchSchema>;

export function parseRealtimeDispatchInput(input: unknown): RealtimeDispatchInput | null {
  const parsed = realtimeDispatchSchema.safeParse(input);
  if (!parsed.success) return null;
  return parsed.data;
}

export async function handleRealtimeDispatch(
  input: RealtimeDispatchInput,
  deps?: {
    callLogsRepository?: CallLogsRepository;
  },
): Promise<void> {
  const strictProduction = process.env.NODE_ENV === 'production' && process.env.ALLOW_INSECURE_PROD_RUNTIME !== 'true';
  if (strictProduction && input.realtime.mode !== 'livekit_realtime') {
    throw new Error(`realtime_dispatch_mode_not_allowed_in_production:${input.realtime.mode}`);
  }

  const metadata = input.realtime.metadata ?? {};
  const shopId = typeof metadata.shopId === 'string' ? metadata.shopId : undefined;
  const provider =
    metadata &&
    typeof metadata === 'object' &&
    'dispatchPayload' in metadata &&
    typeof (metadata as { dispatchPayload?: { transport?: { provider?: string } } }).dispatchPayload?.transport?.provider ===
      'string'
      ? (metadata as { dispatchPayload: { transport: { provider: string } } }).dispatchPayload.transport.provider
      : undefined;

  const log = withLogContext({
    requestId: input.requestId,
    shopId,
    callId: input.realtime.sessionId,
    provider,
  });

  // TODO: wire this to a provider-agnostic worker process manager when launching real worker runtime.
  log.info(
    {
      roomName: input.roomName,
      mode: input.realtime.mode,
    },
    'realtime_dispatch_received',
  );

  if (input.realtime.mode === 'livekit_realtime') {
    await launchLiveKitGeminiWorker(input);
  }

  if (deps?.callLogsRepository && shopId) {
    await deps.callLogsRepository.markAgentJoined({
      shopId,
      requestId: input.requestId,
      roomName: input.roomName,
    });
  }
}
