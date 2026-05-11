import type { SupabaseClient } from '@supabase/supabase-js';

import type { BusinessKnowledgeSuggestion } from '@/src/backend/domain/types';
import type { BusinessKnowledgeSuggestionsRepository } from '@/src/backend/ports/repositories';

type SuggestionRow = {
  id: string;
  shop_id: string;
  source_url: string;
  suggestion_type: BusinessKnowledgeSuggestion['suggestionType'];
  payload_json: Record<string, unknown>;
  payload_hash: string;
  confidence: number;
  source: BusinessKnowledgeSuggestion['source'];
  evidence_snippet: string | null;
  status: BusinessKnowledgeSuggestion['status'];
  created_at: string;
  updated_at: string;
  applied_at: string | null;
  dismissed_at: string | null;
};

type CreateInput = Parameters<BusinessKnowledgeSuggestionsRepository['createPendingSuggestions']>[2][number];

function toSuggestion(row: SuggestionRow): BusinessKnowledgeSuggestion {
  return {
    id: row.id,
    shopId: row.shop_id,
    sourceUrl: row.source_url,
    suggestionType: row.suggestion_type,
    payload: row.payload_json,
    payloadHash: row.payload_hash,
    confidence: row.confidence,
    source: row.source,
    evidenceSnippet: row.evidence_snippet,
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    appliedAt: row.applied_at,
    dismissedAt: row.dismissed_at,
  };
}

export class SupabaseBusinessKnowledgeSuggestionsRepository implements BusinessKnowledgeSuggestionsRepository {
  constructor(private readonly supabase: SupabaseClient) {}

  async listPendingSuggestions(shopId: string, filters?: { suggestionType?: BusinessKnowledgeSuggestion['suggestionType'] }): Promise<BusinessKnowledgeSuggestion[]> {
    let query = this.supabase.from('business_knowledge_suggestions').select('*').eq('shop_id', shopId).eq('status', 'pending').order('created_at', { ascending: false });
    if (filters?.suggestionType) query = query.eq('suggestion_type', filters.suggestionType);
    const { data, error } = await query;
    if (error) throw error;
    return ((data ?? []) as SuggestionRow[]).map(toSuggestion);
  }

  async listByStatus(shopId: string, status: BusinessKnowledgeSuggestion['status']): Promise<BusinessKnowledgeSuggestion[]> {
    const { data, error } = await this.supabase.from('business_knowledge_suggestions').select('*').eq('shop_id', shopId).eq('status', status).order('created_at', { ascending: false });
    if (error) throw error;
    return ((data ?? []) as SuggestionRow[]).map(toSuggestion);
  }

  async dedupeSuggestions(shopId: string, sourceUrl: string, suggestionType: BusinessKnowledgeSuggestion['suggestionType'], payloadHash: string): Promise<BusinessKnowledgeSuggestion | null> {
    const { data, error } = await this.supabase.from('business_knowledge_suggestions').select('*').eq('shop_id', shopId).eq('source_url', sourceUrl).eq('suggestion_type', suggestionType).eq('payload_hash', payloadHash).eq('status', 'pending').maybeSingle();
    if (error) throw error;
    return data ? toSuggestion(data as SuggestionRow) : null;
  }

  async createPendingSuggestions(shopId: string, sourceUrl: string, suggestions: CreateInput[]): Promise<BusinessKnowledgeSuggestion[]> {
    const rows: Array<Record<string, unknown>> = [];
    for (const item of suggestions) {
      const existing = await this.dedupeSuggestions(shopId, sourceUrl, item.suggestionType, item.payloadHash);
      if (existing) continue;
      rows.push({
        shop_id: shopId,
        source_url: sourceUrl,
        suggestion_type: item.suggestionType,
        payload_json: item.payload,
        payload_hash: item.payloadHash,
        confidence: item.confidence,
        source: item.source,
        evidence_snippet: item.evidenceSnippet ?? null,
        status: 'pending',
      });
    }
    if (rows.length === 0) return [];
    const { data, error } = await this.supabase.from('business_knowledge_suggestions').insert(rows).select('*');
    if (error) throw error;
    return ((data ?? []) as SuggestionRow[]).map(toSuggestion);
  }

  async findByIds(shopId: string, ids: string[]): Promise<BusinessKnowledgeSuggestion[]> {
    if (ids.length === 0) return [];
    const { data, error } = await this.supabase.from('business_knowledge_suggestions').select('*').eq('shop_id', shopId).in('id', ids);
    if (error) throw error;
    return ((data ?? []) as SuggestionRow[]).map(toSuggestion);
  }

  async markApplied(shopId: string, ids: string[], now = new Date()): Promise<BusinessKnowledgeSuggestion[]> {
    return this.mark(shopId, ids, 'applied', now);
  }

  async markDismissed(shopId: string, ids: string[], now = new Date()): Promise<BusinessKnowledgeSuggestion[]> {
    return this.mark(shopId, ids, 'dismissed', now);
  }

  private async mark(shopId: string, ids: string[], status: 'applied' | 'dismissed', now: Date): Promise<BusinessKnowledgeSuggestion[]> {
    if (ids.length === 0) return [];
    const iso = now.toISOString();
    const patch = status === 'applied' ? { status, updated_at: iso, applied_at: iso } : { status, updated_at: iso, dismissed_at: iso };
    const { data, error } = await this.supabase.from('business_knowledge_suggestions').update(patch).eq('shop_id', shopId).eq('status', 'pending').in('id', ids).select('*');
    if (error) throw error;
    return ((data ?? []) as SuggestionRow[]).map(toSuggestion);
  }
}
