import type { MissedCallsRepository } from '@/src/backend/ports/repositories';

function toHourBucketIso(date: Date): string {
  const bucket = new Date(date);
  bucket.setUTCMinutes(0, 0, 0);
  return bucket.toISOString();
}

export class InMemoryMissedCallsRepository implements MissedCallsRepository {
  private readonly seen = new Set<string>();

  async createOncePerHour(params: {
    shopId: string;
    callerPhone: string;
    callLogProviderCallId?: string;
    createdAt?: Date;
  }): Promise<{ created: boolean }> {
    const key = `${params.shopId}:${params.callerPhone}:${toHourBucketIso(params.createdAt ?? new Date())}`;
    if (this.seen.has(key)) {
      return { created: false };
    }
    this.seen.add(key);
    return { created: true };
  }
}
