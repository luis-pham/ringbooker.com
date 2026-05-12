'use client';

import { UserLayout } from '@/components/user/user-layout';
import { GoLiveForwardingPanel } from '@/components/user/go-live-forwarding-panel';
import type { GoLiveBillingResponse, GoLiveStatusResponse } from '@/components/user/go-live-forwarding-panel';
import { UserPortalMobileTabbar } from '@/components/user/user-portal-mobile-tabbar';
import { UserPortalSidebar } from '@/components/user/user-portal-sidebar';
import {
  USER_PORTAL_TOPBAR_ACTIONS_CLASS,
  UserPortalStandardTopActions,
} from '@/components/user/user-portal-standard-top-actions';
import { UserPortalTopbar } from '@/components/user/user-portal-topbar';
import { UserPortalPageContent } from '@/components/user/user-portal-page-content';
import { userDashboardScripts, userDashboardStyles } from '@/components/user/user-dashboard';

/**
 * Activation-focused destination: payment, forwarding number, verification, live answering.
 * Kept out of Settings so owners do not bury revenue-critical steps under “technical” config.
 */
export function UserGoLiveLive({
  initialBilling = null,
  initialStatus = null,
}: {
  initialBilling?: GoLiveBillingResponse | null;
  initialStatus?: GoLiveStatusResponse | null;
}) {
  return (
    <UserLayout styles={userDashboardStyles} scripts={userDashboardScripts} scriptPrefix="user-go-live-live">
      <>
        <div className="app-shell user-app-shell">
          <UserPortalSidebar active="go-live" />

          <main className="main">
            <UserPortalTopbar
              title="Go Live"
              subtitle="Connect RingBooker to your business number. Customers keep calling the same number — forwarding happens behind the scenes."
              actionsClassName={USER_PORTAL_TOPBAR_ACTIONS_CLASS}
              actions={<UserPortalStandardTopActions />}
            />
            <UserPortalPageContent pageClass="page-go-live">
              <GoLiveForwardingPanel initialBilling={initialBilling} initialStatus={initialStatus} />
            </UserPortalPageContent>
          </main>
        </div>
        <UserPortalMobileTabbar active="go-live" />
      </>
    </UserLayout>
  );
}
