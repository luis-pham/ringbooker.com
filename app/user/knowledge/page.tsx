import { UserSettingsLive } from '@/components/user/user-settings-live';

export const metadata = {
  title: 'Business Knowledge — RingBooker',
};

export default function UserKnowledgePage() {
  return <UserSettingsLive portal="knowledge" />;
}
