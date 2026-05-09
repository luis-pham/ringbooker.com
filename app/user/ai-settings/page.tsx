import { UserSettingsLive } from '@/components/user/user-settings-live';

export const metadata = {
  title: 'AI Settings — RingBooker',
};

export default function UserAiSettingsPage() {
  return <UserSettingsLive portal="ai-settings" />;
}
