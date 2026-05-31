import {
  IconBolt,
  IconBrush,
  IconBuildingHospital,
  IconClipboardList,
  IconColorSwatch,
  IconDots,
  IconDroplet,
  IconEye,
  IconFlame,
  IconMassage,
  IconMessages,
  IconMicroscope,
  IconPalette,
  IconScissors,
  IconSparkles,
  IconVaccine,
  IconWind,
} from '@tabler/icons-react';

type OnboardingIconProps = {
  size?: number;
  stroke?: number;
  className?: string;
};

type OnboardingIconComponent = typeof IconPalette;

export type OnboardingManualVerticalId =
  | 'nail_salon'
  | 'hair_salon'
  | 'day_spa'
  | 'med_spa'
  | 'beauty_clinic'
  | 'beauty_umbrella';

export type OnboardingMixedServiceGroup =
  | 'Manicure'
  | 'Pedicure'
  | 'Acrylics / Extensions'
  | 'Haircuts'
  | 'Hair Color'
  | 'Waxing'
  | 'Massage'
  | 'Facials'
  | 'Brows & Lashes'
  | 'Makeup'
  | 'Injectables'
  | 'Laser'
  | 'Skin Treatments'
  | 'Consultations'
  | 'Other';

const MIXED_SERVICE_GROUP_ICON_MAP = {
  Manicure: IconPalette,
  Pedicure: IconPalette,
  'Acrylics / Extensions': IconPalette,
  Haircuts: IconScissors,
  'Hair Color': IconColorSwatch,
  Waxing: IconFlame,
  Massage: IconMassage,
  Facials: IconDroplet,
  'Brows & Lashes': IconEye,
  Makeup: IconBrush,
  Injectables: IconVaccine,
  Laser: IconBolt,
  'Skin Treatments': IconMicroscope,
  Consultations: IconMessages,
  Other: IconDots,
} satisfies Record<OnboardingMixedServiceGroup, OnboardingIconComponent>;

const MANUAL_VERTICAL_ICON_MAP = {
  nail_salon: IconPalette,
  hair_salon: IconScissors,
  day_spa: IconMassage,
  med_spa: IconVaccine,
  beauty_clinic: IconBuildingHospital,
  beauty_umbrella: IconDots,
} satisfies Record<OnboardingManualVerticalId, OnboardingIconComponent>;

export function resolveOnboardingServiceGroupVisual(group: string): { Icon: OnboardingIconComponent; bg: string } {
  const value = group.toLowerCase();
  if (/color|highlight|balayage/.test(value)) return { Icon: IconColorSwatch, bg: '#fef3c7' };
  if (/haircut|cut|trim/.test(value)) return { Icon: IconScissors, bg: '#f0fdf4' };
  if (/style|blowout/.test(value)) return { Icon: IconWind, bg: '#eff6ff' };
  if (/extension|keratin/.test(value)) return { Icon: IconSparkles, bg: '#f5f3ff' };
  if (/wax/.test(value)) return { Icon: IconFlame, bg: '#fff7ed' };
  if (/massage|body/.test(value)) return { Icon: IconMassage, bg: '#f0fdfa' };
  if (/facial|skin/.test(value)) return { Icon: IconDroplet, bg: '#eff6ff' };
  if (/nail|mani|pedi|acrylic/.test(value)) return { Icon: IconPalette, bg: '#fdf2f8' };
  if (/lash|brow/.test(value)) return { Icon: IconEye, bg: '#faf5ff' };
  if (/makeup/.test(value)) return { Icon: IconBrush, bg: '#fff1f2' };
  if (/injectable|botox|filler/.test(value)) return { Icon: IconVaccine, bg: '#f0fdf4' };
  if (/laser/.test(value)) return { Icon: IconBolt, bg: '#fffbeb' };
  if (/consultation/.test(value)) return { Icon: IconMessages, bg: '#f8fafc' };
  return { Icon: IconClipboardList, bg: '#f9fafb' };
}

function resolveMixedServiceGroupIcon(group: string): OnboardingIconComponent {
  if (group in MIXED_SERVICE_GROUP_ICON_MAP) {
    return MIXED_SERVICE_GROUP_ICON_MAP[group as OnboardingMixedServiceGroup];
  }
  return resolveOnboardingServiceGroupVisual(group).Icon;
}

export function OnboardingMixedGroupChipIcon({
  group,
  size = 14,
  stroke = 1.75,
  className,
}: OnboardingIconProps & { group: string }) {
  const Icon = resolveMixedServiceGroupIcon(group);
  return <Icon size={size} stroke={stroke} className={className} aria-hidden />;
}

export function OnboardingServiceGroupIcon({
  group,
  size = 16,
  stroke = 1.75,
  className,
}: OnboardingIconProps & { group: string }) {
  const { Icon } = resolveOnboardingServiceGroupVisual(group);
  return <Icon size={size} stroke={stroke} className={className} aria-hidden />;
}

export function OnboardingManualVerticalIcon({
  id,
  size = 18,
  stroke = 1.75,
  className,
}: OnboardingIconProps & { id: OnboardingManualVerticalId }) {
  const Icon = MANUAL_VERTICAL_ICON_MAP[id];
  return <Icon size={size} stroke={stroke} className={className} aria-hidden />;
}
