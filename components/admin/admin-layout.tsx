import Script from 'next/script';
import type { ReactNode } from 'react';

import { adminShellBootstrapScript } from '@/components/admin/admin-shell-bootstrap';
import { adminShellStyles } from '@/components/admin/admin-shell-styles';
import { TemplatePageShell } from '@/components/shared/template-page-shell';

type AdminLayoutProps = {
  bodyClass?: string;
  styles: string[];
  scripts?: string[];
  scriptPrefix: string;
  children: ReactNode;
};

export function AdminLayout({ styles, ...props }: AdminLayoutProps) {
  return (
    <>
      <Script
        id="admin-shell-bootstrap"
        strategy="beforeInteractive"
        dangerouslySetInnerHTML={{ __html: adminShellBootstrapScript }}
      />
      <TemplatePageShell {...props} styles={[...styles, ...adminShellStyles]} />
    </>
  );
}
