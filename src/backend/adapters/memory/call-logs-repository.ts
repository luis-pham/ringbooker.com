import type {
  CallLogListItem,
  CallLogsRepository,
  CallLogsQueryParams,
  CallStructuredSummaryFields,
  CallSummaryNextAction,
} from '@/src/backend/ports/repositories';
import { observeDurationMs } from '@/src/backend/observability/metrics';
import { getCapturedCallerReason } from '@/src/backend/services/usage/captured-caller';

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
  summaryServiceRequest?: string | null;
  summaryUrgency?: 'low' | 'medium' | 'high' | null;
  summaryNextAction?: CallSummaryNextAction | null;
  summaryCallerQuestion?: string | null;
  summaryCallerName?: string | null;
  summaryPreferredTech?: string | null;
  summaryPreferredDatetime?: string | null;
  summaryFollowUpRequired?: boolean;
  isCapturedCaller?: boolean;
  capturedCallerReason?: string | null;
  capturedAt?: Date | null;
  durationSecs?: number;
  providerCostAmount?: number | null;
  providerCostCurrency?: string | null;
  providerCostRecordedAt?: Date | null;
  recordingStatus?: 'not_requested' | 'pending' | 'available' | 'failed' | 'deleted';
  recordingProvider?: string | null;
  recordingId?: string | null;
  recordingStorageKey?: string | null;
  recordingFormat?: string | null;
  recordingDurationMs?: number | null;
  recordingStartedAt?: Date | null;
  recordingEndedAt?: Date | null;
  recordingError?: string | null;
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

function matchesCallAdminFilters(log: MemoryCallLog, params?: CallLogsQueryParams): boolean {
  if (!matchesStartedRange(log, params)) return false;
  if (params?.outcome !== undefined && (log.outcome ?? '') !== params.outcome) return false;
  if (params?.transcriptStatus !== undefined && (log.transcriptStatus ?? '') !== params.transcriptStatus) return false;
  if (params?.summaryFollowUpRequired !== undefined && Boolean(log.summaryFollowUpRequired) !== params.summaryFollowUpRequired) return false;
  if (params?.summaryUrgency !== undefined && log.summaryUrgency !== params.summaryUrgency) return false;
  if (params?.summaryNextActions?.length && !params.summaryNextActions.includes(log.summaryNextAction as CallSummaryNextAction)) return false;
  if (params?.isCapturedCaller !== undefined && Boolean(log.isCapturedCaller) !== params.isCapturedCaller) return false;
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
      transcriptText: existing?.transcriptText,
      outcome: existing?.outcome,
      summaryServiceRequest: existing?.summaryServiceRequest,
      summaryUrgency: existing?.summaryUrgency,
      summaryNextAction: existing?.summaryNextAction,
      summaryCallerQuestion: existing?.summaryCallerQuestion,
      summaryCallerName: existing?.summaryCallerName,
      summaryPreferredTech: existing?.summaryPreferredTech,
      summaryPreferredDatetime: existing?.summaryPreferredDatetime,
      summaryFollowUpRequired: existing?.summaryFollowUpRequired,
      isCapturedCaller: existing?.isCapturedCaller ?? false,
      capturedCallerReason: existing?.capturedCallerReason ?? null,
      capturedAt: existing?.capturedAt ?? null,
      durationSecs: existing?.durationSecs ?? 0,
      recordingStatus: existing?.recordingStatus ?? 'not_requested',
      recordingProvider: existing?.recordingProvider ?? null,
      recordingId: existing?.recordingId ?? null,
      recordingStorageKey: existing?.recordingStorageKey ?? null,
      recordingFormat: existing?.recordingFormat ?? null,
      recordingDurationMs: existing?.recordingDurationMs ?? null,
      recordingStartedAt: existing?.recordingStartedAt ?? null,
      recordingEndedAt: existing?.recordingEndedAt ?? null,
      recordingError: existing?.recordingError ?? null,
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
      durationSecs: existing.startedAt ? Math.max(0, Math.round((params.endedAt.getTime() - existing.startedAt.getTime()) / 1000)) : 0,
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

  async setOutcomeByProviderCallId(params: { provider: string; providerCallId: string; outcome: string }): Promise<void> {
    const key = callKey(params.provider, params.providerCallId);
    const existing = this.logsByCall.get(key);
    if (!existing) return;
    this.logsByCall.set(key, { ...existing, outcome: params.outcome });
  }

  async recordProviderCostByProviderCallId(params: {
    provider: string;
    providerCallId: string;
    costAmount: number | null;
    costCurrency: string | null;
    recordedAt?: Date;
  }): Promise<void> {
    const key = callKey(params.provider, params.providerCallId);
    const existing = this.logsByCall.get(key);
    if (!existing) return;
    this.logsByCall.set(key, {
      ...existing,
      providerCostAmount: params.costAmount,
      providerCostCurrency: params.costCurrency,
      providerCostRecordedAt: params.recordedAt ?? new Date(),
    });
  }

  async markRecordingPendingByProviderCallId(params: {
    provider: string;
    providerCallId: string;
    recordingProvider: string;
  }): Promise<void> {
    const key = callKey(params.provider, params.providerCallId);
    const existing = this.logsByCall.get(key);
    if (!existing) return;
    this.logsByCall.set(key, {
      ...existing,
      recordingStatus: 'pending',
      recordingProvider: params.recordingProvider,
      recordingError: null,
    });
  }

  async markRecordingAvailableByProviderCallId(params: {
    provider: string;
    providerCallId: string;
    recordingProvider: string;
    recordingId: string;
    recordingStorageKey: string;
    recordingFormat: string;
    recordingDurationMs?: number | null;
    recordingStartedAt?: Date | null;
    recordingEndedAt?: Date | null;
  }): Promise<void> {
    const key = callKey(params.provider, params.providerCallId);
    const existing = this.logsByCall.get(key);
    if (!existing) return;
    this.logsByCall.set(key, {
      ...existing,
      recordingStatus: 'available',
      recordingProvider: params.recordingProvider,
      recordingId: params.recordingId,
      recordingStorageKey: params.recordingStorageKey,
      recordingFormat: params.recordingFormat,
      recordingDurationMs: params.recordingDurationMs ?? null,
      recordingStartedAt: params.recordingStartedAt ?? null,
      recordingEndedAt: params.recordingEndedAt ?? null,
      recordingError: null,
    });
  }

  async markRecordingFailedByProviderCallId(params: {
    provider: string;
    providerCallId: string;
    recordingProvider: string;
    recordingId?: string | null;
    error: string;
  }): Promise<void> {
    const key = callKey(params.provider, params.providerCallId);
    const existing = this.logsByCall.get(key);
    if (!existing) return;
    this.logsByCall.set(key, {
      ...existing,
      recordingStatus: 'failed',
      recordingProvider: params.recordingProvider,
      recordingId: params.recordingId ?? existing.recordingId ?? null,
      recordingError: params.error,
    });
  }

  async findByProviderCallId(params: { provider: string; providerCallId: string }): Promise<CallLogListItem | null> {
    const log = this.logsByCall.get(callKey(params.provider, params.providerCallId));
    if (!log) return null;
    return {
      ...log,
      startedAt: log.startedAt?.toISOString(),
      endedAt: log.endedAt?.toISOString(),
      capturedAt: log.capturedAt?.toISOString() ?? null,
      recordingStartedAt: log.recordingStartedAt?.toISOString() ?? null,
      recordingEndedAt: log.recordingEndedAt?.toISOString() ?? null,
    };
  }

  async countByShop(
    shopId: string,
    params?: CallLogsQueryParams,
  ): Promise<number> {
    return [...this.logsByCall.values()].filter(
      (log) => log.shopId === shopId && matchesCallAdminFilters(log, params),
    ).length;
  }

  async countRecent(params?: CallLogsQueryParams): Promise<number> {
    return [...this.logsByCall.values()].filter((log) => matchesCallAdminFilters(log, params)).length;
  }

  async listByShop(shopId: string, params?: CallLogsQueryParams): Promise<CallLogListItem[]> {
    const limit = params?.limit && params.limit > 0 ? params.limit : 20;
    const offset = params?.offset && params.offset > 0 ? params.offset : 0;
    return [...this.logsByCall.values()]
      .filter((log) => log.shopId === shopId && matchesCallAdminFilters(log, params))
      .sort((a, b) => (b.startedAt?.toISOString() ?? '').localeCompare(a.startedAt?.toISOString() ?? ''))
      .slice(offset, offset + limit)
      .map((log) => ({
        ...log,
        startedAt: log.startedAt?.toISOString(),
        endedAt: log.endedAt?.toISOString(),
        capturedAt: log.capturedAt?.toISOString() ?? null,
        recordingStartedAt: log.recordingStartedAt?.toISOString() ?? null,
        recordingEndedAt: log.recordingEndedAt?.toISOString() ?? null,
      }));
  }

  async listRecent(params?: CallLogsQueryParams): Promise<CallLogListItem[]> {
    const limit = params?.limit && params.limit > 0 ? params.limit : 20;
    const offset = params?.offset && params.offset > 0 ? params.offset : 0;
    return [...this.logsByCall.values()]
      .filter((log) => matchesCallAdminFilters(log, params))
      .sort((a, b) => (b.startedAt?.toISOString() ?? '').localeCompare(a.startedAt?.toISOString() ?? ''))
      .slice(offset, offset + limit)
      .map((log) => ({
        ...log,
        startedAt: log.startedAt?.toISOString(),
        endedAt: log.endedAt?.toISOString(),
        capturedAt: log.capturedAt?.toISOString() ?? null,
        recordingStartedAt: log.recordingStartedAt?.toISOString() ?? null,
        recordingEndedAt: log.recordingEndedAt?.toISOString() ?? null,
      }));
  }

  async resolveStaleInProgressByShop(shopId: string, staleBefore: Date): Promise<number> {
    let resolved = 0;
    const now = new Date();
    for (const [key, log] of this.logsByCall.entries()) {
      if (log.shopId !== shopId) continue;
      if (log.endedAt) continue;
      if (!log.startedAt || log.startedAt >= staleBefore) continue;
      const hasTranscript = Boolean(log.transcriptText?.trim()) || log.transcriptStatus === 'completed';
      this.logsByCall.set(key, {
        ...log,
        endedAt: now,
        outcome: hasTranscript ? log.outcome && log.outcome !== 'in_progress' ? log.outcome : 'completed' : 'missed',
        durationSecs: Math.max(0, Math.round((now.getTime() - log.startedAt.getTime()) / 1000)),
      });
      resolved += 1;
    }
    return resolved;
  }


  async sumDurationSecsByShop(shopId: string, params?: CallLogsQueryParams): Promise<number> {
    return [...this.logsByCall.values()]
      .filter((log) => log.shopId === shopId && matchesCallAdminFilters(log, params))
      .reduce((sum, log) => sum + (log.durationSecs ?? 0), 0);
  }

  async markCapturedCallerByProviderCallId(params: {
    provider: string;
    providerCallId: string;
    isCapturedCaller: boolean;
    reason?: string | null;
    capturedAt?: Date | null;
  }): Promise<void> {
    const key = callKey(params.provider, params.providerCallId);
    const existing = this.logsByCall.get(key);
    if (!existing) return;
    this.logsByCall.set(key, {
      ...existing,
      isCapturedCaller: params.isCapturedCaller,
      capturedCallerReason: params.reason ?? null,
      capturedAt: params.isCapturedCaller ? (params.capturedAt ?? new Date()) : null,
    });
  }

  async updateStructuredSummary(shopId: string, requestId: string, fields: CallStructuredSummaryFields): Promise<void> {
    for (const [key, log] of this.logsByCall.entries()) {
      if (log.shopId === shopId && log.requestId === requestId) {
        const next = { ...log, ...fields };
        const reason = getCapturedCallerReason(next);
        this.logsByCall.set(key, {
          ...next,
          isCapturedCaller: Boolean(reason),
          capturedCallerReason: reason,
          capturedAt: reason ? new Date() : null,
        });
      }
    }
  }

  async findTranscriptByShopAndRequestId(params: {
    shopId: string;
    requestId: string;
  }): Promise<{
    callerPhone?: string;
    transcriptText?: string;
    transcriptStatus?: string;
    startedAt?: string;
    endedAt?: string;
  } | null> {
    for (const log of this.logsByCall.values()) {
      if (log.shopId === params.shopId && log.requestId === params.requestId) {
        return {
          callerPhone: log.callerPhone,
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
  }): Promise<Map<string, { callerPhone?: string; transcriptStatus?: string; hasTranscriptText: boolean }>> {
    const map = new Map<string, { callerPhone?: string; transcriptStatus?: string; hasTranscriptText: boolean }>();
    const want = new Set(params.requestIds);
    if (want.size === 0) return map;
    for (const log of this.logsByCall.values()) {
      if (log.shopId !== params.shopId || !log.requestId || !want.has(log.requestId)) continue;
      map.set(log.requestId, {
        callerPhone: log.callerPhone,
        transcriptStatus: log.transcriptStatus,
        hasTranscriptText: Boolean(log.transcriptText?.trim().length),
      });
    }
    return map;
  }
}
