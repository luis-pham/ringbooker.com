import type { ReactNode } from 'react';

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
