import { Suspense } from 'react';

import { UserCallsLive } from '@/components/user/user-calls-live';
import type { CallsResponse, IntentSummaryResponse } from '@/components/user/user-calls-live';
import { fetchUserBackendJsonMap } from '@/app/user/server-data';

export const metadata = {
  title: 'Calls, transcripts, and missed revenue recovery.',
};

export default async function UserCallsPage() {
  const data = await fetchUserBackendJsonMap({
    calls: '/user/calls',
    summary: '/user/calls/summary',
  });
  return (
    <Suspense fallback={null}>
      <UserCallsLive
        initialData={data.calls as CallsResponse | null}
        initialIntentSummary={data.summary as IntentSummaryResponse | null}
      />
    </Suspense>
  );
}
