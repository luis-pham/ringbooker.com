import { UserBillingLive } from '@/components/user/user-billing-live';
import type { BillingTransactionsResponse, UserBillingResponse } from '@/components/user/user-billing-live';
import { fetchUserBackendJsonMap } from '@/app/user/server-data';

export const metadata = {
  title: 'Billing, plan, and growth options.',
};

export default async function UserBillingPage() {
  const data = await fetchUserBackendJsonMap({
    billing: '/user/billing',
    transactions: '/user/billing/transactions',
  });
  return (
    <UserBillingLive
      initialData={data.billing as UserBillingResponse | null}
      initialTransactions={data.transactions as BillingTransactionsResponse | null}
    />
  );
}
