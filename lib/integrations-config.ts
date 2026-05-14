export type BookingMethod = 'app' | 'direct' | 'later' | null;

export type IntegrationAppKey =
  | 'square'
  | 'vagaro'
  | 'mindbody'
  | 'acuity'
  | 'fresha'
  | 'boulevard'
  | 'booksy'
  | 'glossgenius'
  | 'calendly'
  | 'styleseat'
  | 'mangomint'
  | 'schedulicity'
  | 'zenoti'
  | 'phorest'
  | 'timely'
  | 'custom';

export type IntegrationApp = {
  key: IntegrationAppKey;
  name: string;
  logoText: string;
  logoColor: string;
  logoTextColor: string;
  connectionType: 'api' | 'link';
  category: 'full-sync' | 'booking-link';
  placeholder?: string;
  helpUrl?: string;
  comingSoon?: boolean;
  note?: string;
};

export const INTEGRATION_APPS: IntegrationApp[] = [
  { key: 'square', name: 'Square Appointments', logoText: 'S', logoColor: '#00a0df', logoTextColor: '#fff', connectionType: 'api', category: 'full-sync' },
  {
    key: 'mindbody',
    name: 'Mindbody',
    logoText: 'M',
    logoColor: '#4a90d9',
    logoTextColor: '#fff',
    connectionType: 'api',
    category: 'full-sync',
    helpUrl: 'https://developers.mindbodyonline.com/',
    note: 'Mindbody API access requires an approved developer account and activated site access. RingBooker falls back to captured booking requests if API booking is unavailable.',
  },
  {
    key: 'acuity',
    name: 'Acuity Scheduling',
    logoText: 'A',
    logoColor: '#006bff',
    logoTextColor: '#fff',
    connectionType: 'api',
    category: 'full-sync',
    placeholder: 'https://your-business.as.me/',
    helpUrl: 'https://developers.acuityscheduling.com/',
    note: 'Acuity supports appointment type and calendar sync. Direct appointment creation requires verified mapping and ACUITY_DIRECT_BOOKING_ENABLED=true.',
  },
  {
    key: 'vagaro',
    name: 'Vagaro',
    logoText: 'V',
    logoColor: '#8b5cf6',
    logoTextColor: '#fff',
    connectionType: 'link',
    category: 'booking-link',
    placeholder: 'https://vagaro.com/your-business',
    helpUrl: 'https://vagaro.com/pro/marketplace',
    note: 'Vagaro API requires enterprise approval. Add your booking link so callers can receive it by SMS while you wait for API access.',
  },
  { key: 'fresha', name: 'Fresha', logoText: 'F', logoColor: '#00c896', logoTextColor: '#fff', connectionType: 'link', category: 'booking-link', placeholder: 'https://fresha.com/your-business' },
  { key: 'boulevard', name: 'Boulevard', logoText: 'Bl', logoColor: '#1a1a2e', logoTextColor: '#fff', connectionType: 'link', category: 'booking-link', placeholder: 'https://boulevard.com/...' },
  { key: 'booksy', name: 'Booksy', logoText: 'Bk', logoColor: '#1a1a2e', logoTextColor: '#fff', connectionType: 'link', category: 'booking-link', placeholder: 'https://booksy.com/en-us/...' },
  { key: 'glossgenius', name: 'GlossGenius', logoText: 'G', logoColor: '#f4a261', logoTextColor: '#fff', connectionType: 'link', category: 'booking-link', placeholder: 'https://glossgenius.com/...' },
  { key: 'calendly', name: 'Calendly', logoText: 'C', logoColor: '#006bff', logoTextColor: '#fff', connectionType: 'link', category: 'booking-link', placeholder: 'https://calendly.com/your-name' },
  { key: 'styleseat', name: 'StyleSeat', logoText: 'SS', logoColor: '#111111', logoTextColor: '#fff', connectionType: 'link', category: 'booking-link', placeholder: 'https://styleseat.com/...' },
  { key: 'mangomint', name: 'Mangomint', logoText: 'Mg', logoColor: '#ff6b6b', logoTextColor: '#fff', connectionType: 'link', category: 'booking-link', placeholder: 'https://mangomint.com/...' },
  { key: 'schedulicity', name: 'Schedulicity', logoText: 'Sc', logoColor: '#2ecc71', logoTextColor: '#fff', connectionType: 'link', category: 'booking-link', placeholder: 'https://schedulicity.com/...' },
  { key: 'zenoti', name: 'Zenoti', logoText: 'Z', logoColor: '#0066cc', logoTextColor: '#fff', connectionType: 'link', category: 'booking-link', placeholder: 'https://your-salon.zenoti.com/...' },
  { key: 'phorest', name: 'Phorest', logoText: 'Ph', logoColor: '#7c3aed', logoTextColor: '#fff', connectionType: 'link', category: 'booking-link', placeholder: 'https://phorest.com/...' },
  { key: 'timely', name: 'Timely', logoText: 'T', logoColor: '#00bcd4', logoTextColor: '#fff', connectionType: 'link', category: 'booking-link', placeholder: 'https://timelyapp.com/...' },
  { key: 'custom', name: 'Custom URL', logoText: '↗', logoColor: '#f3f4f6', logoTextColor: '#6b7280', connectionType: 'link', category: 'booking-link', placeholder: 'https://yourbookingsite.com/book' },
];

export const FULL_SYNC_APPS = INTEGRATION_APPS.filter((app) => app.category === 'full-sync');
export const BOOKING_LINK_APPS = INTEGRATION_APPS.filter((app) => app.category === 'booking-link');

export function findIntegrationApp(key: string | null | undefined): IntegrationApp | null {
  if (!key) return null;
  return INTEGRATION_APPS.find((app) => app.key === key) ?? null;
}

export function toBackendProviderKey(key: IntegrationAppKey): string {
  return key === 'square' ? 'square_appointments' : key;
}

export function fromBackendProviderKey(key: string | null | undefined): IntegrationAppKey | null {
  if (!key) return null;
  return (key === 'square_appointments' ? 'square' : key) as IntegrationAppKey;
}
