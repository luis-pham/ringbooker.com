import type { CallbackRecord, CallbacksRepository } from '@/src/backend/ports/repositories';
import { randomUUID } from 'node:crypto';

export class InMemoryCallbacksRepository implements CallbacksRepository {
  private readonly callbacks = new Map<string, CallbackRecord>();

  async create(params: {
    shopId: string;
    customerPhone: string;
    customerName?: string | null;
    reason: string;
    requestId?: string;
  }): Promise<CallbackRecord> {
    void params.requestId;
    const callback: CallbackRecord = {
      id: randomUUID(),
      shopId: params.shopId,
      customerPhone: params.customerPhone,
      customerName: params.customerName ?? null,
      reason: params.reason,
      status: 'queued',
      attemptCount: 0,
    };
    this.callbacks.set(callback.id, callback);
    return callback;
  }

  async findById(callbackId: string): Promise<CallbackRecord | null> {
    return this.callbacks.get(callbackId) ?? null;
  }

  async markAttempt(callbackId: string, params: { nextAttemptAt?: Date }): Promise<void> {
    void params;
    const callback = this.callbacks.get(callbackId);
    if (!callback) return;
    callback.attemptCount += 1;
    callback.status = 'dialing';
  }

  async markQueued(callbackId: string, params: { nextAttemptAt: Date }): Promise<void> {
    void params;
    const callback = this.callbacks.get(callbackId);
    if (!callback) return;
    callback.status = 'queued';
  }

  async markCompleted(callbackId: string): Promise<void> {
    const callback = this.callbacks.get(callbackId);
    if (!callback) return;
    callback.status = 'completed';
  }

  async markFailed(callbackId: string): Promise<void> {
    const callback = this.callbacks.get(callbackId);
    if (!callback) return;
    callback.status = 'failed';
  }
}
