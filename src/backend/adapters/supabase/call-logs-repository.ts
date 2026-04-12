import type { SupabaseClient } from '@supabase/supabase-js';

import type { CallLogsRepository } from '@/src/backend/ports/repositories';
import { observeDurationMs } from '@/src/backend/observability/metrics';

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
    const { error } = await this.supabase
      .from('call_logs')
      .update({
        transcript_status: 'pending',
        transcript_text: nextTranscript,
      })
      .eq('shop_id', params.shopId)
      .eq('request_id', params.requestId);

    if (error) {
      throw new Error(`call_logs_append_transcript_failed:${error.message}`);
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
      .select('started_at,outcome')
      .eq('provider', params.provider)
      .eq('provider_call_id', params.providerCallId)
      .maybeSingle<{ started_at: string | null; outcome: string | null }>();
    if (currentError) {
      throw new Error(`call_logs_get_started_at_failed:${currentError.message}`);
    }

    const { error } = await this.supabase
      .from('call_logs')
      .update({
        ended_at: params.endedAt.toISOString(),
        outcome: params.outcome,
        human_answered: params.humanAnswered,
      })
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

  async listByShop(
    shopId: string,
    params?: { limit?: number; startedAfter?: Date; startedBefore?: Date },
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
    let q = this.supabase
      .from('call_logs')
      .select(
        'provider,provider_call_id,shop_id,caller_phone,destination_phone,request_id,room_name,started_at,ended_at,agent_joined,human_answered,transcript_status,transcript_text,demo_live_state,outcome',
      )
      .eq('shop_id', shopId);
    if (params?.startedAfter) q = q.gte('started_at', params.startedAfter.toISOString());
    if (params?.startedBefore) q = q.lte('started_at', params.startedBefore.toISOString());
    const { data, error } = await q.order('started_at', { ascending: false }).limit(limit);

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
    }));
  }

  async listRecent(params?: { limit?: number; startedAfter?: Date; startedBefore?: Date }): Promise<
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
    let q = this.supabase
      .from('call_logs')
      .select(
        'provider,provider_call_id,shop_id,caller_phone,destination_phone,request_id,room_name,started_at,ended_at,agent_joined,human_answered,transcript_status,transcript_text,demo_live_state,outcome',
      );
    if (params?.startedAfter) q = q.gte('started_at', params.startedAfter.toISOString());
    if (params?.startedBefore) q = q.lte('started_at', params.startedBefore.toISOString());
    const { data, error } = await q.order('started_at', { ascending: false }).limit(limit);

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
    const { data, error } = await this.supabase
      .from('call_logs')
      .select('transcript_text,transcript_status,started_at,ended_at')
      .eq('shop_id', params.shopId)
      .eq('request_id', params.requestId)
      .maybeSingle<{
        transcript_text: string | null;
        transcript_status: string | null;
        started_at: string | null;
        ended_at: string | null;
      }>();

    if (error) throw new Error(`call_logs_find_transcript_failed:${error.message}`);
    if (!data) return null;
    return {
      transcriptText: (data.transcript_text as string | null) ?? undefined,
      transcriptStatus: (data.transcript_status as string | null) ?? undefined,
      startedAt: (data.started_at as string | null) ?? undefined,
      endedAt: (data.ended_at as string | null) ?? undefined,
    };
  }

  async listTranscriptMetaByShopAndRequestIds(params: {
    shopId: string;
    requestIds: string[];
  }): Promise<Map<string, { transcriptStatus?: string; hasTranscriptText: boolean }>> {
    const map = new Map<string, { transcriptStatus?: string; hasTranscriptText: boolean }>();
    if (params.requestIds.length === 0) return map;
    const { data, error } = await this.supabase
      .from('call_logs')
      .select('request_id,transcript_status,transcript_text')
      .eq('shop_id', params.shopId)
      .in('request_id', params.requestIds);

    if (error) throw new Error(`call_logs_list_transcript_meta_failed:${error.message}`);
    for (const row of data ?? []) {
      const rid = row.request_id as string | null;
      if (!rid) continue;
      const text = (row.transcript_text as string | null) ?? '';
      map.set(rid, {
        transcriptStatus: (row.transcript_status as string | null) ?? undefined,
        hasTranscriptText: text.trim().length > 0,
      });
    }
    return map;
  }
}
