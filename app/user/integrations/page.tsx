import { UserSettingsLive } from '@/components/user/user-settings-live';
import type { UserSettingsResponse } from '@/components/user/user-settings-live';
import { fetchUserBackendJson } from '@/app/user/server-data';

export const metadata = {
  title: 'Integrations — RingBooker',
};

export default async function UserIntegrationsPage() {
  const initialData = await fetchUserBackendJson<UserSettingsResponse>('/user/settings');
  return <UserSettingsLive portal="integrations" initialData={initialData} />;
}
