import type {
  DemoCallRunRecord,
  DemoCallStatus,
  DemoMode,
  DemoSessionsRepository,
  DemoSessionStatus,
} from '@/src/backend/ports/repositories';

type MemoryDemoSession = {
  id: string;
  publicSessionId: string;
  verticalSlug: string;
  mode: DemoMode;
  source: string;
  callbackPhone: string;
  status: DemoSessionStatus;
  expiresAt: Date;
  createdAt: Date;
};

type MemoryDemoBusinessConfig = {
  demoSessionId: string;
  businessName: string;
  city?: string | null;
  businessHours?: unknown;
  staff?: unknown;
  notes?: string | null;
  systemPrompt?: string | null;
};

type MemoryDemoCallRun = {
  demoSessionId: string;
  requestId: string;
  provider: string;
  providerCallId?: string | null;
  roomName?: string | null;
  status: DemoCallStatus;
  startedAt?: Date | null;
  connectedAt?: Date | null;
  endedAt?: Date | null;
  outcome?: string | null;
  createdAt: Date;
};

function createId(): string {
  return `demo_${Math.random().toString(36).slice(2)}${Date.now().toString(36)}`;
}

export class InMemoryDemoSessionsRepository implements DemoSessionsRepository {
  private readonly sessionsById = new Map<string, MemoryDemoSession>();
  private readonly businessConfigsBySessionId = new Map<string, MemoryDemoBusinessConfig>();
  private readonly servicesBySessionId = new Map<string, Array<Record<string, unknown>>>();
  private readonly callRunsByRequestId = new Map<string, MemoryDemoCallRun>();
  private readonly smsRuns: Array<Record<string, unknown>> = [];
  private readonly statusEvents: Array<Record<string, unknown>> = [];

  async createSession(params: {
    publicSessionId: string;
    verticalSlug: string;
    mode: DemoMode;
    source: string;
    callbackPhone: string;
    businessName: string;
    city?: string | null;
    businessHours?: unknown;
    staff?: unknown;
    notes?: string | null;
    systemPrompt?: string | null;
    services?: Array<{
      category: string;
      name: string;
      price?: number | null;
      duration?: string | null;
      enabled?: boolean;
    }>;
    expiresAt?: Date;
  }): Promise<{ id: string; expiresAt: Date }> {
    const id = createId();
    const expiresAt = params.expiresAt ?? new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    this.sessionsById.set(id, {
      id,
      publicSessionId: params.publicSessionId,
      verticalSlug: params.verticalSlug,
      mode: params.mode,
      source: params.source,
      callbackPhone: params.callbackPhone,
      status: 'created',
      expiresAt,
      createdAt: new Date(),
    });
    this.businessConfigsBySessionId.set(id, {
      demoSessionId: id,
      businessName: params.businessName,
      city: params.city,
      businessHours: params.businessHours,
      staff: params.staff,
      notes: params.notes,
      systemPrompt: params.systemPrompt,
    });
    this.servicesBySessionId.set(id, params.services ?? []);
    return { id, expiresAt };
  }

  async createCallRun(params: {
    demoSessionId: string;
    requestId: string;
    provider: string;
    providerCallId?: string | null;
    roomName?: string | null;
    status: DemoCallStatus;
    startedAt?: Date;
  }): Promise<void> {
    this.callRunsByRequestId.set(params.requestId, {
      demoSessionId: params.demoSessionId,
      requestId: params.requestId,
      provider: params.provider,
      providerCallId: params.providerCallId,
      roomName: params.roomName,
      status: params.status,
      startedAt: params.startedAt ?? new Date(),
      createdAt: new Date(),
    });
    const session = this.sessionsById.get(params.demoSessionId);
    if (session) {
      this.sessionsById.set(params.demoSessionId, {
        ...session,
        status: params.status === 'queued' ? 'queued' : params.status,
      });
    }
  }

  async markCallRunStatusByRequestId(params: {
    requestId: string;
    status: DemoCallStatus;
    providerCallId?: string | null;
    connectedAt?: Date | null;
    endedAt?: Date | null;
    outcome?: string | null;
  }): Promise<void> {
    const current = this.callRunsByRequestId.get(params.requestId);
    if (!current) return;
    const next = {
      ...current,
      status: params.status,
      providerCallId: params.providerCallId ?? current.providerCallId,
      connectedAt: params.connectedAt ?? current.connectedAt,
      endedAt: params.endedAt ?? current.endedAt,
      outcome: params.outcome ?? current.outcome,
    };
    this.callRunsByRequestId.set(params.requestId, next);
    const session = this.sessionsById.get(current.demoSessionId);
    if (session) {
      this.sessionsById.set(current.demoSessionId, { ...session, status: params.status });
    }
  }

  async createSmsRun(params: {
    requestId: string;
    toPhone: string;
    templateKey: string;
    previewBody: string;
    sentAt?: Date | null;
    providerMessageId?: string | null;
  }): Promise<void> {
    this.smsRuns.push({ ...params, createdAt: new Date() });
  }

  async addStatusEvent(params: {
    requestId?: string | null;
    demoSessionId?: string | null;
    eventType: string;
    payload?: unknown;
    occurredAt?: Date;
  }): Promise<void> {
    this.statusEvents.push({ ...params, occurredAt: params.occurredAt ?? new Date() });
  }

  async findCallRunByRequestId(requestId: string): Promise<DemoCallRunRecord | null> {
    const call = this.callRunsByRequestId.get(requestId);
    if (!call) return null;
    const session = this.sessionsById.get(call.demoSessionId);
    if (!session) return null;
    return {
      requestId: call.requestId,
      publicSessionId: session.publicSessionId,
      verticalSlug: session.verticalSlug,
      mode: session.mode,
      callbackPhone: session.callbackPhone,
      provider: call.provider,
      providerCallId: call.providerCallId,
      roomName: call.roomName,
      status: call.status,
      startedAt: call.startedAt?.toISOString() ?? null,
      connectedAt: call.connectedAt?.toISOString() ?? null,
      endedAt: call.endedAt?.toISOString() ?? null,
      outcome: call.outcome,
      expiresAt: session.expiresAt.toISOString(),
    };
  }

  async expireOlderThan(now: Date): Promise<number> {
    let expired = 0;
    for (const [id, session] of this.sessionsById.entries()) {
      if (session.expiresAt <= now && session.status !== 'expired') {
        this.sessionsById.set(id, { ...session, status: 'expired' });
        expired += 1;
      }
    }
    return expired;
  }
}
