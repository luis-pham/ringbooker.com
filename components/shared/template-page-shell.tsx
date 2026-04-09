import Script from 'next/script';
import type { ReactNode } from 'react';

import { TemplateBodyClass } from '@/components/shared/template-body-class';

type TemplatePageShellProps = {
  bodyClass?: string;
  styles: string[];
  scripts?: string[];
  scriptPrefix: string;
  children: ReactNode;
};

export function TemplatePageShell({
  bodyClass,
  styles,
  scripts = [],
  scriptPrefix,
  children,
}: TemplatePageShellProps) {
  return (
    <>
      <TemplateBodyClass className={bodyClass} />
      {styles.map((style, index) => (
        <style
          key={`template-style-${index}`}
          dangerouslySetInnerHTML={{ __html: style }}
        />
      ))}
      {children}
      {scripts.map((script, index) => (
        <Script
          key={`template-script-${index}`}
          id={`${scriptPrefix}-script-${index}`}
          strategy="afterInteractive"
          dangerouslySetInnerHTML={{ __html: script }}
        />
      ))}
    </>
  );
}
