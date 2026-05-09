import { UserSettingsLive } from '@/components/user/user-settings-live';

export const metadata = {
  title: 'Settings — RingBooker',
};

export default function UserSettingsPage() {
  return <UserSettingsLive portal="settings" />;
}
