import { Suspense } from 'react';

import { UserBookingsLive } from '@/components/user/user-bookings-live';
import type { BookingsResponse } from '@/components/user/user-bookings-live';
import { fetchUserBackendJson } from '@/app/user/server-data';

export const metadata = {
  title: 'Bookings',
};

export default async function UserBookingsPage() {
  const initialData = await fetchUserBackendJson<BookingsResponse>('/user/bookings');
  return (
    <Suspense fallback={null}>
      <UserBookingsLive initialData={initialData} />
    </Suspense>
  );
}
