import { randomUUID } from 'node:crypto';

import type { BusinessKnowledgeSuggestion, BusinessKnowledgeSuggestionStatus } from '@/src/backend/domain/types';
import type { BusinessKnowledgeSuggestionsRepository } from '@/src/backend/ports/repositories';

type CreateInput = Parameters<BusinessKnowledgeSuggestionsRepository['createPendingSuggestions']>[2][number];

function cloneSuggestion(item: BusinessKnowledgeSuggestion): BusinessKnowledgeSuggestion {
  return { ...item, payload: JSON.parse(JSON.stringify(item.payload)) as Record<string, unknown> };
}

export class InMemoryBusinessKnowledgeSuggestionsRepository implements BusinessKnowledgeSuggestionsRepository {
  private readonly suggestions = new Map<string, BusinessKnowledgeSuggestion>();

  async listPendingSuggestions(shopId: string, filters?: { suggestionType?: BusinessKnowledgeSuggestion['suggestionType'] }): Promise<BusinessKnowledgeSuggestion[]> {
    return [...this.suggestions.values()]
      .filter((item) => item.shopId === shopId && item.status === 'pending' && (!filters?.suggestionType || item.suggestionType === filters.suggestionType))
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .map(cloneSuggestion);
  }

  async listByStatus(shopId: string, status: BusinessKnowledgeSuggestionStatus): Promise<BusinessKnowledgeSuggestion[]> {
    return [...this.suggestions.values()].filter((item) => item.shopId === shopId && item.status === status).map(cloneSuggestion);
  }

  async dedupeSuggestions(shopId: string, sourceUrl: string, suggestionType: BusinessKnowledgeSuggestion['suggestionType'], payloadHash: string): Promise<BusinessKnowledgeSuggestion | null> {
    const existing = [...this.suggestions.values()].find((item) => item.shopId === shopId && item.sourceUrl === sourceUrl && item.suggestionType === suggestionType && item.payloadHash === payloadHash && item.status === 'pending');
    return existing ? cloneSuggestion(existing) : null;
  }

  async createPendingSuggestions(shopId: string, sourceUrl: string, suggestions: CreateInput[]): Promise<BusinessKnowledgeSuggestion[]> {
    const now = new Date().toISOString();
    const created: BusinessKnowledgeSuggestion[] = [];
    for (const input of suggestions) {
      const existing = await this.dedupeSuggestions(shopId, sourceUrl, input.suggestionType, input.payloadHash);
      if (existing) continue;
      const item: BusinessKnowledgeSuggestion = {
        id: randomUUID(),
        shopId,
        sourceUrl,
        suggestionType: input.suggestionType,
        payload: JSON.parse(JSON.stringify(input.payload)) as Record<string, unknown>,
        payloadHash: input.payloadHash,
        confidence: Math.max(0, Math.min(1, input.confidence)),
        source: input.source,
        evidenceSnippet: input.evidenceSnippet ?? null,
        status: 'pending',
        createdAt: now,
        updatedAt: now,
        appliedAt: null,
        dismissedAt: null,
      };
      this.suggestions.set(item.id, item);
      created.push(cloneSuggestion(item));
    }
    return created;
  }

  async findByIds(shopId: string, ids: string[]): Promise<BusinessKnowledgeSuggestion[]> {
    const idSet = new Set(ids);
    return [...this.suggestions.values()].filter((item) => item.shopId === shopId && idSet.has(item.id)).map(cloneSuggestion);
  }

  async markApplied(shopId: string, ids: string[], now = new Date()): Promise<BusinessKnowledgeSuggestion[]> {
    return this.mark(shopId, ids, 'applied', now);
  }

  async markDismissed(shopId: string, ids: string[], now = new Date()): Promise<BusinessKnowledgeSuggestion[]> {
    return this.mark(shopId, ids, 'dismissed', now);
  }

  private async mark(shopId: string, ids: string[], status: 'applied' | 'dismissed', now: Date): Promise<BusinessKnowledgeSuggestion[]> {
    const iso = now.toISOString();
    const updated: BusinessKnowledgeSuggestion[] = [];
    for (const id of ids) {
      const item = this.suggestions.get(id);
      if (!item || item.shopId !== shopId || item.status !== 'pending') continue;
      const next: BusinessKnowledgeSuggestion = { ...item, status, updatedAt: iso, appliedAt: status === 'applied' ? iso : item.appliedAt ?? null, dismissedAt: status === 'dismissed' ? iso : item.dismissedAt ?? null };
      this.suggestions.set(id, next);
      updated.push(cloneSuggestion(next));
    }
    return updated;
  }
}
