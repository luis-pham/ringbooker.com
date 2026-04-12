import type { CallLogsRepository } from '@/src/backend/ports/repositories';
import { observeDurationMs } from '@/src/backend/observability/metrics';

type MemoryCallLog = {
  provider: string;
  providerCallId: string;
  shopId: string;
  callerPhone?: string;
  destinationPhone?: string;
  requestId?: string;
  roomName?: string;
  startedAt?: Date;
  endedAt?: Date;
  agentJoined: boolean;
  humanAnswered: boolean;
  transcriptStatus?: string;
  transcriptText?: string;
  demoLiveState?: string;
  outcome?: string;
};

function callKey(provider: string, providerCallId: string): string {
  return `${provider}:${providerCallId}`;
}

function matchesStartedRange(
  log: MemoryCallLog,
  params?: { startedAfter?: Date; startedBefore?: Date },
): boolean {
  if (!params?.startedAfter && !params?.startedBefore) return true;
  const t = log.startedAt;
  if (!t) return false;
  if (params.startedAfter && t < params.startedAfter) return false;
  if (params.startedBefore && t > params.startedBefore) return false;
  return true;
}

function matchesCallAdminFilters(
  log: MemoryCallLog,
  params?: {
    startedAfter?: Date;
    startedBefore?: Date;
    outcome?: string;
    transcriptStatus?: string;
  },
): boolean {
  if (!matchesStartedRange(log, params)) return false;
  if (params?.outcome !== undefined && (log.outcome ?? '') !== params.outcome) return false;
  if (params?.transcriptStatus !== undefined && (log.transcriptStatus ?? '') !== params.transcriptStatus) return false;
  return true;
}

export class InMemoryCallLogsRepository implements CallLogsRepository {
  private readonly logsByCall = new Map<string, MemoryCallLog>();

  async createOrUpdateInboundCall(params: {
    provider: string;
    providerCallId: string;
    shopId: string;
    callerPhone?: string;
    destinationPhone?: string;
    requestId?: string;
    roomName?: string;
    startedAt?: Date;
  }): Promise<void> {
    const key = callKey(params.provider, params.providerCallId);
    const existing = this.logsByCall.get(key);
    this.logsByCall.set(key, {
      provider: params.provider,
      providerCallId: params.providerCallId,
      shopId: params.shopId,
      callerPhone: params.callerPhone ?? existing?.callerPhone,
      destinationPhone: params.destinationPhone ?? existing?.destinationPhone,
      requestId: params.requestId ?? existing?.requestId,
      roomName: params.roomName ?? existing?.roomName,
      startedAt: params.startedAt ?? existing?.startedAt ?? new Date(),
      endedAt: existing?.endedAt,
      agentJoined: existing?.agentJoined ?? false,
      humanAnswered: existing?.humanAnswered ?? false,
      transcriptStatus: existing?.transcriptStatus ?? 'pending',
      demoLiveState: existing?.demoLiveState ?? 'preparing',
      outcome: existing?.outcome,
    });
  }

  async markAgentJoined(params: { shopId: string; requestId: string; roomName?: string }): Promise<void> {
    for (const [key, log] of this.logsByCall.entries()) {
      if (log.shopId === params.shopId && log.requestId === params.requestId) {
        this.logsByCall.set(key, {
          ...log,
          agentJoined: true,
          roomName: params.roomName ?? log.roomName,
        });
      }
    }
  }

  async appendTranscriptByRequestId(params: {
    shopId: string;
    requestId: string;
    speaker: 'caller' | 'assistant' | 'system';
    text: string;
    occurredAt?: Date;
  }): Promise<void> {
    const cleaned = params.text.trim();
    if (!cleaned) return;
    const timestamp = (params.occurredAt ?? new Date()).toISOString();
    const line = `[${timestamp}] ${params.speaker.toUpperCase()}: ${cleaned}`;
    for (const [key, log] of this.logsByCall.entries()) {
      if (log.shopId === params.shopId && log.requestId === params.requestId) {
        const existing = log.transcriptText?.trim();
        const nextTranscript = existing ? `${existing}\n${line}` : line;
        this.logsByCall.set(key, {
          ...log,
          transcriptStatus: 'pending',
          transcriptText: nextTranscript,
        });
      }
    }
  }

  async updateTranscriptStatusByRequestId(params: {
    shopId: string;
    requestId: string;
    status: 'pending' | 'completed' | 'failed';
  }): Promise<void> {
    for (const [key, log] of this.logsByCall.entries()) {
      if (log.shopId === params.shopId && log.requestId === params.requestId) {
        this.logsByCall.set(key, {
          ...log,
          transcriptStatus: params.status,
        });
      }
    }
  }

  async updateDemoLiveStateByRequestId(params: {
    shopId: string;
    requestId: string;
    state:
      | 'preparing'
      | 'caller_speaking'
      | 'ai_agent_speaking'
      | 'thinking'
      | 'looking_up_info'
      | 'completed'
      | 'failed'
      | null;
  }): Promise<void> {
    for (const [key, log] of this.logsByCall.entries()) {
      if (log.shopId === params.shopId && log.requestId === params.requestId) {
        this.logsByCall.set(key, {
          ...log,
          demoLiveState: params.state ?? undefined,
        });
      }
    }
  }

  async markEndedByProviderCallId(params: {
    provider: string;
    providerCallId: string;
    endedAt: Date;
    outcome?: string;
    humanAnswered?: boolean;
  }): Promise<void> {
    const key = callKey(params.provider, params.providerCallId);
    const existing = this.logsByCall.get(key);
    if (!existing) return;
    this.logsByCall.set(key, {
      ...existing,
      endedAt: params.endedAt,
      outcome: params.outcome ?? existing.outcome,
      humanAnswered: params.humanAnswered ?? existing.humanAnswered,
    });
    if (existing.startedAt) {
      const durationMs = params.endedAt.getTime() - existing.startedAt.getTime();
      if (durationMs >= 0) {
        observeDurationMs('call_latency_ms', durationMs, {
          provider: params.provider,
          outcome: params.outcome ?? existing.outcome ?? 'unknown',
        });
      }
    }
  }

  async countByShop(
    shopId: string,
    params?: {
      startedAfter?: Date;
      startedBefore?: Date;
      outcome?: string;
      transcriptStatus?: string;
    },
  ): Promise<number> {
    return [...this.logsByCall.values()].filter(
      (log) => log.shopId === shopId && matchesCallAdminFilters(log, params),
    ).length;
  }

  async countRecent(params?: {
    startedAfter?: Date;
    startedBefore?: Date;
    outcome?: string;
    transcriptStatus?: string;
  }): Promise<number> {
    return [...this.logsByCall.values()].filter((log) => matchesCallAdminFilters(log, params)).length;
  }

  async listByShop(
    shopId: string,
    params?: { limit?: number; offset?: number; startedAfter?: Date; startedBefore?: Date },
  ): Promise<
    Array<{
      provider: string;
      providerCallId: string;
      shopId: string;
      callerPhone?: string;
      destinationPhone?: string;
      requestId?: string;
      roomName?: string;
      startedAt?: string;
      endedAt?: string;
      agentJoined: boolean;
      humanAnswered: boolean;
      transcriptStatus?: string;
      transcriptText?: string;
      demoLiveState?: string;
      outcome?: string;
    }>
  > {
    const limit = params?.limit && params.limit > 0 ? params.limit : 20;
    const offset = params?.offset && params.offset > 0 ? params.offset : 0;
    return [...this.logsByCall.values()]
      .filter((log) => log.shopId === shopId && matchesStartedRange(log, params))
      .sort((a, b) => (b.startedAt?.toISOString() ?? '').localeCompare(a.startedAt?.toISOString() ?? ''))
      .slice(offset, offset + limit)
      .map((log) => ({
        ...log,
        startedAt: log.startedAt?.toISOString(),
        endedAt: log.endedAt?.toISOString(),
      }));
  }

  async listRecent(params?: {
    limit?: number;
    offset?: number;
    startedAfter?: Date;
    startedBefore?: Date;
  }): Promise<
    Array<{
      provider: string;
      providerCallId: string;
      shopId: string;
      callerPhone?: string;
      destinationPhone?: string;
      requestId?: string;
      roomName?: string;
      startedAt?: string;
      endedAt?: string;
      agentJoined: boolean;
      humanAnswered: boolean;
      transcriptStatus?: string;
      transcriptText?: string;
      demoLiveState?: string;
      outcome?: string;
    }>
  > {
    const limit = params?.limit && params.limit > 0 ? params.limit : 20;
    const offset = params?.offset && params.offset > 0 ? params.offset : 0;
    return [...this.logsByCall.values()]
      .filter((log) => matchesStartedRange(log, params))
      .sort((a, b) => (b.startedAt?.toISOString() ?? '').localeCompare(a.startedAt?.toISOString() ?? ''))
      .slice(offset, offset + limit)
      .map((log) => ({
        ...log,
        startedAt: log.startedAt?.toISOString(),
        endedAt: log.endedAt?.toISOString(),
      }));
  }

  async findTranscriptByShopAndRequestId(params: {
    shopId: string;
    requestId: string;
  }): Promise<{
    transcriptText?: string;
    transcriptStatus?: string;
    startedAt?: string;
    endedAt?: string;
  } | null> {
    for (const log of this.logsByCall.values()) {
      if (log.shopId === params.shopId && log.requestId === params.requestId) {
        return {
          transcriptText: log.transcriptText,
          transcriptStatus: log.transcriptStatus,
          startedAt: log.startedAt?.toISOString(),
          endedAt: log.endedAt?.toISOString(),
        };
      }
    }
    return null;
  }

  async listTranscriptMetaByShopAndRequestIds(params: {
    shopId: string;
    requestIds: string[];
  }): Promise<Map<string, { transcriptStatus?: string; hasTranscriptText: boolean }>> {
    const map = new Map<string, { transcriptStatus?: string; hasTranscriptText: boolean }>();
    const want = new Set(params.requestIds);
    if (want.size === 0) return map;
    for (const log of this.logsByCall.values()) {
      if (log.shopId !== params.shopId || !log.requestId || !want.has(log.requestId)) continue;
      map.set(log.requestId, {
        transcriptStatus: log.transcriptStatus,
        hasTranscriptText: Boolean(log.transcriptText?.trim().length),
      });
    }
    return map;
  }
}
