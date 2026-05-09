import { UserSettingsLive } from '@/components/user/user-settings-live';

export const metadata = {
  title: 'Integrations — RingBooker',
};

export default function UserIntegrationsPage() {
  return <UserSettingsLive portal="integrations" />;
}
