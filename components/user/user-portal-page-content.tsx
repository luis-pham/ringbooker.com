import type { ReactNode } from 'react';

/**
 * Max-width (px) per portal surface — must match `.page-*` rules in `components/user/user-dashboard.tsx`.
 * Used for documentation and callers that need the numeric value; layout is CSS-driven on `.page-content`.
 */
export const PAGE_MAX_WIDTHS = {
  overview: 1100,
  calls: 1100,
  bookings: 1100,
  billing: 1100,
  more: 1100,
  knowledge: 1100,
  businessProfile: 960,
  hours: 960,
  staff: 960,
  policies: 960,
  aiBehavior: 960,
  services: 960,
  account: 960,
  goLive: 800,
  integrations: 800,
} as const;

type UserPortalPageContentProps = {
  /** e.g. `page-overview`, `page-calls`, `page-business-profile` — sets max-width on wide viewports. */
  pageClass: string;
  children: ReactNode;
};

export function UserPortalPageContent({ pageClass, children }: UserPortalPageContentProps) {
  return <div className={`page-content ${pageClass}`}>{children}</div>;
}

/** Maps Business Knowledge (and related) tab ids to width utility classes. */
export function knowledgePortalTabPageClass(tab: string): string {
  switch (tab) {
    case 'business':
      return 'page-business-profile';
    case 'hours':
      return 'page-hours';
    case 'services-hours':
      return 'page-services';
    case 'staff':
      return 'page-staff';
    case 'faq':
      return 'page-policies';
    case 'ai-call-behavior':
    case 'messaging':
      return 'page-ai-behavior';
    case 'integrations':
      return 'page-integrations';
    default:
      return 'page-business-profile';
  }
}
