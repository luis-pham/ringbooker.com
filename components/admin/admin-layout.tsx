import type { ReactNode } from 'react';

import { TemplatePageShell } from '@/components/shared/template-page-shell';

type AdminLayoutProps = {
  bodyClass?: string;
  styles: string[];
  scripts?: string[];
  scriptPrefix: string;
  children: ReactNode;
};

export function AdminLayout(props: AdminLayoutProps) {
  return <TemplatePageShell {...props} />;
}
