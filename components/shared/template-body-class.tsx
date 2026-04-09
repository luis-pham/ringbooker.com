'use client';

import { useEffect } from 'react';

export function TemplateBodyClass({ className }: { className?: string }) {
  useEffect(() => {
    const previous = document.body.className;
    document.body.className = className ?? '';

    return () => {
      document.body.className = previous;
    };
  }, [className]);

  return null;
}
