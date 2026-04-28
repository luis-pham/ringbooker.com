'use client';

import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

function shouldUseClientNavigation(event: MouseEvent, anchor: HTMLAnchorElement) {
  if (event.defaultPrevented) return false;
  if (event.button !== 0) return false;
  if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return false;
  if (anchor.target && anchor.target !== '_self') return false;
  if (anchor.hasAttribute('download')) return false;
  if (anchor.closest('[data-demo-picker]')) return false;

  const rawHref = anchor.getAttribute('href');
  if (!rawHref || rawHref.startsWith('#')) return false;
  if (/^(mailto:|tel:|sms:|blob:|data:)/i.test(rawHref)) return false;

  const url = new URL(rawHref, window.location.href);
  if (url.origin !== window.location.origin) return false;

  const currentPath = `${window.location.pathname}${window.location.search}`;
  const nextPath = `${url.pathname}${url.search}`;
  if (currentPath === nextPath && url.hash) return false;

  return true;
}

export function MarketingInternalLinkRouter() {
  const router = useRouter();

  useEffect(() => {
    function onClick(event: MouseEvent) {
      const target = event.target as Element | null;
      const anchor = target?.closest('a[href]');
      if (!(anchor instanceof HTMLAnchorElement)) return;
      if (!shouldUseClientNavigation(event, anchor)) return;

      const url = new URL(anchor.href);
      event.preventDefault();
      router.push(`${url.pathname}${url.search}${url.hash}`);
    }

    document.addEventListener('click', onClick);
    return () => document.removeEventListener('click', onClick);
  }, [router]);

  return null;
}
