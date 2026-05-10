import { UserOnboardingLive } from '@/components/user/user-onboarding-live';
import type { OnboardingStatusResponse } from '@/components/user/user-onboarding-live';
import { fetchUserBackendJson } from '@/app/user/server-data';

export const metadata = {
  title: 'Complete your setup.',
};

export default async function UserOnboardingPage() {
  const initialData = await fetchUserBackendJson<OnboardingStatusResponse>('/user/onboarding-status');
  return <UserOnboardingLive initialData={initialData} />;
}
