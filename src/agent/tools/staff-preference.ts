const NO_STAFF_PREFERENCE_PHRASES = new Set([
  'any',
  'any one',
  'anyone',
  'anybody',
  'any available',
  'any available stylist',
  'any provider',
  'any staff',
  'any stylist',
  'any technician',
  'any tech',
  'anyone is fine',
  'anyone is okay',
  'anyone is ok',
  'anyone okay',
  'anyone ok',
  'anyone works',
  'does not matter',
  "doesn't matter",
  'first available',
  'no particular',
  'no preference',
  'no specific',
  'no specific stylist',
  'no stylist preference',
  'no tech preference',
  'no technician preference',
  'whoever',
  'whoever is available',
]);

function normalizeStaffPreferenceText(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^\w\s']/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function isNoStaffPreference(value: string | null | undefined): boolean {
  if (!value?.trim()) return false;
  const normalized = normalizeStaffPreferenceText(value);
  if (!normalized) return false;
  if (NO_STAFF_PREFERENCE_PHRASES.has(normalized)) return true;
  if (/^(any|anyone|anybody|whoever)\s+(is\s+)?(fine|ok|okay|available|works)$/.test(normalized)) return true;
  return /^(no|none)\s+(stylist|provider|staff|tech|technician)?\s*preference$/.test(normalized);
}

export function normalizeStaffPreferenceName(value: string | null | undefined): string | undefined {
  const trimmed = value?.trim();
  if (!trimmed) return undefined;
  if (isNoStaffPreference(trimmed)) return undefined;
  return trimmed;
}
