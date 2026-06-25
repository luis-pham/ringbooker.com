import type { CSSProperties } from 'react';
import {
  IconAdjustmentsHorizontal,
  IconBell,
  IconBolt,
  IconCalendar,
  IconChartBar,
  IconClipboardList,
  IconClock,
  IconCurrencyDollar,
  IconDeviceDesktop,
  IconDeviceMobile,
  IconDeviceTv,
  IconFlask,
  IconFriends,
  IconHeart,
  IconHeartHandshake,
  IconHelp,
  IconHeadset,
  IconHourglass,
  IconLink,
  IconMailOff,
  IconMapPin,
  IconMassage,
  IconMasksTheater,
  IconMessageCircle,
  IconMoon,
  IconPackage,
  IconPalette,
  IconPhone,
  IconPhoneCall,
  IconPhoneOff,
  IconPlugConnected,
  IconPuzzle,
  IconRefresh,
  IconRobot,
  IconRocket,
  IconRuler2,
  IconScissors,
  IconSearch,
  IconShieldCheck,
  IconSignRight,
  IconSparkles,
  IconSpeakerphone,
  IconSwitchHorizontal,
  IconTarget,
  IconTool,
  IconTrendingUp,
  IconUser,
  IconUsers,
  IconVaccine,
  IconWorld,
  IconX,
} from '@tabler/icons-react';

type TablerIconComponent = typeof IconPhone;

const TABLER_ICON_MAP: Record<string, TablerIconComponent> = {
  'ti-adjustments-horizontal': IconAdjustmentsHorizontal,
  'ti-bell': IconBell,
  'ti-bolt': IconBolt,
  'ti-calendar': IconCalendar,
  'ti-chart-bar': IconChartBar,
  'ti-clipboard-list': IconClipboardList,
  'ti-clock': IconClock,
  'ti-currency-dollar': IconCurrencyDollar,
  'ti-device-desktop': IconDeviceDesktop,
  'ti-device-mobile': IconDeviceMobile,
  'ti-device-tv': IconDeviceTv,
  'ti-flask': IconFlask,
  'ti-friends': IconFriends,
  'ti-handshake': IconHeartHandshake,
  'ti-heart': IconHeart,
  'ti-heart-handshake': IconHeartHandshake,
  'ti-help': IconHelp,
  'ti-headset': IconHeadset,
  'ti-hourglass': IconHourglass,
  'ti-link': IconLink,
  'ti-mail-off': IconMailOff,
  'ti-map-pin': IconMapPin,
  'ti-massage': IconMassage,
  'ti-masks-theater': IconMasksTheater,
  'ti-message-circle': IconMessageCircle,
  'ti-moon': IconMoon,
  'ti-nail': IconPalette,
  'ti-package': IconPackage,
  'ti-palette': IconPalette,
  'ti-phone': IconPhone,
  'ti-phone-call': IconPhoneCall,
  'ti-phone-off': IconPhoneOff,
  'ti-plug-connected': IconPlugConnected,
  'ti-puzzle': IconPuzzle,
  'ti-refresh': IconRefresh,
  'ti-robot': IconRobot,
  'ti-rocket': IconRocket,
  'ti-ruler-2': IconRuler2,
  'ti-scissors': IconScissors,
  'ti-search': IconSearch,
  'ti-shield-check': IconShieldCheck,
  'ti-sign-right': IconSignRight,
  'ti-sparkles': IconSparkles,
  'ti-spa': IconMassage,
  'ti-speakerphone': IconSpeakerphone,
  'ti-switch-horizontal': IconSwitchHorizontal,
  'ti-target': IconTarget,
  'ti-tool': IconTool,
  'ti-trending-up': IconTrendingUp,
  'ti-user': IconUser,
  'ti-users': IconUsers,
  'ti-vaccine': IconVaccine,
  'ti-world': IconWorld,
  'ti-x': IconX,
};

export function MarketingTablerIcon({
  icon,
  className,
  stroke = 1.8,
  style,
}: {
  icon?: string;
  className?: string;
  stroke?: number;
  style?: CSSProperties;
}) {
  if (!icon) return null;

  const isEmoji =
    /\p{Emoji}/u.test(icon) && !/^ti-/.test(icon) && !icon.match(/^[a-z-]+$/);

  if (isEmoji) {
    return (
      <span aria-hidden className={className}>
        {icon}
      </span>
    );
  }

  const tablerId = icon.startsWith('ti-') ? icon : `ti-${icon}`;
  const IconComponent = TABLER_ICON_MAP[tablerId];

  if (!IconComponent) return null;

  return (
    <IconComponent
      aria-hidden
      className={className}
      stroke={stroke}
      style={{ width: '1em', height: '1em', ...style }}
    />
  );
}
