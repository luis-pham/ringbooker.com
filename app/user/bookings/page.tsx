import { UserBookingsLive } from '@/components/user/user-bookings-live';
import type { BookingsResponse } from '@/components/user/user-bookings-live';
import { fetchUserBackendJson } from '@/app/user/server-data';

export const metadata = {
  title: 'Bookings and calendar flow.',
};

export default async function UserBookingsPage() {
  const initialData = await fetchUserBackendJson<BookingsResponse>('/user/bookings');
  return <UserBookingsLive initialData={initialData} />;
}
