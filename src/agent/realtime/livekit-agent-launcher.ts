import { spawn } from 'node:child_process';
import { AgentDispatchClient } from 'livekit-server-sdk';

import { withLogContext } from '@/src/backend/observability/logger';
import { getEnv } from '@/src/backend/config/env';

type LaunchPayload = {
  requestId: string;
  roomName: string;
  destinationPhone: string;
  callerPhone: string;
  systemPrompt: string;
  realtime: {
    mode: 'mock' | 'livekit_realtime';
    sessionId: string;
    roomName: string;
    status: 'started' | 'simulated';
    metadata?: Record<string, unknown>;
  };
};

export class LiveKitAgentLaunchError extends Error {
  readonly retryable: boolean;

  constructor(message: string, retryable = true) {
    super(message);
    this.name = 'LiveKitAgentLaunchError';
    this.retryable = retryable;
  }
}

function normalizeLiveKitHttpUrl(url: string): string {
  if (url.startsWith('https://') || url.startsWith('http://')) return url;
  if (url.startsWith('wss://')) return `https://${url.slice('wss://'.length)}`;
  if (url.startsWith('ws://')) return `http://${url.slice('ws://'.length)}`;
  return `https://${url}`;
}

export async function launchLiveKitGeminiWorker(payload: LaunchPayload): Promise<{ pid: number }> {
  const env = getEnv();
  if (process.env.AGENT_RUNTIME_MODE === 'livekit_native_openai') {
    const agentName = env.AGENT_LIVEKIT_NATIVE_OPENAI_AGENT_NAME ?? 'ringbooker-native-openai';
    const client = new AgentDispatchClient(
      normalizeLiveKitHttpUrl(env.LIVEKIT_URL),
      env.LIVEKIT_API_KEY,
      env.LIVEKIT_API_SECRET,
    );

    const log = withLogContext({
      requestId: payload.requestId,
      callId: payload.realtime.sessionId,
      provider: 'livekit_native_openai',
    });

    const dispatch = await client.createDispatch(payload.roomName, agentName, {
      metadata: JSON.stringify(payload),
    });

    log.info(
      {
        roomName: payload.roomName,
        agentName,
        dispatchId: dispatch.id,
      },
      'livekit_native_openai_agent_dispatched',
    );

    return { pid: process.pid };
  }

  const command = env.AGENT_LIVEKIT_AGENT_COMMAND;
  if (!command) {
    throw new LiveKitAgentLaunchError('missing_agent_livekit_agent_command', false);
  }

  const log = withLogContext({
    requestId: payload.requestId,
    callId: payload.realtime.sessionId,
    provider: 'livekit',
  });

  const encodedPayload = Buffer.from(JSON.stringify(payload), 'utf-8').toString('base64');
  const child = spawn(command, {
    shell: true,
    detached: true,
    stdio: 'ignore',
    env: {
      ...process.env,
      RB_DISPATCH_PAYLOAD_BASE64: encodedPayload,
      RB_DISPATCH_REQUEST_ID: payload.requestId,
      RB_DISPATCH_ROOM_NAME: payload.roomName,
      RB_DISPATCH_SESSION_ID: payload.realtime.sessionId,
    },
  });

  child.unref();

  if (!child.pid) {
    throw new LiveKitAgentLaunchError('livekit_agent_spawn_failed_no_pid', true);
  }

  log.info({ pid: child.pid, roomName: payload.roomName }, 'livekit_agent_worker_spawned');
  return { pid: child.pid };
}
