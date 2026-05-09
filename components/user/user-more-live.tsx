'use client';

import { UserLayout } from '@/components/user/user-layout';
import { UserPortalMobileTabbar } from '@/components/user/user-portal-mobile-tabbar';
import { UserPortalSidebar } from '@/components/user/user-portal-sidebar';
import {
  USER_PORTAL_TOPBAR_ACTIONS_CLASS,
  UserPortalStandardTopActions,
} from '@/components/user/user-portal-standard-top-actions';
import { UserPortalTopbar } from '@/components/user/user-portal-topbar';
import { userDashboardScripts } from '@/components/user/user-dashboard';
import { userSettingsStyles } from '@/components/user/user-settings';

const moreItems = [
  {
    title: 'Business Knowledge',
    description: 'Business info, services, hours, staff, FAQ, policies, and AI behavior.',
    href: '/user/knowledge',
  },
  {
    title: 'Integrations',
    description: 'Connect booking software or add a public booking link.',
    href: '/user/integrations',
  },
  {
    title: 'Billing',
    description: 'Plan, payment method, usage, and billing history.',
    href: '/user/billing',
  },
  {
    title: 'Settings',
    description: 'Account-level preferences and notification settings.',
    href: '/user/settings',
  },
  {
    title: 'Account',
    description: 'Login identity, password, and account details.',
    href: '/user/account',
  },
];

export function UserMoreLive() {
  return (
    <UserLayout styles={userSettingsStyles} scripts={userDashboardScripts} scriptPrefix="user-more-live">
      <>
        <div className="app-shell user-app-shell">
          <UserPortalSidebar active="more" />
          <main className="main">
            <UserPortalTopbar
              title="More"
              subtitle="Business setup, integrations, billing, and account settings."
              actionsClassName={USER_PORTAL_TOPBAR_ACTIONS_CLASS}
              actions={<UserPortalStandardTopActions />}
            />
            <section className="grid grid-2">
              {moreItems.map((item) => (
                <a key={item.href} className="card option-card" href={item.href}>
                  <span className="option-title">{item.title}</span>
                  <span className="option-copy">{item.description}</span>
                </a>
              ))}
            </section>
          </main>
        </div>
        <UserPortalMobileTabbar active="more" />
      </>
    </UserLayout>
  );
}
