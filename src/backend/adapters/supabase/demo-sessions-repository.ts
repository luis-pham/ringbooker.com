import type { SupabaseClient } from '@supabase/supabase-js';

import type {
  DemoAdminCallListRow,
  DemoCallRunRecord,
  DemoCallStatus,
  DemoMode,
  DemoSessionStatus,
  DemoSessionsRepository,
  SipDemoSessionEnrichment,
} from '@/src/backend/ports/repositories';

export class SupabaseDemoSessionsRepository implements DemoSessionsRepository {
  constructor(private readonly supabase: SupabaseClient) {}

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
    clientIp?: string | null;
    clientCountry?: string | null;
  }): Promise<{ id: string; expiresAt: Date }> {
    const expiresAt = params.expiresAt ?? new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    const { data: session, error: sessionError } = await this.supabase
      .from('demo_sessions')
      .insert({
        public_session_id: params.publicSessionId,
        vertical_slug: params.verticalSlug,
        demo_mode: params.mode,
        source: params.source,
        callback_phone: params.callbackPhone,
        status: 'created',
        expires_at: expiresAt.toISOString(),
        client_ip: params.clientIp ?? null,
        client_country: params.clientCountry ?? null,
      })
      .select('id,expires_at')
      .single<{ id: string; expires_at: string }>();
    if (sessionError) throw new Error(`demo_session_create_failed:${sessionError.message}`);

    const { error: configError } = await this.supabase.from('demo_business_configs').insert({
      demo_session_id: session.id,
      business_name: params.businessName,
      city: params.city,
      business_hours: params.businessHours ?? {},
      staff: params.staff ?? [],
      notes: params.notes,
      system_prompt: params.systemPrompt,
    });
    if (configError) throw new Error(`demo_business_config_create_failed:${configError.message}`);

    if (params.services && params.services.length > 0) {
      const { error: servicesError } = await this.supabase.from('demo_services').insert(
        params.services.map((service) => ({
          demo_session_id: session.id,
          category: service.category,
          name: service.name,
          price: service.price,
          duration: service.duration,
          enabled: service.enabled ?? true,
        })),
      );
      if (servicesError) throw new Error(`demo_services_create_failed:${servicesError.message}`);
    }

    return { id: session.id, expiresAt: new Date(session.expires_at) };
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
    const { error } = await this.supabase.from('demo_call_runs').insert({
      demo_session_id: params.demoSessionId,
      request_id: params.requestId,
      provider: params.provider,
      provider_call_id: params.providerCallId,
      room_name: params.roomName,
      status: params.status,
      started_at: (params.startedAt ?? new Date()).toISOString(),
    });
    if (error) throw new Error(`demo_call_run_create_failed:${error.message}`);

    await this.supabase.from('demo_sessions').update({ status: params.status, updated_at: new Date().toISOString() }).eq('id', params.demoSessionId);
  }

  async markCallRunStatusByRequestId(params: {
    requestId: string;
    status: DemoCallStatus;
    providerCallId?: string | null;
    connectedAt?: Date | null;
    endedAt?: Date | null;
    outcome?: string | null;
  }): Promise<void> {
    const update: Record<string, unknown> = {
      status: params.status,
    };
    if (params.providerCallId !== undefined) update.provider_call_id = params.providerCallId;
    if (params.connectedAt !== undefined) update.connected_at = params.connectedAt?.toISOString() ?? null;
    if (params.endedAt !== undefined) update.ended_at = params.endedAt?.toISOString() ?? null;
    if (params.outcome !== undefined) update.outcome = params.outcome;

    const { data, error } = await this.supabase
      .from('demo_call_runs')
      .update(update)
      .eq('request_id', params.requestId)
      .select('demo_session_id')
      .maybeSingle<{ demo_session_id: string }>();
    if (error) throw new Error(`demo_call_run_update_failed:${error.message}`);
    if (data?.demo_session_id) {
      await this.supabase
        .from('demo_sessions')
        .update({ status: params.status, updated_at: new Date().toISOString() })
        .eq('id', data.demo_session_id);
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
    const { data: call } = await this.supabase
      .from('demo_call_runs')
      .select('id,demo_session_id')
      .eq('request_id', params.requestId)
      .maybeSingle<{ id: string; demo_session_id: string }>();
    const { error } = await this.supabase.from('demo_sms_runs').insert({
      demo_session_id: call?.demo_session_id,
      demo_call_run_id: call?.id,
      to_phone: params.toPhone,
      template_key: params.templateKey,
      preview_body: params.previewBody,
      sent_at: params.sentAt?.toISOString() ?? null,
      provider_message_id: params.providerMessageId,
    });
    if (error) throw new Error(`demo_sms_run_create_failed:${error.message}`);
  }

  async addStatusEvent(params: {
    requestId?: string | null;
    demoSessionId?: string | null;
    eventType: string;
    payload?: unknown;
    occurredAt?: Date;
  }): Promise<void> {
    const { error } = await this.supabase.from('demo_status_events').insert({
      demo_session_id: params.demoSessionId,
      request_id: params.requestId,
      event_type: params.eventType,
      payload: params.payload ?? {},
      occurred_at: (params.occurredAt ?? new Date()).toISOString(),
    });
    if (error) throw new Error(`demo_status_event_create_failed:${error.message}`);
  }

  async findLatestSipDemoContext(params: {
    callerPhone: string;
    now?: Date;
  }): Promise<SipDemoSessionEnrichment | null> {
    const now = params.now ?? new Date();
    const { data: session, error: sessionError } = await this.supabase
      .from('demo_sessions')
      .select('id,vertical_slug')
      .eq('callback_phone', params.callerPhone)
      .gt('expires_at', now.toISOString())
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle<{ id: string; vertical_slug: string }>();
    if (sessionError) throw new Error(`sip_demo_context_session_failed:${sessionError.message}`);
    if (!session) return null;

    const { data: cfg, error: cfgError } = await this.supabase
      .from('demo_business_configs')
      .select('business_name,city,business_hours,staff,notes')
      .eq('demo_session_id', session.id)
      .maybeSingle<{
        business_name: string;
        city: string | null;
        business_hours: Record<string, unknown> | null;
        staff: unknown;
        notes: string | null;
      }>();
    if (cfgError) throw new Error(`sip_demo_context_config_failed:${cfgError.message}`);
    if (!cfg) return null;

    const { data: svcRows, error: svcError } = await this.supabase
      .from('demo_services')
      .select('category,name,price,duration,enabled')
      .eq('demo_session_id', session.id);
    if (svcError) throw new Error(`sip_demo_context_services_failed:${svcError.message}`);

    const staffArr = Array.isArray(cfg.staff)
      ? (cfg.staff as unknown[]).filter((x): x is string => typeof x === 'string')
      : [];

    const hours = cfg.business_hours && typeof cfg.business_hours === 'object' ? cfg.business_hours : {};
    const primaryHours = typeof (hours as { primaryHours?: unknown }).primaryHours === 'string'
      ? ((hours as { primaryHours: string }).primaryHours as string)
      : null;
    const secondaryHours = typeof (hours as { secondaryHours?: unknown }).secondaryHours === 'string'
      ? ((hours as { secondaryHours: string }).secondaryHours as string)
      : null;

    const services = (svcRows ?? []).map((r) => ({
      category: r.category,
      name: r.name,
      price: r.price != null ? Number(r.price) : null,
      duration: r.duration,
      enabled: r.enabled,
    }));

    return {
      shopName: cfg.business_name,
      verticalSlug: session.vertical_slug,
      notes: cfg.notes,
      demoConfig: {
        city: cfg.city,
        primaryHours,
        secondaryHours,
        staffNames: staffArr,
        services,
      },
    };
  }

  async findCallRunByRequestId(requestId: string): Promise<DemoCallRunRecord | null> {
    const { data, error } = await this.supabase
      .from('demo_call_runs')
      .select(
        'request_id,provider,provider_call_id,room_name,status,started_at,connected_at,ended_at,outcome,demo_sessions!inner(public_session_id,vertical_slug,demo_mode,callback_phone,expires_at)',
      )
      .eq('request_id', requestId)
      .maybeSingle<{
        request_id: string;
        provider: string;
        provider_call_id: string | null;
        room_name: string | null;
        status: DemoCallStatus;
        started_at: string | null;
        connected_at: string | null;
        ended_at: string | null;
        outcome: string | null;
        demo_sessions: {
          public_session_id: string;
          vertical_slug: string;
          demo_mode: DemoMode;
          callback_phone: string;
          expires_at: string | null;
        };
      }>();
    if (error) throw new Error(`demo_call_run_find_failed:${error.message}`);
    if (!data) return null;
    return {
      requestId: data.request_id,
      publicSessionId: data.demo_sessions.public_session_id,
      verticalSlug: data.demo_sessions.vertical_slug,
      mode: data.demo_sessions.demo_mode,
      callbackPhone: data.demo_sessions.callback_phone,
      provider: data.provider,
      providerCallId: data.provider_call_id,
      roomName: data.room_name,
      status: data.status,
      startedAt: data.started_at,
      connectedAt: data.connected_at,
      endedAt: data.ended_at,
      outcome: data.outcome,
      expiresAt: data.demo_sessions.expires_at,
    };
  }

  async expireOlderThan(now: Date): Promise<number> {
    const { data, error } = await this.supabase
      .from('demo_sessions')
      .update({ status: 'expired', updated_at: now.toISOString() })
      .lt('expires_at', now.toISOString())
      .neq('status', 'expired')
      .select('id');
    if (error) throw new Error(`demo_sessions_expire_failed:${error.message}`);
    return data?.length ?? 0;
  }

  async countAdminDemoCallRuns(params: {
    createdAfter: Date;
    createdBefore: Date;
    providerEquals?: string;
    providerNotEquals?: string;
  }): Promise<number> {
    let q = this.supabase
      .from('demo_call_runs')
      .select('request_id', { count: 'exact', head: true })
      .gte('created_at', params.createdAfter.toISOString())
      .lte('created_at', params.createdBefore.toISOString());
    if (params.providerEquals) {
      q = q.eq('provider', params.providerEquals);
    }
    if (params.providerNotEquals) {
      q = q.neq('provider', params.providerNotEquals);
    }
    const { count, error } = await q;
    if (error) throw new Error(`demo_call_runs_count_admin_failed:${error.message}`);
    return count ?? 0;
  }

  async listAdminDemoCallRuns(params: {
    createdAfter: Date;
    createdBefore: Date;
    limit?: number;
    offset?: number;
    providerEquals?: string;
    providerNotEquals?: string;
  }): Promise<DemoAdminCallListRow[]> {
    const limit = Math.min(Math.max(params.limit ?? 20, 1), 10_000);
    const offset = params.offset && params.offset > 0 ? params.offset : 0;
    type SessionRow = {
      id: string;
      public_session_id: string;
      vertical_slug: string;
      demo_mode: DemoMode;
      source: string;
      status: DemoSessionStatus;
      callback_phone: string;
      client_ip: string | null;
      client_country: string | null;
    };
    type RunRow = {
      request_id: string;
      demo_session_id: string;
      provider: string;
      provider_call_id: string | null;
      room_name: string | null;
      status: DemoCallStatus;
      started_at: string | null;
      connected_at: string | null;
      ended_at: string | null;
      outcome: string | null;
      created_at: string;
      demo_sessions: SessionRow;
    };

    let rq = this.supabase
      .from('demo_call_runs')
      .select(
        'request_id,demo_session_id,provider,provider_call_id,room_name,status,started_at,connected_at,ended_at,outcome,created_at,demo_sessions!inner(id,public_session_id,vertical_slug,demo_mode,source,status,callback_phone,client_ip,client_country)',
      )
      .gte('created_at', params.createdAfter.toISOString())
      .lte('created_at', params.createdBefore.toISOString());
    if (params.providerEquals) {
      rq = rq.eq('provider', params.providerEquals);
    }
    if (params.providerNotEquals) {
      rq = rq.neq('provider', params.providerNotEquals);
    }
    const { data: runs, error } = await rq.order('created_at', { ascending: false }).range(offset, offset + limit - 1);

    if (error) throw new Error(`demo_call_runs_list_admin_failed:${error.message}`);

    const unwrapSession = (value: SessionRow | SessionRow[] | null | undefined): SessionRow | null => {
      if (value == null) return null;
      return Array.isArray(value) ? (value[0] ?? null) : value;
    };

    const sessionIds = [
      ...new Set(
        (runs ?? [])
          .map((r) => unwrapSession((r as { demo_sessions?: SessionRow | SessionRow[] }).demo_sessions))
          .filter(Boolean)
          .map((s) => (s as SessionRow).id),
      ),
    ];
    const businessNameBySession = new Map<string, string>();
    if (sessionIds.length > 0) {
      const { data: configs, error: configError } = await this.supabase
        .from('demo_business_configs')
        .select('demo_session_id,business_name')
        .in('demo_session_id', sessionIds);
      if (configError) throw new Error(`demo_business_configs_list_admin_failed:${configError.message}`);
      for (const row of configs ?? []) {
        businessNameBySession.set(row.demo_session_id as string, row.business_name as string);
      }
    }

    return (runs ?? []).map((raw) => {
      const r = raw as Omit<RunRow, 'demo_sessions'> & { demo_sessions: SessionRow | SessionRow[] };
      const s = unwrapSession(r.demo_sessions);
      if (!s) {
        throw new Error('demo_call_runs_list_admin_failed:missing_session_embed');
      }
      return {
        requestId: r.request_id,
        demoSessionId: r.demo_session_id,
        publicSessionId: s.public_session_id,
        verticalSlug: s.vertical_slug,
        demoMode: s.demo_mode,
        source: s.source,
        sessionStatus: s.status,
        runStatus: r.status,
        outcome: r.outcome,
        callbackPhone: s.callback_phone,
        businessName: businessNameBySession.get(s.id) ?? null,
        clientIp: s.client_ip,
        clientCountry: s.client_country,
        provider: r.provider,
        providerCallId: r.provider_call_id,
        roomName: r.room_name,
        startedAt: r.started_at,
        connectedAt: r.connected_at,
        endedAt: r.ended_at,
        runCreatedAt: r.created_at,
      };
    });
  }
}
