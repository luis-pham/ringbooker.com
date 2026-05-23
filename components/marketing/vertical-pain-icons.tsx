'use client';

import {
  IconCalendarEvent,
  IconCurrencyDollar,
  IconMessageOff,
  IconMoon,
  IconPhoneOff,
  IconPhoneX,
} from '@tabler/icons-react';
import type { ComponentType } from 'react';

export type VerticalPainIconId =
  | 'phone-off'
  | 'currency-dollar'
  | 'calendar-event'
  | 'message-off'
  | 'moon'
  | 'phone-x';

const ICON_MAP: Record<
  VerticalPainIconId,
  ComponentType<{ size?: number; stroke?: number; color?: string }>
> = {
  'phone-off': IconPhoneOff,
  'currency-dollar': IconCurrencyDollar,
  'calendar-event': IconCalendarEvent,
  'message-off': IconMessageOff,
  moon: IconMoon,
  'phone-x': IconPhoneX,
};

export function VerticalPainIcon({ id }: { id: VerticalPainIconId }) {
  const Icon = ICON_MAP[id];
  return <Icon size={16} stroke={1.75} color="#9B3530" aria-hidden />;
}
