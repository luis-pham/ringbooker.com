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

export type BillingTransactionRecord = {
  id: string;
  date: string;
  description: string;
  amount: number;
  currency: string;
  status: string;
  type: 'payment' | 'invoice' | 'refund' | 'credit' | 'unknown';
  billingPeriodStart?: string;
  billingPeriodEnd?: string;
  invoiceNumber?: string;
  invoiceUrl?: string;
  receiptUrl?: string;
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
  upgradeSubscriptionPlan?(params: {
    shop: Shop;
    providerCustomerId: string;
    providerSubscriptionId: string;
    targetPlan: Extract<Shop['plan'], 'starter' | 'professional'>;
    billingInterval: BillingInterval;
    prorationBillingMode: 'prorated_next_billing_period';
  }): Promise<{
    provider: BillingProvider;
    providerSubscriptionId: string;
    targetPlan: Extract<Shop['plan'], 'starter' | 'professional'>;
    billingInterval: BillingInterval;
    prorationBillingMode: 'prorated_next_billing_period';
  }>;
  listBillingTransactions?(params: {
    providerCustomerId: string;
    providerSubscriptionId?: string | null;
    limit?: number;
    after?: string | null;
    before?: string | null;
  }): Promise<{
    provider: BillingProvider;
    transactions: BillingTransactionRecord[];
    hasMore?: boolean;
    nextCursor?: string | null;
  }>;
  chargeOverage?(params: {
    providerSubscriptionId: string;
    amountCents: number;
    description: string;
  }): Promise<{ providerTransactionId: string }>;
  syncWebhookEvent(params: {
    eventType: string;
    payload: Record<string, unknown>;
  }): Promise<BillingWebhookSyncResult | null>;
}
