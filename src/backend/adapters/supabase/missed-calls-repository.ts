import type { SupabaseClient } from '@supabase/supabase-js';

import type { MissedCallsRepository } from '@/src/backend/ports/repositories';

function toHourBucketIso(date: Date): string {
  const bucket = new Date(date);
  bucket.setUTCMinutes(0, 0, 0);
  return bucket.toISOString();
}

export class SupabaseMissedCallsRepository implements MissedCallsRepository {
  constructor(private readonly supabase: SupabaseClient) {}

  async createOncePerHour(params: {
    shopId: string;
    callerPhone: string;
    callLogProviderCallId?: string;
    createdAt?: Date;
  }): Promise<{ created: boolean }> {
    const createdAt = params.createdAt ?? new Date();
    const dedupeBucket = toHourBucketIso(createdAt);
    const { error } = await this.supabase.from('missed_calls').insert(
      {
        shop_id: params.shopId,
        caller_phone: params.callerPhone,
        call_log_provider_call_id: params.callLogProviderCallId ?? null,
        dedupe_bucket: dedupeBucket,
        created_at: createdAt.toISOString(),
      },
    );

    if (error) {
      if (error.code === '23505') {
        return { created: false };
      }
      throw new Error(`missed_calls_create_once_failed:${error.message}`);
    }
    return { created: true };
  }
}
