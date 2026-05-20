import type { SupabaseClient } from '@supabase/supabase-js';

import type {
  WebDemoSessionAdminRecord,
  WebDemoSessionDemoSource,
  WebDemoSessionStatus,
  WebDemoSessionsRepository,
} from '@/src/backend/ports/web-demo-sessions';

function escapeIlikePattern(raw: string): string {
  return raw.replace(/\\/g, '\\\\').replace(/%/g, '\\%').replace(/_/g, '\\_');
}

type DbRow = {
  id: string;
  public_session_id: string;
  request_id: string | null;
  vertical_slug: string | null;
  business_name: string | null;
  imported_site_url: string | null;
  ip_address: string | null;
  country: string | null;
  region: string | null;
  city: string | null;
  user_agent: string | null;
  device_type: string | null;
  browser: string | null;
  demo_source: string;
  status: WebDemoSessionStatus;
  started_at: string;
  connected_at: string | null;
  ended_at: string | null;
  duration_seconds: number | null;
  transcript: unknown | null;
  summary: string | null;
  error_code: string | null;
  error_message: string | null;
  created_at: string;
  updated_at: string;
};

function mapRow(row: DbRow): WebDemoSessionAdminRecord {
  return {
    id: row.id,
    publicSessionId: row.public_session_id,
    requestId: row.request_id,
    verticalSlug: row.vertical_slug,
    businessName: row.business_name,
    importedSiteUrl: row.imported_site_url,
    demoSource: row.demo_source,
    status: row.status,
    ipAddress: row.ip_address,
    country: row.country,
    region: row.region,
    city: row.city,
    userAgent: row.user_agent,
    deviceType: row.device_type,
    browser: row.browser,
    startedAt: row.started_at,
    connectedAt: row.connected_at,
    endedAt: row.ended_at,
    durationSeconds: row.duration_seconds,
    transcript: row.transcript,
    summary: row.summary,
    errorCode: row.error_code,
    errorMessage: row.error_message,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export class SupabaseWebDemoSessionsRepository implements WebDemoSessionsRepository {
  constructor(private readonly supabase: SupabaseClient) {}

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
    importedSiteUrl?: string | null;
  }): Promise<void> {
    const now = new Date().toISOString();
    const { error } = await this.supabase.from('web_demo_sessions').insert({
      public_session_id: params.publicSessionId,
      request_id: params.requestId,
      vertical_slug: params.verticalSlug,
      business_name: params.businessName,
      imported_site_url: params.importedSiteUrl ?? null,
      ip_address: params.ipAddress,
      country: params.country,
      user_agent: params.userAgent,
      browser: params.browser,
      device_type: params.deviceType,
      demo_source: params.demoSource ?? 'direct_openai_realtime',
      status: 'started',
      started_at: now,
      updated_at: now,
    });
    if (error) throw new Error(`web_demo_session_insert_started_failed:${error.message}`);
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
    const now = new Date().toISOString();
    const { error } = await this.supabase.from('web_demo_sessions').insert({
      public_session_id: params.publicSessionId,
      request_id: null,
      vertical_slug: params.verticalSlug,
      business_name: params.businessName,
      ip_address: params.ipAddress,
      country: params.country,
      user_agent: params.userAgent,
      browser: params.browser,
      device_type: params.deviceType,
      demo_source: 'direct_openai_realtime',
      status: 'rate_limited',
      started_at: now,
      error_code: params.errorCode,
      error_message: params.errorMessage ?? null,
      updated_at: now,
    });
    if (error) throw new Error(`web_demo_session_insert_rate_limited_failed:${error.message}`);
  }

  async markConnectedByRequestId(requestId: string): Promise<void> {
    const now = new Date().toISOString();
    const { error } = await this.supabase
      .from('web_demo_sessions')
      .update({
        status: 'connected',
        connected_at: now,
        updated_at: now,
      })
      .eq('request_id', requestId);
    if (error) throw new Error(`web_demo_session_mark_connected_failed:${error.message}`);
  }

  async saveTranscriptByRequestId(requestId: string, transcript: unknown): Promise<void> {
    const { error } = await this.supabase
      .from('web_demo_sessions')
      .update({ transcript, updated_at: new Date().toISOString() })
      .eq('request_id', requestId);
    if (error) throw new Error(`web_demo_session_save_transcript_failed:${error.message}`);
  }

  async markFailedByRequestId(requestId: string, params: { errorCode: string; errorMessage?: string | null }): Promise<void> {
    const now = new Date().toISOString();
    const { error } = await this.supabase
      .from('web_demo_sessions')
      .update({
        status: 'failed',
        ended_at: now,
        error_code: params.errorCode,
        error_message: params.errorMessage ?? null,
        updated_at: now,
      })
      .eq('request_id', requestId);
    if (error) throw new Error(`web_demo_session_mark_failed_failed:${error.message}`);
  }

  async finalizeByRequestId(requestId: string, params: { endReason: 'completed' | 'timeout' }): Promise<void> {
    const { data: row, error: fetchErr } = await this.supabase
      .from('web_demo_sessions')
      .select('started_at,connected_at')
      .eq('request_id', requestId)
      .maybeSingle<{ started_at: string; connected_at: string | null }>();
    if (fetchErr) throw new Error(`web_demo_session_finalize_fetch_failed:${fetchErr.message}`);
    if (!row) return;

    const endedAt = new Date();
    const anchor = row.connected_at ?? row.started_at;
    let durationSeconds: number | null = null;
    if (anchor) {
      const ms = endedAt.getTime() - new Date(anchor).getTime();
      if (Number.isFinite(ms) && ms >= 0) durationSeconds = Math.round(ms / 1000);
    }
    const status: WebDemoSessionStatus = params.endReason === 'timeout' ? 'timed_out' : 'completed';
    const nowIso = endedAt.toISOString();
    const { error } = await this.supabase
      .from('web_demo_sessions')
      .update({
        status,
        ended_at: nowIso,
        duration_seconds: durationSeconds,
        updated_at: nowIso,
      })
      .eq('request_id', requestId);
    if (error) throw new Error(`web_demo_session_finalize_failed:${error.message}`);
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

    let q = this.supabase
      .from('web_demo_sessions')
      .select('*')
      .gte('started_at', params.startedAfter.toISOString())
      .lte('started_at', params.startedBefore.toISOString());

    if (params.verticalSlug) {
      q = q.eq('vertical_slug', params.verticalSlug);
    }
    if (params.status) {
      q = q.eq('status', params.status);
    }
    if (params.country) {
      q = q.eq('country', params.country.trim().toUpperCase());
    }
    if (params.search && params.search.trim().length > 0) {
      const term = escapeIlikePattern(params.search.trim());
      q = q.or(`business_name.ilike.%${term}%,public_session_id.ilike.%${term}%,request_id.ilike.%${term}%`);
    }

    const { data, error } = await q.order('started_at', { ascending: false }).range(offset, offset + limit - 1);
    if (error) throw new Error(`web_demo_sessions_list_admin_failed:${error.message}`);
    return (data ?? []).map((r) => mapRow(r as DbRow));
  }

  async countForAdmin(params: {
    startedAfter: Date;
    startedBefore: Date;
    verticalSlug?: string | null;
    status?: WebDemoSessionStatus | null;
    country?: string | null;
    search?: string | null;
  }): Promise<number> {
    let q = this.supabase
      .from('web_demo_sessions')
      .select('id', { count: 'exact', head: true })
      .gte('started_at', params.startedAfter.toISOString())
      .lte('started_at', params.startedBefore.toISOString());

    if (params.verticalSlug) {
      q = q.eq('vertical_slug', params.verticalSlug);
    }
    if (params.status) {
      q = q.eq('status', params.status);
    }
    if (params.country) {
      q = q.eq('country', params.country.trim().toUpperCase());
    }
    if (params.search && params.search.trim().length > 0) {
      const term = escapeIlikePattern(params.search.trim());
      q = q.or(`business_name.ilike.%${term}%,public_session_id.ilike.%${term}%,request_id.ilike.%${term}%`);
    }

    const { count, error } = await q;
    if (error) throw new Error(`web_demo_sessions_count_admin_failed:${error.message}`);
    return count ?? 0;
  }

  async findById(id: string): Promise<WebDemoSessionAdminRecord | null> {
    const { data, error } = await this.supabase.from('web_demo_sessions').select('*').eq('id', id).maybeSingle();
    if (error) throw new Error(`web_demo_session_find_failed:${error.message}`);
    if (!data) return null;
    return mapRow(data as DbRow);
  }
}
