import { UserDashboardLive } from '@/components/user/user-dashboard-live';
import type { UserDashboardResponse } from '@/components/user/user-dashboard-live';
import { fetchUserBackendJson } from '@/app/user/server-data';

export const metadata = {
  title: 'Overview',
};

export default async function UserDashboardPage() {
  const initialData = await fetchUserBackendJson<UserDashboardResponse>('/user/dashboard');
  return <UserDashboardLive initialData={initialData} />;
}
