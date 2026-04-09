'use client';

import { useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';

type OnboardingStatusResponse = {
  ok: boolean;
  onboardingRequired?: boolean;
  error?: string;
};

function isPublicUserAuthPath(pathname: string): boolean {
  return (
    pathname === '/user/login' ||
    pathname === '/user/signup' ||
    pathname === '/user/forgot-password' ||
    pathname === '/user/reset-password'
  );
}

export function UserOnboardingGate() {
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    if (!pathname.startsWith('/user')) return;
    if (isPublicUserAuthPath(pathname)) return;

    let canceled = false;
    void fetch('/api/backend/user/onboarding-status')
      .then(async (response) => {
        if (response.status === 401) {
          if (!canceled) router.replace('/user/login');
          return null;
        }
        return (await response.json()) as OnboardingStatusResponse;
      })
      .then((body) => {
        if (canceled || !body?.ok) return;
        const onboardingRequired = body.onboardingRequired === true;
        const isOnboardingPage = pathname === '/user/onboarding';
        if (onboardingRequired && !isOnboardingPage) {
          router.replace('/user/onboarding');
          return;
        }
        if (!onboardingRequired && isOnboardingPage) {
          router.replace('/user');
        }
      })
      .catch(() => undefined);

    return () => {
      canceled = true;
    };
  }, [pathname, router]);

  return null;
}
