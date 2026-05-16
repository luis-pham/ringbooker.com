import { randomUUID } from 'node:crypto';

import type {
  WebDemoSessionAdminRecord,
  WebDemoSessionDemoSource,
  WebDemoSessionStatus,
  WebDemoSessionsRepository,
} from '@/src/backend/ports/web-demo-sessions';

function nowIso(): string {
  return new Date().toISOString();
}

function createId(): string {
  return randomUUID();
}

export class InMemoryWebDemoSessionsRepository implements WebDemoSessionsRepository {
  private readonly rows = new Map<string, WebDemoSessionAdminRecord>();

  private matchesAdminFilters(
    row: WebDemoSessionAdminRecord,
    params: {
      startedAfter: Date;
      startedBefore: Date;
      verticalSlug?: string | null;
      status?: WebDemoSessionStatus | null;
      country?: string | null;
      search?: string | null;
    },
  ): boolean {
    const started = new Date(row.startedAt);
    if (started < params.startedAfter || started > params.startedBefore) return false;
    if (params.verticalSlug && row.verticalSlug !== params.verticalSlug) return false;
    if (params.status && row.status !== params.status) return false;
    const countryEq = params.country?.trim().toUpperCase() ?? null;
    if (countryEq && (row.country ?? '').toUpperCase() !== countryEq) return false;
    const q = (params.search ?? '').trim().toLowerCase();
    if (q) {
      const hay = [row.businessName, row.publicSessionId, row.requestId].filter(Boolean).join(' ').toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  }

  async insertStarted(params: {
    publicSessionId: string;
    requestId: string;
    verticalSlug: string;
    businessName: string;
    ipAddress: string | null;
    country: string | null;
    userAgent: string | null;
    browser: string | null;
    deviceType: string | null;
    demoSource?: WebDemoSessionDemoSource;
  }): Promise<void> {
    const t = nowIso();
    const id = createId();
    this.rows.set(id, {
      id,
      publicSessionId: params.publicSessionId,
      requestId: params.requestId,
      verticalSlug: params.verticalSlug,
      businessName: params.businessName,
      demoSource: params.demoSource ?? 'direct_openai_realtime',
      status: 'started',
      ipAddress: params.ipAddress,
      country: params.country,
      region: null,
      city: null,
      userAgent: params.userAgent,
      deviceType: params.deviceType,
      browser: params.browser,
      startedAt: t,
      connectedAt: null,
      endedAt: null,
      durationSeconds: null,
      transcript: null,
      summary: null,
      errorCode: null,
      errorMessage: null,
      createdAt: t,
      updatedAt: t,
    });
  }

  async insertRateLimited(params: {
    publicSessionId: string;
    verticalSlug: string;
    businessName: string;
    ipAddress: string | null;
    country: string | null;
    userAgent: string | null;
    browser: string | null;
    deviceType: string | null;
    errorCode: string;
    errorMessage?: string | null;
  }): Promise<void> {
    const t = nowIso();
    const id = createId();
    this.rows.set(id, {
      id,
      publicSessionId: params.publicSessionId,
      requestId: null,
      verticalSlug: params.verticalSlug,
      businessName: params.businessName,
      demoSource: 'direct_openai_realtime',
      status: 'rate_limited',
      ipAddress: params.ipAddress,
      country: params.country,
      region: null,
      city: null,
      userAgent: params.userAgent,
      deviceType: params.deviceType,
      browser: params.browser,
      startedAt: t,
      connectedAt: null,
      endedAt: t,
      durationSeconds: null,
      transcript: null,
      summary: null,
      errorCode: params.errorCode,
      errorMessage: params.errorMessage ?? null,
      createdAt: t,
      updatedAt: t,
    });
  }

  async markConnectedByRequestId(requestId: string): Promise<void> {
    const t = nowIso();
    for (const row of this.rows.values()) {
      if (row.requestId === requestId) {
        this.rows.set(row.id, {
          ...row,
          status: 'connected',
          connectedAt: t,
          updatedAt: t,
        });
        return;
      }
    }
  }

  async markFailedByRequestId(requestId: string, params: { errorCode: string; errorMessage?: string | null }): Promise<void> {
    const t = nowIso();
    for (const row of this.rows.values()) {
      if (row.requestId === requestId) {
        this.rows.set(row.id, {
          ...row,
          status: 'failed',
          endedAt: t,
          errorCode: params.errorCode,
          errorMessage: params.errorMessage ?? null,
          updatedAt: t,
        });
        return;
      }
    }
  }

  async finalizeByRequestId(requestId: string, params: { endReason: 'completed' | 'timeout' }): Promise<void> {
    const endedAt = new Date();
    const t = endedAt.toISOString();
    for (const row of this.rows.values()) {
      if (row.requestId !== requestId) continue;
      const anchor = row.connectedAt ?? row.startedAt;
      let durationSeconds: number | null = null;
      if (anchor) {
        const ms = endedAt.getTime() - new Date(anchor).getTime();
        if (Number.isFinite(ms) && ms >= 0) durationSeconds = Math.round(ms / 1000);
      }
      const status: WebDemoSessionStatus = params.endReason === 'timeout' ? 'timed_out' : 'completed';
      this.rows.set(row.id, {
        ...row,
        status,
        endedAt: t,
        durationSeconds,
        updatedAt: t,
      });
      return;
    }
  }

  async saveTranscriptByRequestId(requestId: string, transcript: unknown): Promise<void> {
    for (const row of this.rows.values()) {
      if (row.requestId !== requestId) continue;
      this.rows.set(row.id, { ...row, transcript, updatedAt: nowIso() });
      return;
    }
  }

  async listForAdmin(params: {
    startedAfter: Date;
    startedBefore: Date;
    verticalSlug?: string | null;
    status?: WebDemoSessionStatus | null;
    country?: string | null;
    search?: string | null;
    limit: number;
    offset: number;
  }): Promise<WebDemoSessionAdminRecord[]> {
    const limit = Math.min(Math.max(params.limit, 1), 10_000);
    const offset = params.offset && params.offset > 0 ? params.offset : 0;

    const filtered = [...this.rows.values()].filter((row) => this.matchesAdminFilters(row, params));
    filtered.sort((a, b) => b.startedAt.localeCompare(a.startedAt));
    return filtered.slice(offset, offset + limit);
  }

  async countForAdmin(params: {
    startedAfter: Date;
    startedBefore: Date;
    verticalSlug?: string | null;
    status?: WebDemoSessionStatus | null;
    country?: string | null;
    search?: string | null;
  }): Promise<number> {
    return [...this.rows.values()].filter((row) => this.matchesAdminFilters(row, params)).length;
  }

  async findById(id: string): Promise<WebDemoSessionAdminRecord | null> {
    return this.rows.get(id) ?? null;
  }
}
