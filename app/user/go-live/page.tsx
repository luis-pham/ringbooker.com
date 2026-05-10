import { UserGoLiveLive } from '@/components/user/user-go-live-live';
import type { GoLiveBillingResponse, GoLiveStatusResponse } from '@/components/user/go-live-forwarding-panel';
import { fetchUserBackendJsonMap } from '@/app/user/server-data';

export const metadata = {
  title: 'Go live — RingBooker',
};

export default async function UserGoLivePage() {
  const data = await fetchUserBackendJsonMap({
    billing: '/user/billing',
    status: '/user/go-live/status',
  });
  return (
    <UserGoLiveLive
      initialBilling={data.billing as GoLiveBillingResponse | null}
      initialStatus={data.status as GoLiveStatusResponse | null}
    />
  );
}
