import { UserOnboardingGate } from '@/components/user/user-onboarding-gate';
import { UserWorkspaceProvider } from '@/components/user/user-workspace-context';

export default function UserLayout({ children }: { children: React.ReactNode }) {
  return (
    <UserWorkspaceProvider>
      <UserOnboardingGate />
      {children}
    </UserWorkspaceProvider>
  );
}
