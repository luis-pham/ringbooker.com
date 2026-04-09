import type { ReactNode } from 'react';

import { TemplatePageShell } from '@/components/shared/template-page-shell';

type MarketingLayoutProps = {
  bodyClass?: string;
  styles: string[];
  scripts?: string[];
  scriptPrefix: string;
  children: ReactNode;
};

export function MarketingLayout(props: MarketingLayoutProps) {
  return <TemplatePageShell {...props} />;
}
