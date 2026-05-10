import { UserSettingsLive } from '@/components/user/user-settings-live';
import type { UserSettingsResponse } from '@/components/user/user-settings-live';
import { fetchUserBackendJson } from '@/app/user/server-data';

export const metadata = {
  title: 'Business Knowledge — RingBooker',
};

export default async function UserKnowledgePage() {
  const initialData = await fetchUserBackendJson<UserSettingsResponse>('/user/settings');
  return <UserSettingsLive portal="knowledge" initialData={initialData} />;
}
