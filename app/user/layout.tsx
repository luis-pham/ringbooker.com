import { UserOnboardingGate } from '@/components/user/user-onboarding-gate';
import { UserThemeProvider } from '@/components/user/user-theme-context';
import { UserWorkspaceProvider } from '@/components/user/user-workspace-context';

export default function UserLayout({ children }: { children: React.ReactNode }) {
  return (
    <UserWorkspaceProvider>
      <UserThemeProvider>
        <UserOnboardingGate />
        {children}
      </UserThemeProvider>
    </UserWorkspaceProvider>
  );
}
