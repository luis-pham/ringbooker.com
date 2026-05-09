'use client';

import { UserLayout } from '@/components/user/user-layout';
import { GoLiveForwardingPanel } from '@/components/user/go-live-forwarding-panel';
import { UserPortalMobileTabbar } from '@/components/user/user-portal-mobile-tabbar';
import { UserPortalSidebar } from '@/components/user/user-portal-sidebar';
import {
  USER_PORTAL_TOPBAR_ACTIONS_CLASS,
  UserPortalStandardTopActions,
} from '@/components/user/user-portal-standard-top-actions';
import { UserPortalTopbar } from '@/components/user/user-portal-topbar';
import { userDashboardScripts, userDashboardStyles } from '@/components/user/user-dashboard';

/**
 * Activation-focused destination: payment, forwarding number, verification, live answering.
 * Kept out of Settings so owners do not bury revenue-critical steps under “technical” config.
 */
export function UserGoLiveLive() {
  return (
    <UserLayout styles={userDashboardStyles} scripts={userDashboardScripts} scriptPrefix="user-go-live-live">
      <>
        <div className="app-shell user-app-shell">
          <UserPortalSidebar active="go-live" />

          <main className="main">
            <UserPortalTopbar
              title="Connect Phone"
              subtitle="Current business number, RingBooker forwarding number, verification, and live answering."
              actionsClassName={USER_PORTAL_TOPBAR_ACTIONS_CLASS}
              actions={<UserPortalStandardTopActions />}
            />
            <GoLiveForwardingPanel />
          </main>
        </div>
        <UserPortalMobileTabbar active="go-live" />
      </>
    </UserLayout>
  );
}
