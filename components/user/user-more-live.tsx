'use client';

import { UserLayout } from '@/components/user/user-layout';
import { UserPortalMobileTabbar } from '@/components/user/user-portal-mobile-tabbar';
import { UserPortalSidebar } from '@/components/user/user-portal-sidebar';
import {
  USER_PORTAL_TOPBAR_ACTIONS_CLASS,
  UserPortalStandardTopActions,
} from '@/components/user/user-portal-standard-top-actions';
import { UserPortalTopbar } from '@/components/user/user-portal-topbar';
import { UserPortalPageContent } from '@/components/user/user-portal-page-content';
import { userDashboardScripts } from '@/components/user/user-dashboard';
import { userSettingsStyles } from '@/components/user/user-settings';

const userMoreStyles = [...userSettingsStyles];

const moreItems = [
  {
    title: 'Business Knowledge',
    description: 'Business profile, hours, services, staff, policies, FAQ, AI behavior, and call handling.',
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
    title: 'Account',
    description: 'Login identity, password, and account details.',
    href: '/user/account',
  },
];

export function UserMoreLive() {
  return (
    <UserLayout styles={userMoreStyles} scripts={userDashboardScripts} scriptPrefix="user-more-live">
      <>
        <div className="app-shell user-app-shell">
          <UserPortalSidebar active="more" />
          <main className="main more-page">
            <UserPortalPageContent pageClass="page-more">
            <UserPortalTopbar
              title="More"
              subtitle="Business setup, integrations, billing, and account."
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
            </UserPortalPageContent>
          </main>
        </div>
        <UserPortalMobileTabbar active="more" />
      </>
    </UserLayout>
  );
}
