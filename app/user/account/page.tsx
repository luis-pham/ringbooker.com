import { UserAccountLive } from '@/components/user/user-account-live';
import type { NavStateResponse } from '@/components/user/user-account-live';
import { fetchUserBackendJson } from '@/app/user/server-data';

export const metadata = {
  title: 'Account · RingBooker',
};

export default async function UserAccountPage() {
  const initialNav = await fetchUserBackendJson<NavStateResponse>('/user/nav-state');
  return <UserAccountLive initialNav={initialNav} />;
}
