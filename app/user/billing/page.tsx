import { UserBillingLive } from '@/components/user/user-billing-live';
import type { BillingTransactionsResponse, UserBillingResponse } from '@/components/user/user-billing-live';
import type { GoLiveStatusResponse } from '@/components/user/go-live-forwarding-panel';
import { fetchUserBackendJsonMap } from '@/app/user/server-data';

export const metadata = {
  title: 'Billing, plan, and growth options.',
};

export default async function UserBillingPage() {
  const data = await fetchUserBackendJsonMap({
    billing: '/user/billing',
    transactions: '/user/billing/transactions',
    goLiveStatus: '/user/go-live/status',
  });
  return (
    <UserBillingLive
      initialData={data.billing as UserBillingResponse | null}
      initialTransactions={data.transactions as BillingTransactionsResponse | null}
      initialGoLiveStatus={data.goLiveStatus as GoLiveStatusResponse | null}
    />
  );
}
