import type { Room } from '@livekit/rtc-node';

import type { RealtimeDispatchInput } from '@/src/agent/realtime/dispatch-handler';
import type { RealtimeVoiceProvider } from '@/src/agent/realtime/types';

export type RealtimeToolCallInput = {
  name: string;
  args: Record<string, unknown>;
  callId?: string;
};

export type RealtimeVoiceBridge = {
  provider: RealtimeVoiceProvider;
  sendUserText: (text: string) => void;
  sendUserAudioPcm: (params: { pcm16: Int16Array; sampleRate: number }) => void;
  close: () => void;
};

export type CreateRealtimeVoiceBridgeParams = {
  room: Room;
  dispatch: RealtimeDispatchInput;
  onModelAudioPcm?: (params: { pcm16: Int16Array; sampleRate: number }) => Promise<void> | void;
  onToolCall?: (input: RealtimeToolCallInput) => Promise<unknown> | unknown;
  onToolCallStart?: (input: { name: string; callId?: string }) => Promise<void> | void;
  onUserTranscript?: (text: string) => Promise<void> | void;
  onAssistantTranscript?: (text: string) => Promise<void> | void;
};
