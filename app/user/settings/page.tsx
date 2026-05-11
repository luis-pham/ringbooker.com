import { redirect } from 'next/navigation';

/** Canonical settings surface is Business Knowledge. */
export default function UserSettingsLegacyRedirectPage() {
  redirect('/user/knowledge');
}
