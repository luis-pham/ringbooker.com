import { redirect } from 'next/navigation';

export const metadata = {
  title: 'RingBooker User Login',
  robots: { index: false, follow: true },
};

export default function LoginPage() {
  redirect('/user/login');
}
