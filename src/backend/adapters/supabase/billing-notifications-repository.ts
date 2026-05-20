import type { SupabaseClient } from '@supabase/supabase-js';

import type { BillingNotification } from '@/src/backend/domain/types';
import type { BillingNotificationsRepository } from '@/src/backend/ports/repositories';

type BillingNotificationRow = {
  id: string;
  shop_id: string;
  subscription_id: string | null;
  type: BillingNotification['type'];
  channel: BillingNotification['channel'];
  sent_at: string;
  metadata: Record<string, unknown> | null;
};

function toBillingNotification(row: BillingNotificationRow): BillingNotification {
  return {
    id: row.id,
    shopId: row.shop_id,
    subscriptionId: row.subscription_id,
    type: row.type,
    channel: row.channel,
    sentAt: row.sent_at,
    metadata: row.metadata,
  };
}

export class SupabaseBillingNotificationsRepository implements BillingNotificationsRepository {
  constructor(private readonly supabase: SupabaseClient) {}

  async hasSent(params: {
    shopId: string;
    subscriptionId?: string | null;
    type: BillingNotification['type'];
    channel: BillingNotification['channel'];
  }): Promise<boolean> {
    let query = this.supabase
      .from('billing_notifications')
      .select('id')
      .eq('shop_id', params.shopId)
      .eq('type', params.type)
      .eq('channel', params.channel)
      .limit(1);
    query = params.subscriptionId ? query.eq('subscription_id', params.subscriptionId) : query.is('subscription_id', null);
    const { data, error } = await query.maybeSingle<{ id: string }>();
    if (error) throw new Error(`billing_notifications_has_sent_failed:${error.message}`);
    return Boolean(data);
  }

  async markSent(params: {
    shopId: string;
    subscriptionId?: string | null;
    type: BillingNotification['type'];
    channel: BillingNotification['channel'];
    metadata?: Record<string, unknown> | null;
  }): Promise<BillingNotification> {
    const already = await this.hasSent(params);
    if (already) {
      let query = this.supabase
        .from('billing_notifications')
        .select('*')
        .eq('shop_id', params.shopId)
        .eq('type', params.type)
        .eq('channel', params.channel)
        .limit(1);
      query = params.subscriptionId ? query.eq('subscription_id', params.subscriptionId) : query.is('subscription_id', null);
      const { data, error } = await query.single<BillingNotificationRow>();
      if (error) throw new Error(`billing_notifications_mark_sent_fetch_failed:${error.message}`);
      return toBillingNotification(data);
    }

    const { data, error } = await this.supabase
      .from('billing_notifications')
      .insert({
        shop_id: params.shopId,
        subscription_id: params.subscriptionId ?? null,
        type: params.type,
        channel: params.channel,
        metadata: params.metadata ?? {},
      })
      .select('*')
      .single<BillingNotificationRow>();
    if (error) throw new Error(`billing_notifications_mark_sent_failed:${error.message}`);
    return toBillingNotification(data);
  }

  async listRecentEmailSent(params?: { limit?: number }): Promise<BillingNotification[]> {
    const limit = params?.limit ?? 20;
    const { data, error } = await this.supabase
      .from('billing_notifications')
      .select('*')
      .eq('channel', 'email')
      .order('sent_at', { ascending: false })
      .limit(limit);
    if (error) throw new Error(`billing_notifications_list_recent_failed:${error.message}`);
    return (data ?? []).map((row) => toBillingNotification(row as BillingNotificationRow));
  }
}
