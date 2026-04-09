import type {
  BillingCheckoutSession,
  BillingCustomer,
  BillingProvider,
  BillingSubscription,
  Shop,
} from '@/src/backend/domain/types';

export type BillingWebhookSyncResult = {
  provider: BillingProvider;
  shopId: string;
  customer?: BillingCustomer | null;
  subscription?: BillingSubscription | null;
  shopPlanChanged: boolean;
};

export interface BillingProviderAdapter {
  readonly provider: BillingProvider;
  createCheckoutSession(params: {
    shop: Shop;
    plan: Shop['plan'];
    email?: string | null;
    successUrl: string;
    cancelUrl: string;
  }): Promise<BillingCheckoutSession>;
  syncWebhookEvent(params: {
    eventType: string;
    payload: Record<string, unknown>;
  }): Promise<BillingWebhookSyncResult | null>;
}
