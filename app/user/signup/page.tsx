import { Suspense } from 'react';

import { UserSignupForm } from '@/components/auth/user-signup-form';

export default function UserSignupPage() {
  return (
    <Suspense fallback={null}>
      <UserSignupForm />
    </Suspense>
  );
}
