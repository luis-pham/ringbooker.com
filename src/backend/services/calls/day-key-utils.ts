const DAY_KEY_MAP: Record<string, string> = {
  mon: 'monday',
  monday: 'monday',
  tue: 'tuesday',
  tuesday: 'tuesday',
  wed: 'wednesday',
  wednesday: 'wednesday',
  thu: 'thursday',
  thursday: 'thursday',
  fri: 'friday',
  friday: 'friday',
  sat: 'saturday',
  saturday: 'saturday',
  sun: 'sunday',
  sunday: 'sunday',
};

export function normalizeDayKey(key: string): string {
  const normalized = key.trim().toLowerCase();
  const mapped = DAY_KEY_MAP[normalized];
  if (mapped) return mapped;
  console.warn('[normalizeDayKey] unknown_day_key', { key });
  return key;
}
