import type { SupabaseClient } from '@supabase/supabase-js';

import type { VoiceCallLegPurpose, VoiceCallLegRecord } from '@/src/backend/domain/voice-call-leg';
import type { VoiceCallLegsRepository } from '@/src/backend/ports/repositories';

type Row = {
  id: string;
  rb_call_id: string;
  shop_id: string;
  purpose: string;
  call_control_id: string | null;
  call_session_id: string | null;
  call_leg_id: string | null;
  parent_call_control_id: string | null;
  parent_call_session_id: string | null;
  status: string;
  provider: string;
  client_state: unknown | null;
  metadata: unknown | null;
  created_at: string;
  updated_at: string;
};

function toRecord(row: Row): VoiceCallLegRecord {
  return {
    id: row.id,
    rbCallId: row.rb_call_id,
    shopId: row.shop_id,
    purpose: row.purpose as VoiceCallLegPurpose,
    callControlId: row.call_control_id,
    callSessionId: row.call_session_id,
    callLegId: row.call_leg_id,
    parentCallControlId: row.parent_call_control_id,
    parentCallSessionId: row.parent_call_session_id,
    status: row.status,
    provider: row.provider,
    clientState: row.client_state,
    metadata: row.metadata,
    createdAt: new Date(row.created_at),
    updatedAt: new Date(row.updated_at),
  };
}

export class SupabaseVoiceCallLegsRepository implements VoiceCallLegsRepository {
  constructor(private readonly supabase: SupabaseClient) {}

  async createOrUpdateCallLeg(params: {
    shopId: string;
    rbCallId: string;
    purpose: VoiceCallLegPurpose;
    callControlId?: string | null;
    callSessionId?: string | null;
    callLegId?: string | null;
    parentCallControlId?: string | null;
    parentCallSessionId?: string | null;
    status: string;
    clientState?: unknown | null;
    metadata?: unknown | null;
  }): Promise<VoiceCallLegRecord> {
    const now = new Date().toISOString();
    const payload = {
      rb_call_id: params.rbCallId,
      shop_id: params.shopId,
      purpose: params.purpose,
      call_control_id: params.callControlId ?? null,
      call_session_id: params.callSessionId ?? null,
      call_leg_id: params.callLegId ?? null,
      parent_call_control_id: params.parentCallControlId ?? null,
      parent_call_session_id: params.parentCallSessionId ?? null,
      status: params.status,
      provider: 'telnyx_call_control',
      client_state: params.clientState ?? null,
      metadata: params.metadata ?? null,
      updated_at: now,
    };

    const { data, error } = await this.supabase
      .from('voice_call_legs')
      .upsert(payload, { onConflict: 'shop_id,rb_call_id,purpose' })
      .select()
      .single();

    if (error) throw new Error(`voice_call_legs_upsert_failed:${error.message}`);
    return toRecord(data as Row);
  }

  async findCallLegByCallControlId(callControlId: string): Promise<VoiceCallLegRecord | null> {
    const { data, error } = await this.supabase
      .from('voice_call_legs')
      .select('*')
      .eq('call_control_id', callControlId)
      .maybeSingle();
    if (error) throw new Error(`voice_call_legs_find_cc_failed:${error.message}`);
    return data ? toRecord(data as Row) : null;
  }

  async findOpenAiLegByRbCallId(shopId: string, rbCallId: string): Promise<VoiceCallLegRecord | null> {
    const { data, error } = await this.supabase
      .from('voice_call_legs')
      .select('*')
      .eq('shop_id', shopId)
      .eq('rb_call_id', rbCallId)
      .eq('purpose', 'openai_sip_leg')
      .maybeSingle();
    if (error) throw new Error(`voice_call_legs_find_openai_rb_failed:${error.message}`);
    return data ? toRecord(data as Row) : null;
  }

  async findOpenAiLegByParentCallControlId(parentCallControlId: string): Promise<VoiceCallLegRecord | null> {
    const { data, error } = await this.supabase
      .from('voice_call_legs')
      .select('*')
      .eq('purpose', 'openai_sip_leg')
      .eq('parent_call_control_id', parentCallControlId)
      .order('updated_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) throw new Error(`voice_call_legs_find_openai_parent_failed:${error.message}`);
    return data ? toRecord(data as Row) : null;
  }

  async findActiveOpenAiLegCallControlIdByRbCallId(shopId: string, rbCallId: string): Promise<string | null> {
    const { data, error } = await this.supabase
      .from('voice_call_legs')
      .select('call_control_id,status')
      .eq('shop_id', shopId)
      .eq('rb_call_id', rbCallId)
      .eq('purpose', 'openai_sip_leg')
      .neq('status', 'openai_leg_ended')
      .not('call_control_id', 'is', null)
      .order('updated_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) throw new Error(`voice_call_legs_find_active_openai_rb_failed:${error.message}`);
    if (!data?.call_control_id) return null;
    return String(data.call_control_id);
  }

  async findActiveOpenAiLegCallControlIdByParent(parentCallControlId: string): Promise<string | null> {
    const { data, error } = await this.supabase
      .from('voice_call_legs')
      .select('call_control_id,status')
      .eq('purpose', 'openai_sip_leg')
      .eq('parent_call_control_id', parentCallControlId)
      .neq('status', 'openai_leg_ended')
      .not('call_control_id', 'is', null)
      .order('updated_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) throw new Error(`voice_call_legs_find_active_openai_parent_failed:${error.message}`);
    if (!data?.call_control_id) return null;
    return String(data.call_control_id);
  }

  async markCallLegStatus(params: {
    shopId: string;
    rbCallId: string;
    purpose: VoiceCallLegPurpose;
    status: string;
    callControlId?: string | null;
    callSessionId?: string | null;
  }): Promise<void> {
    const patch: Record<string, unknown> = {
      status: params.status,
      updated_at: new Date().toISOString(),
    };
    if (params.callControlId !== undefined) patch.call_control_id = params.callControlId;
    if (params.callSessionId !== undefined) patch.call_session_id = params.callSessionId;

    const { error } = await this.supabase
      .from('voice_call_legs')
      .update(patch)
      .eq('shop_id', params.shopId)
      .eq('rb_call_id', params.rbCallId)
      .eq('purpose', params.purpose);
    if (error) throw new Error(`voice_call_legs_mark_status_failed:${error.message}`);
  }

  async markCallLegEnded(callControlId: string, purpose?: VoiceCallLegPurpose): Promise<void> {
    const p = purpose ?? 'openai_sip_leg';
    const terminal =
      p === 'openai_sip_leg' ? 'openai_leg_ended' : p === 'parent_caller_leg' ? 'parent_leg_ended' : 'owner_leg_ended';
    const { error } = await this.supabase
      .from('voice_call_legs')
      .update({
        status: terminal,
        updated_at: new Date().toISOString(),
      })
      .eq('call_control_id', callControlId)
      .eq('purpose', p);
    if (error) throw new Error(`voice_call_legs_mark_ended_failed:${error.message}`);
  }
}
