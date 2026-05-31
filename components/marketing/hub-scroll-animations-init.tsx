'use client';

import { useEffect } from 'react';

import { initHubScrollAnimations } from '@/components/marketing/hub-scroll-animations';

/** Binds scroll-reveal animations on solution / content hub pages after client navigation. */
export function HubScrollAnimationsInit() {
  useEffect(() => initHubScrollAnimations(), []);
  return null;
}
