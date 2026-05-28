import type { SupabaseClient } from '@supabase/supabase-js';

import type {
  CallLogListItem,
  CallLogsRepository,
  CallLogsQueryParams,
  CallStructuredSummaryFields,
} from '@/src/backend/ports/repositories';
import { observeDurationMs } from '@/src/backend/observability/metrics';
import { getCapturedCallerReason } from '@/src/backend/services/usage/captured-caller';


function applyCallLogFilters<T extends { gte: (column: string, value: string) => T; lte: (column: string, value: string) => T; eq: (column: string, value: unknown) => T; in: (column: string, values: unknown[]) => T }>(
  query: T,
  params?: CallLogsQueryParams,
): T {
  let q = query;
  if (params?.startedAfter) q = q.gte('started_at', params.startedAfter.toISOString());
  if (params?.startedBefore) q = q.lte('started_at', params.startedBefore.toISOString());
  if (params?.outcome) q = q.eq('outcome', params.outcome);
  if (params?.transcriptStatus) q = q.eq('transcript_status', params.transcriptStatus);
  if (params?.summaryFollowUpRequired !== undefined) q = q.eq('summary_follow_up_required', params.summaryFollowUpRequired);
  if (params?.summaryUrgency) q = q.eq('summary_urgency', params.summaryUrgency);
  if (params?.summaryNextActions?.length) q = q.in('summary_next_action', params.summaryNextActions);
  if (params?.isCapturedCaller !== undefined) q = q.eq('is_captured_caller', params.isCapturedCaller);
  return q;
}

export class SupabaseCallLogsRepository implements CallLogsRepository {
  constructor(private readonly supabase: SupabaseClient) {}

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
    const { error } = await this.supabase.from('call_logs').upsert(
      {
        provider: params.provider,
        provider_call_id: params.providerCallId,
        shop_id: params.shopId,
        caller_phone: params.callerPhone,
        destination_phone: params.destinationPhone,
        request_id: params.requestId,
        room_name: params.roomName,
        direction: 'inbound',
        started_at: (params.startedAt ?? new Date()).toISOString(),
        demo_live_state: 'preparing',
      },
      {
        onConflict: 'provider,provider_call_id',
        ignoreDuplicates: false,
      },
    );

    if (error) {
      throw new Error(`call_logs_create_or_update_failed:${error.message}`);
    }
  }

  async markAgentJoined(params: { shopId: string; requestId: string; roomName?: string }): Promise<void> {
    const { error } = await this.supabase
      .from('call_logs')
      .update({
        agent_joined: true,
        room_name: params.roomName,
      })
      .eq('shop_id', params.shopId)
      .eq('request_id', params.requestId);

    if (error) {
      throw new Error(`call_logs_mark_agent_joined_failed:${error.message}`);
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

    const { data: current, error: readError } = await this.supabase
      .from('call_logs')
      .select('transcript_text')
      .eq('shop_id', params.shopId)
      .eq('request_id', params.requestId)
      .limit(1)
      .maybeSingle<{ transcript_text: string | null }>();

    if (readError) {
      throw new Error(`call_logs_get_transcript_failed:${readError.message}`);
    }

    const transcriptText = current?.transcript_text?.trim();
    const nextTranscript = transcriptText ? `${transcriptText}\n${line}` : line;
    const { data: updatedRows, error } = await this.supabase
      .from('call_logs')
      .update({
        transcript_status: 'pending',
        transcript_text: nextTranscript,
      })
      .eq('shop_id', params.shopId)
      .eq('request_id', params.requestId)
      .select('id');

    if (error) {
      throw new Error(`call_logs_append_transcript_failed:${error.message}`);
    }
    if (!updatedRows?.length) {
      console.warn('[call_logs_append_transcript] no row matched transcript correlation', {
        shopId: params.shopId,
        requestId: params.requestId,
      });
    }
  }

  async updateTranscriptStatusByRequestId(params: {
    shopId: string;
    requestId: string;
    status: 'pending' | 'completed' | 'failed';
  }): Promise<void> {
    const { error } = await this.supabase
      .from('call_logs')
      .update({
        transcript_status: params.status,
      })
      .eq('shop_id', params.shopId)
      .eq('request_id', params.requestId);

    if (error) {
      throw new Error(`call_logs_update_transcript_status_failed:${error.message}`);
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
    const { error } = await this.supabase
      .from('call_logs')
      .update({
        demo_live_state: params.state,
      })
      .eq('shop_id', params.shopId)
      .eq('request_id', params.requestId);

    if (error) {
      throw new Error(`call_logs_update_demo_live_state_failed:${error.message}`);
    }
  }

  async markEndedByProviderCallId(params: {
    provider: string;
    providerCallId: string;
    endedAt: Date;
    outcome?: string;
    humanAnswered?: boolean;
  }): Promise<void> {
    const { data: currentRow, error: currentError } = await this.supabase
      .from('call_logs')
      .select('started_at,outcome,provider,caller_phone,transcript_text,demo_live_state,summary_service_request,summary_next_action,summary_caller_question,summary_caller_name,summary_preferred_tech,summary_preferred_datetime,summary_follow_up_required')
      .eq('provider', params.provider)
      .eq('provider_call_id', params.providerCallId)
      .maybeSingle<{ started_at: string | null; outcome: string | null }>();
    if (currentError) {
      throw new Error(`call_logs_get_started_at_failed:${currentError.message}`);
    }

    const patch: Record<string, unknown> = {
      ended_at: params.endedAt.toISOString(),
      duration_secs: currentRow?.started_at
        ? Math.max(0, Math.round((params.endedAt.getTime() - new Date(currentRow.started_at).getTime()) / 1000))
        : 0,
    };
    if (params.outcome !== undefined) patch.outcome = params.outcome;
    if (params.humanAnswered !== undefined) patch.human_answered = params.humanAnswered;

    const { error } = await this.supabase
      .from('call_logs')
      .update(patch)
      .eq('provider', params.provider)
      .eq('provider_call_id', params.providerCallId);

    if (error) {
      throw new Error(`call_logs_mark_ended_failed:${error.message}`);
    }
    if (currentRow?.started_at) {
      const startedAtMs = new Date(currentRow.started_at).getTime();
      const durationMs = params.endedAt.getTime() - startedAtMs;
      if (Number.isFinite(durationMs) && durationMs >= 0) {
        observeDurationMs('call_latency_ms', durationMs, {
          provider: params.provider,
          outcome: params.outcome ?? currentRow.outcome ?? 'unknown',
        });
      }
    }
  }

  async setOutcomeByProviderCallId(params: { provider: string; providerCallId: string; outcome: string }): Promise<void> {
    const { error } = await this.supabase
      .from('call_logs')
      .update({ outcome: params.outcome })
      .eq('provider', params.provider)
      .eq('provider_call_id', params.providerCallId);
    if (error) {
      throw new Error(`call_logs_set_outcome_failed:${error.message}`);
    }
  }

  async recordProviderCostByProviderCallId(params: {
    provider: string;
    providerCallId: string;
    costAmount: number | null;
    costCurrency: string | null;
    recordedAt?: Date;
  }): Promise<void> {
    const { error } = await this.supabase
      .from('call_logs')
      .update({
        provider_cost_amount: params.costAmount,
        provider_cost_currency: params.costCurrency,
        provider_cost_recorded_at: (params.recordedAt ?? new Date()).toISOString(),
      })
      .eq('provider', params.provider)
      .eq('provider_call_id', params.providerCallId);
    if (error) {
      throw new Error(`call_logs_record_provider_cost_failed:${error.message}`);
    }
  }

  async markRecordingPendingByProviderCallId(params: {
    provider: string;
    providerCallId: string;
    recordingProvider: string;
  }): Promise<void> {
    const { error } = await this.supabase
      .from('call_logs')
      .update({ recording_status: 'pending', recording_provider: params.recordingProvider, recording_error: null })
      .eq('provider', params.provider)
      .eq('provider_call_id', params.providerCallId);
    if (error) throw new Error(`call_logs_recording_pending_failed:${error.message}`);
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
    const { error } = await this.supabase
      .from('call_logs')
      .update({
        recording_status: 'available',
        recording_provider: params.recordingProvider,
        recording_id: params.recordingId,
        recording_storage_key: params.recordingStorageKey,
        recording_format: params.recordingFormat,
        recording_duration_ms: params.recordingDurationMs ?? null,
        recording_started_at: params.recordingStartedAt?.toISOString() ?? null,
        recording_ended_at: params.recordingEndedAt?.toISOString() ?? null,
        recording_error: null,
      })
      .eq('provider', params.provider)
      .eq('provider_call_id', params.providerCallId);
    if (error) throw new Error(`call_logs_recording_available_failed:${error.message}`);
  }

  async markRecordingFailedByProviderCallId(params: {
    provider: string;
    providerCallId: string;
    recordingProvider: string;
    recordingId?: string | null;
    error: string;
  }): Promise<void> {
    const { error } = await this.supabase
      .from('call_logs')
      .update({
        recording_status: 'failed',
        recording_provider: params.recordingProvider,
        recording_id: params.recordingId ?? null,
        recording_error: params.error,
      })
      .eq('provider', params.provider)
      .eq('provider_call_id', params.providerCallId);
    if (error) throw new Error(`call_logs_recording_failed_update_failed:${error.message}`);
  }

  async findByProviderCallId(params: { provider: string; providerCallId: string }): Promise<CallLogListItem | null> {
    const { data, error } = await this.supabase
      .from('call_logs')
      .select(
        'provider,provider_call_id,shop_id,caller_phone,destination_phone,request_id,room_name,started_at,ended_at,agent_joined,human_answered,transcript_status,transcript_text,demo_live_state,outcome,is_captured_caller,captured_caller_reason,captured_at,duration_secs,summary_service_request,summary_urgency,summary_next_action,summary_caller_question,summary_caller_name,summary_preferred_tech,summary_preferred_datetime,summary_follow_up_required,recording_status,recording_provider,recording_id,recording_storage_key,recording_format,recording_duration_ms,recording_started_at,recording_ended_at',
      )
      .eq('provider', params.provider)
      .eq('provider_call_id', params.providerCallId)
      .maybeSingle<Record<string, unknown>>();
    if (error) throw new Error(`call_logs_find_by_provider_call_id_failed:${error.message}`);
    if (!data) return null;
    return {
      provider: data.provider as string,
      providerCallId: data.provider_call_id as string,
      shopId: data.shop_id as string,
      requestId: (data.request_id as string | null) ?? undefined,
      startedAt: (data.started_at as string | null) ?? undefined,
      endedAt: (data.ended_at as string | null) ?? undefined,
      agentJoined: Boolean(data.agent_joined),
      humanAnswered: Boolean(data.human_answered),
      transcriptStatus: (data.transcript_status as string | null) ?? undefined,
      transcriptText: (data.transcript_text as string | null) ?? undefined,
      recordingStatus: (data.recording_status as CallLogListItem['recordingStatus']) ?? 'not_requested',
      recordingProvider: (data.recording_provider as string | null) ?? null,
      recordingId: (data.recording_id as string | null) ?? null,
      recordingStorageKey: (data.recording_storage_key as string | null) ?? null,
      recordingFormat: (data.recording_format as string | null) ?? null,
      recordingDurationMs: (data.recording_duration_ms as number | null) ?? null,
      recordingStartedAt: (data.recording_started_at as string | null) ?? null,
      recordingEndedAt: (data.recording_ended_at as string | null) ?? null,
    };
  }

  async countByShop(
    shopId: string,
    params?: CallLogsQueryParams,
  ): Promise<number> {
    let q = this.supabase
      .from('call_logs')
      .select('provider_call_id', { count: 'exact', head: true })
      .eq('shop_id', shopId);
    q = applyCallLogFilters(q, params);
    const { count, error } = await q;
    if (error) {
      throw new Error(`call_logs_count_by_shop_failed:${error.message}`);
    }
    return count ?? 0;
  }

  async countRecent(params?: CallLogsQueryParams): Promise<number> {
    let q = this.supabase.from('call_logs').select('provider_call_id', { count: 'exact', head: true });
    q = applyCallLogFilters(q, params);
    const { count, error } = await q;
    if (error) {
      throw new Error(`call_logs_count_recent_failed:${error.message}`);
    }
    return count ?? 0;
  }

  async listByShop(shopId: string, params?: CallLogsQueryParams): Promise<CallLogListItem[]> {
    const limit = params?.limit && params.limit > 0 ? params.limit : 20;
    const offset = params?.offset && params.offset > 0 ? params.offset : 0;
    let q = this.supabase
      .from('call_logs')
      .select(
        'provider,provider_call_id,shop_id,caller_phone,destination_phone,request_id,room_name,started_at,ended_at,agent_joined,human_answered,transcript_status,transcript_text,demo_live_state,outcome,is_captured_caller,captured_caller_reason,captured_at,duration_secs,summary_service_request,summary_urgency,summary_next_action,summary_caller_question,summary_caller_name,summary_preferred_tech,summary_preferred_datetime,summary_follow_up_required,recording_status,recording_provider,recording_id,recording_storage_key,recording_format,recording_duration_ms,recording_started_at,recording_ended_at',
      )
      .eq('shop_id', shopId);
    q = applyCallLogFilters(q, params);
    const { data, error } = await q.order('started_at', { ascending: false }).range(offset, offset + limit - 1);

    if (error) {
      throw new Error(`call_logs_list_by_shop_failed:${error.message}`);
    }

    return (data ?? []).map((row) => ({
      provider: row.provider as string,
      providerCallId: row.provider_call_id as string,
      shopId: row.shop_id as string,
      callerPhone: (row.caller_phone as string | null) ?? undefined,
      destinationPhone: (row.destination_phone as string | null) ?? undefined,
      requestId: (row.request_id as string | null) ?? undefined,
      roomName: (row.room_name as string | null) ?? undefined,
      startedAt: (row.started_at as string | null) ?? undefined,
      endedAt: (row.ended_at as string | null) ?? undefined,
      agentJoined: Boolean(row.agent_joined),
      humanAnswered: Boolean(row.human_answered),
      transcriptStatus: (row.transcript_status as string | null) ?? undefined,
      transcriptText: (row.transcript_text as string | null) ?? undefined,
      demoLiveState: (row.demo_live_state as string | null) ?? undefined,
      outcome: (row.outcome as string | null) ?? undefined,
      summaryServiceRequest: (row.summary_service_request as string | null) ?? null,
      summaryUrgency: (row.summary_urgency as 'low' | 'medium' | 'high' | null) ?? null,
      summaryNextAction: (row.summary_next_action as any) ?? null,
      summaryCallerQuestion: (row.summary_caller_question as string | null) ?? null,
      summaryCallerName: (row.summary_caller_name as string | null) ?? null,
      summaryPreferredTech: (row.summary_preferred_tech as string | null) ?? null,
      summaryPreferredDatetime: (row.summary_preferred_datetime as string | null) ?? null,
      summaryFollowUpRequired: Boolean(row.summary_follow_up_required),
      isCapturedCaller: Boolean(row.is_captured_caller),
      capturedCallerReason: (row.captured_caller_reason as string | null) ?? null,
      capturedAt: (row.captured_at as string | null) ?? null,
      durationSecs: Number(row.duration_secs ?? 0),
      recordingStatus: (row.recording_status as CallLogListItem['recordingStatus']) ?? 'not_requested',
      recordingProvider: (row.recording_provider as string | null) ?? null,
      recordingId: (row.recording_id as string | null) ?? null,
      recordingStorageKey: (row.recording_storage_key as string | null) ?? null,
      recordingFormat: (row.recording_format as string | null) ?? null,
      recordingDurationMs: (row.recording_duration_ms as number | null) ?? null,
      recordingStartedAt: (row.recording_started_at as string | null) ?? null,
      recordingEndedAt: (row.recording_ended_at as string | null) ?? null,
    }));
  }

  async listRecent(params?: CallLogsQueryParams): Promise<CallLogListItem[]> {
    const limit = params?.limit && params.limit > 0 ? params.limit : 20;
    const offset = params?.offset && params.offset > 0 ? params.offset : 0;
    let q = this.supabase
      .from('call_logs')
      .select(
        'provider,provider_call_id,shop_id,caller_phone,destination_phone,request_id,room_name,started_at,ended_at,agent_joined,human_answered,transcript_status,transcript_text,demo_live_state,outcome,is_captured_caller,captured_caller_reason,captured_at,duration_secs,summary_service_request,summary_urgency,summary_next_action,summary_caller_question,summary_caller_name,summary_preferred_tech,summary_preferred_datetime,summary_follow_up_required,recording_status,recording_provider,recording_id,recording_storage_key,recording_format,recording_duration_ms,recording_started_at,recording_ended_at',
      );
    q = applyCallLogFilters(q, params);
    const { data, error } = await q.order('started_at', { ascending: false }).range(offset, offset + limit - 1);

    if (error) {
      throw new Error(`call_logs_list_recent_failed:${error.message}`);
    }

    return (data ?? []).map((row) => ({
      provider: row.provider as string,
      providerCallId: row.provider_call_id as string,
      shopId: row.shop_id as string,
      callerPhone: (row.caller_phone as string | null) ?? undefined,
      destinationPhone: (row.destination_phone as string | null) ?? undefined,
      requestId: (row.request_id as string | null) ?? undefined,
      roomName: (row.room_name as string | null) ?? undefined,
      startedAt: (row.started_at as string | null) ?? undefined,
      endedAt: (row.ended_at as string | null) ?? undefined,
      agentJoined: Boolean(row.agent_joined),
      humanAnswered: Boolean(row.human_answered),
      transcriptStatus: (row.transcript_status as string | null) ?? undefined,
      transcriptText: (row.transcript_text as string | null) ?? undefined,
      demoLiveState: (row.demo_live_state as string | null) ?? undefined,
      outcome: (row.outcome as string | null) ?? undefined,
      summaryServiceRequest: (row.summary_service_request as string | null) ?? null,
      summaryUrgency: (row.summary_urgency as 'low' | 'medium' | 'high' | null) ?? null,
      summaryNextAction: (row.summary_next_action as any) ?? null,
      summaryCallerQuestion: (row.summary_caller_question as string | null) ?? null,
      summaryCallerName: (row.summary_caller_name as string | null) ?? null,
      summaryPreferredTech: (row.summary_preferred_tech as string | null) ?? null,
      summaryPreferredDatetime: (row.summary_preferred_datetime as string | null) ?? null,
      summaryFollowUpRequired: Boolean(row.summary_follow_up_required),
      isCapturedCaller: Boolean(row.is_captured_caller),
      capturedCallerReason: (row.captured_caller_reason as string | null) ?? null,
      capturedAt: (row.captured_at as string | null) ?? null,
      durationSecs: Number(row.duration_secs ?? 0),
      recordingStatus: (row.recording_status as CallLogListItem['recordingStatus']) ?? 'not_requested',
      recordingProvider: (row.recording_provider as string | null) ?? null,
      recordingId: (row.recording_id as string | null) ?? null,
      recordingStorageKey: (row.recording_storage_key as string | null) ?? null,
      recordingFormat: (row.recording_format as string | null) ?? null,
      recordingDurationMs: (row.recording_duration_ms as number | null) ?? null,
      recordingStartedAt: (row.recording_started_at as string | null) ?? null,
      recordingEndedAt: (row.recording_ended_at as string | null) ?? null,
      }));
  }

  async resolveStaleInProgressByShop(shopId: string, staleBefore: Date): Promise<number> {
    const nowIso = new Date().toISOString();
    const { data, error: readError } = await this.supabase
      .from('call_logs')
      .select('provider_call_id,started_at,transcript_text,transcript_status,outcome')
      .eq('shop_id', shopId)
      .is('ended_at', null)
      .lt('started_at', staleBefore.toISOString());

    if (readError) throw new Error(`call_logs_read_stale_failed:${readError.message}`);
    const rows = data ?? [];
    let resolved = 0;
    for (const row of rows) {
      const providerCallId = row.provider_call_id as string | null;
      const startedAt = row.started_at as string | null;
      if (!providerCallId || !startedAt) continue;
      const hasTranscript = Boolean(((row.transcript_text as string | null) ?? '').trim()) || row.transcript_status === 'completed';
      const currentOutcome = (row.outcome as string | null) ?? null;
      const nextOutcome = hasTranscript ? currentOutcome && currentOutcome !== 'in_progress' ? currentOutcome : 'completed' : 'missed';
      const durationSecs = Math.max(0, Math.round((new Date(nowIso).getTime() - new Date(startedAt).getTime()) / 1000));
      const { error } = await this.supabase
        .from('call_logs')
        .update({
          ended_at: nowIso,
          duration_secs: durationSecs,
          outcome: nextOutcome,
        })
        .eq('shop_id', shopId)
        .eq('provider_call_id', providerCallId)
        .is('ended_at', null);
      if (error) throw new Error(`call_logs_resolve_stale_failed:${error.message}`);
      resolved += 1;
    }
    return resolved;
  }


  async sumDurationSecsByShop(shopId: string, params?: CallLogsQueryParams): Promise<number> {
    let q = this.supabase
      .from('call_logs')
      .select('duration_secs')
      .eq('shop_id', shopId);
    q = applyCallLogFilters(q, params);
    const { data, error } = await q;
    if (error) throw new Error(`call_logs_sum_duration_failed:${error.message}`);
    return (data ?? []).reduce((sum, row) => sum + Number((row as { duration_secs?: number | null }).duration_secs ?? 0), 0);
  }

  async markCapturedCallerByProviderCallId(params: {
    provider: string;
    providerCallId: string;
    isCapturedCaller: boolean;
    reason?: string | null;
    capturedAt?: Date | null;
  }): Promise<void> {
    const { error } = await this.supabase
      .from('call_logs')
      .update({
        is_captured_caller: params.isCapturedCaller,
        captured_caller_reason: params.reason ?? null,
        captured_at: params.isCapturedCaller ? (params.capturedAt ?? new Date()).toISOString() : null,
      })
      .eq('provider', params.provider)
      .eq('provider_call_id', params.providerCallId);
    if (error) throw new Error(`call_logs_mark_captured_failed:${error.message}`);
  }

  async updateStructuredSummary(shopId: string, requestId: string, fields: CallStructuredSummaryFields): Promise<void> {
    const patch: Record<string, unknown> = {};
    if ('summaryServiceRequest' in fields) patch.summary_service_request = fields.summaryServiceRequest ?? null;
    if ('summaryUrgency' in fields) patch.summary_urgency = fields.summaryUrgency ?? null;
    if ('summaryNextAction' in fields) patch.summary_next_action = fields.summaryNextAction ?? null;
    if ('summaryCallerQuestion' in fields) patch.summary_caller_question = fields.summaryCallerQuestion ?? null;
    if ('summaryCallerName' in fields) patch.summary_caller_name = fields.summaryCallerName ?? null;
    if ('summaryPreferredTech' in fields) patch.summary_preferred_tech = fields.summaryPreferredTech ?? null;
    if ('summaryPreferredDatetime' in fields) patch.summary_preferred_datetime = fields.summaryPreferredDatetime ?? null;
    if ('summaryFollowUpRequired' in fields) patch.summary_follow_up_required = fields.summaryFollowUpRequired ?? false;

    if (Object.keys(patch).length === 0) return;

    const { data: current } = await this.supabase
      .from('call_logs')
      .select('provider,caller_phone,transcript_text,demo_live_state,outcome')
      .eq('shop_id', shopId)
      .eq('request_id', requestId)
      .maybeSingle<{
        provider: string | null;
        caller_phone: string | null;
        transcript_text: string | null;
        demo_live_state: string | null;
        outcome: string | null;
      }>();
    const reason = getCapturedCallerReason({
      provider: current?.provider,
      callerPhone: current?.caller_phone,
      transcriptText: current?.transcript_text,
      demoLiveState: current?.demo_live_state,
      outcome: current?.outcome,
      summaryServiceRequest: fields.summaryServiceRequest,
      summaryNextAction: fields.summaryNextAction,
      summaryCallerQuestion: fields.summaryCallerQuestion,
      summaryCallerName: fields.summaryCallerName,
      summaryPreferredTech: fields.summaryPreferredTech,
      summaryPreferredDatetime: fields.summaryPreferredDatetime,
      summaryFollowUpRequired: fields.summaryFollowUpRequired,
    });
    patch.is_captured_caller = Boolean(reason);
    patch.captured_caller_reason = reason;
    patch.captured_at = reason ? new Date().toISOString() : null;

    const { error } = await this.supabase
      .from('call_logs')
      .update(patch)
      .eq('shop_id', shopId)
      .eq('request_id', requestId);

    if (error) {
      throw new Error(`call_logs_update_structured_summary_failed:${error.message}`);
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
    const { data, error } = await this.supabase
      .from('call_logs')
      .select('caller_phone,transcript_text,transcript_status,started_at,ended_at')
      .eq('shop_id', params.shopId)
      .eq('request_id', params.requestId)
      .maybeSingle<{
        caller_phone: string | null;
        transcript_text: string | null;
        transcript_status: string | null;
        started_at: string | null;
        ended_at: string | null;
      }>();

    if (error) throw new Error(`call_logs_find_transcript_failed:${error.message}`);
    if (!data) return null;
    return {
      callerPhone: (data.caller_phone as string | null) ?? undefined,
      transcriptText: (data.transcript_text as string | null) ?? undefined,
      transcriptStatus: (data.transcript_status as string | null) ?? undefined,
      startedAt: (data.started_at as string | null) ?? undefined,
      endedAt: (data.ended_at as string | null) ?? undefined,
    };
  }

  async listTranscriptMetaByShopAndRequestIds(params: {
    shopId: string;
    requestIds: string[];
  }): Promise<Map<string, { callerPhone?: string; transcriptStatus?: string; hasTranscriptText: boolean }>> {
    const map = new Map<string, { callerPhone?: string; transcriptStatus?: string; hasTranscriptText: boolean }>();
    if (params.requestIds.length === 0) return map;
    const { data, error } = await this.supabase
      .from('call_logs')
      .select('request_id,caller_phone,transcript_status,transcript_text')
      .eq('shop_id', params.shopId)
      .in('request_id', params.requestIds);

    if (error) throw new Error(`call_logs_list_transcript_meta_failed:${error.message}`);
    for (const row of data ?? []) {
      const rid = row.request_id as string | null;
      if (!rid) continue;
      const text = (row.transcript_text as string | null) ?? '';
      map.set(rid, {
        callerPhone: (row.caller_phone as string | null) ?? undefined,
        transcriptStatus: (row.transcript_status as string | null) ?? undefined,
        hasTranscriptText: text.trim().length > 0,
      });
    }
    return map;
  }
}
