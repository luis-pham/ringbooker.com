import { UserLoginForm } from '@/components/auth/user-login-form';

export const metadata = {
  title: 'RingBooker User Login',
  robots: { index: false, follow: true },
};

export default function UserLoginPage() {
  return <UserLoginForm />;
}
