import { UserOnboardingGate } from '@/components/user/user-onboarding-gate';
import type { OnboardingStatusResponse } from '@/components/user/user-onboarding-gate';
import { EmailVerificationBanner } from '@/components/user/email-verification-banner';
import { UserPortalToastProvider } from '@/components/user/user-portal-toast';
import { UserRouteBoundary } from '@/components/user/user-route-boundary';
import { UserThemeProvider } from '@/components/user/user-theme-context';
import { UserWorkspaceProvider } from '@/components/user/user-workspace-context';
import { fetchUserBackendJsonMap } from '@/app/user/server-data';

type UserNavState = {
  ok?: boolean;
  shopName?: string;
  plan?: string;
};

type AuthMeState = {
  ok?: boolean;
  session?: {
    emailVerified?: boolean;
  };
};

export default async function UserLayout({ children }: { children: React.ReactNode }) {
  const data = await fetchUserBackendJsonMap({
    auth: '/auth/me',
    nav: '/user/nav-state',
    onboarding: '/user/onboarding-status',
  });
  const authState = data.auth as AuthMeState | null;
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
        <UserPortalToastProvider>
          <UserOnboardingGate initialStatus={onboardingStatus} />
          <EmailVerificationBanner initialEmailVerified={authState?.session?.emailVerified} />
          <UserRouteBoundary>{children}</UserRouteBoundary>
        </UserPortalToastProvider>
      </UserThemeProvider>
    </UserWorkspaceProvider>
  );
}
