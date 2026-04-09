import { UserOnboardingGate } from '@/components/user/user-onboarding-gate';

export default function UserLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <UserOnboardingGate />
      {children}
    </>
  );
}
