import {
  IconBuildingHospital,
  IconMassage,
  IconPalette,
  IconScissors,
  IconVaccine,
} from '@tabler/icons-react';

export type MarketingVerticalIconId =
  | 'nail-salon'
  | 'hair-salon'
  | 'day-spa'
  | 'med-spa'
  | 'beauty-clinic';

const ICON_MAP = {
  'nail-salon': IconPalette,
  'hair-salon': IconScissors,
  'day-spa': IconMassage,
  'med-spa': IconVaccine,
  'beauty-clinic': IconBuildingHospital,
} satisfies Record<MarketingVerticalIconId, typeof IconPalette>;

export function MarketingVerticalIcon({
  id,
  className,
  size = 18,
  stroke = 1.75,
}: {
  id: MarketingVerticalIconId;
  className?: string;
  size?: number;
  stroke?: number;
}) {
  const IconComponent = ICON_MAP[id];
  return <IconComponent className={className} size={size} stroke={stroke} aria-hidden />;
}

export function getMarketingVerticalIcon(id: MarketingVerticalIconId) {
  return ICON_MAP[id];
}
