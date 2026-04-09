import { redirect } from 'next/navigation';

export const metadata = {
  title: 'RingBooker User Login',
};

export default function LoginPage() {
  redirect('/user/login');
}
