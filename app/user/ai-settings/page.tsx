import { UserSettingsLive } from '@/components/user/user-settings-live';
import type { UserSettingsResponse } from '@/components/user/user-settings-live';
import { fetchUserBackendJson } from '@/app/user/server-data';

export const metadata = {
  title: 'AI Settings — RingBooker',
};

export default async function UserAiSettingsPage() {
  const initialData = await fetchUserBackendJson<UserSettingsResponse>('/user/settings');
  return <UserSettingsLive portal="ai-settings" initialData={initialData} />;
}
