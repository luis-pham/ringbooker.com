import Script from 'next/script';
import type { ReactNode } from 'react';

import { userPortalSidebarBootstrapScript } from '@/components/user/user-portal-sidebar-bootstrap';
import { TemplatePageShell } from '@/components/shared/template-page-shell';

type UserLayoutProps = {
  bodyClass?: string;
  styles: string[];
  scripts?: string[];
  scriptPrefix: string;
  children: ReactNode;
};

export function UserLayout(props: UserLayoutProps) {
  return (
    <>
      <Script
        id="user-portal-sidebar-bootstrap"
        strategy="beforeInteractive"
        dangerouslySetInnerHTML={{ __html: userPortalSidebarBootstrapScript }}
      />
      <TemplatePageShell {...props} />
    </>
  );
}
