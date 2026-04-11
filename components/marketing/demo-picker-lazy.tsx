'use client';

import { useEffect, useState } from 'react';
import type { ComponentType } from 'react';

type DemoPickerComponent = ComponentType<{ initialOpen?: boolean }>;

export function DemoPickerLazy() {
  const [Picker, setPicker] = useState<DemoPickerComponent | null>(null);

  useEffect(() => {
    let mounted = true;

    const onClick = (event: MouseEvent) => {
      const target = event.target as HTMLElement | null;
      if (!target?.closest('[data-demo-picker]')) return;
      event.preventDefault();

      void import('@/components/marketing/demo-picker-modal').then((module) => {
        if (mounted) setPicker(() => module.DemoPickerModal);
      });
    };

    document.addEventListener('click', onClick);
    return () => {
      mounted = false;
      document.removeEventListener('click', onClick);
    };
  }, []);

  return Picker ? <Picker initialOpen /> : null;
}
