import type { ReactNode } from 'react';

import { TemplatePageShell } from '@/components/shared/template-page-shell';

type UserLayoutProps = {
  bodyClass?: string;
  styles: string[];
  scripts?: string[];
  scriptPrefix: string;
  children: ReactNode;
};

export function UserLayout(props: UserLayoutProps) {
  return <TemplatePageShell {...props} />;
}
