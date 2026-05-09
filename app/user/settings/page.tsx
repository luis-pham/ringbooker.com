import { redirect } from 'next/navigation';

/** Canonical AI Settings URL is `/user/ai-settings`. */
export default function UserSettingsLegacyRedirectPage() {
  redirect('/user/ai-settings');
}
