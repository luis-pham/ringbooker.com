import type {
  BillingInterval,
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
    internalSubscriptionId?: string | null;
    trialEndsAt?: string | null;
    billingInterval?: BillingInterval;
    source?: string;
    checkoutUrl: string;
    successUrl: string;
    cancelUrl: string;
  }): Promise<BillingCheckoutSession & { trialConfigVerified?: boolean }>;
  createManageBillingSession?(params: {
    shop: Shop;
    providerCustomerId: string;
    providerSubscriptionId: string;
  }): Promise<{
    provider: BillingProvider;
    manageUrl: string;
    providerPortalSessionId?: string | null;
    canViewInvoicesViaPortal?: boolean;
    canUpdatePaymentMethodViaPortal?: boolean;
    canCancelViaPortal?: boolean;
  }>;
  syncWebhookEvent(params: {
    eventType: string;
    payload: Record<string, unknown>;
  }): Promise<BillingWebhookSyncResult | null>;
}
