import { UserOnboardingGate } from '@/components/user/user-onboarding-gate';
import type { OnboardingStatusResponse } from '@/components/user/user-onboarding-gate';
import { UserThemeProvider } from '@/components/user/user-theme-context';
import { UserWorkspaceProvider } from '@/components/user/user-workspace-context';
import { fetchUserBackendJsonMap } from '@/app/user/server-data';

type UserNavState = {
  ok?: boolean;
  shopName?: string;
  plan?: string;
};

export default async function UserLayout({ children }: { children: React.ReactNode }) {
  const data = await fetchUserBackendJsonMap({
    nav: '/user/nav-state',
    onboarding: '/user/onboarding-status',
  });
  const navState = data.nav as UserNavState | null;
  const onboardingStatus = data.onboarding as OnboardingStatusResponse | null;
  const initialWorkspace =
    navState?.ok === true
      ? {
          shopName: navState.shopName?.trim() || undefined,
          plan: navState.plan?.trim() || undefined,
        }
      : null;

  return (
    <UserWorkspaceProvider initialWorkspace={initialWorkspace}>
      <UserThemeProvider>
        <UserOnboardingGate initialStatus={onboardingStatus} />
        {children}
      </UserThemeProvider>
    </UserWorkspaceProvider>
  );
}
