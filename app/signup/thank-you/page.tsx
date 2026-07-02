import { Suspense } from 'react';

import { SignupThankYou } from '@/components/auth/signup-thank-you';

export const metadata = {
  title: 'Account created.',
};

export default function SignupThankYouPage() {
  return (
    <Suspense fallback={null}>
      <SignupThankYou />
    </Suspense>
  );
}
