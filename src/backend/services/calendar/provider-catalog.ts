export type CalendarProviderId =
  | 'manual'
  | 'google_calendar'
  | 'vagaro'
  | 'square_appointments'
  | 'mindbody'
  | 'booksy';

export type CalendarProviderCapability = {
  checkAvailability: boolean;
  createBooking: boolean;
  rescheduleBooking: boolean;
  cancelBooking: boolean;
  webhookSync: boolean;
  serviceSync: boolean;
  staffSync: boolean;
  customerSync: boolean;
};

export type CalendarProviderMetadata = {
  id: CalendarProviderId;
  label: string;
  implemented: boolean;
  status: 'active' | 'planned';
  capabilities: CalendarProviderCapability;
};

export const CALENDAR_PROVIDER_CATALOG: Record<CalendarProviderId, CalendarProviderMetadata> = {
  manual: {
    id: 'manual',
    label: 'Manual Calendar',
    implemented: true,
    status: 'active',
    capabilities: {
      checkAvailability: true,
      createBooking: true,
      rescheduleBooking: true,
      cancelBooking: true,
      webhookSync: false,
      serviceSync: false,
      staffSync: false,
      customerSync: false,
    },
  },
  google_calendar: {
    id: 'google_calendar',
    label: 'Google Calendar',
    implemented: true,
    status: 'active',
    capabilities: {
      checkAvailability: true,
      createBooking: true,
      rescheduleBooking: true,
      cancelBooking: true,
      webhookSync: false,
      serviceSync: false,
      staffSync: false,
      customerSync: false,
    },
  },
  vagaro: {
    id: 'vagaro',
    label: 'Vagaro',
    implemented: false,
    status: 'planned',
    capabilities: {
      checkAvailability: true,
      createBooking: true,
      rescheduleBooking: true,
      cancelBooking: true,
      webhookSync: true,
      serviceSync: true,
      staffSync: true,
      customerSync: true,
    },
  },
  square_appointments: {
    id: 'square_appointments',
    label: 'Square Appointments',
    implemented: true,
    status: 'active',
    capabilities: {
      checkAvailability: true,
      createBooking: true,
      rescheduleBooking: true,
      cancelBooking: true,
      webhookSync: false,
      serviceSync: false,
      staffSync: false,
      customerSync: true,
    },
  },
  mindbody: {
    id: 'mindbody',
    label: 'Mindbody',
    implemented: false,
    status: 'planned',
    capabilities: {
      checkAvailability: true,
      createBooking: true,
      rescheduleBooking: true,
      cancelBooking: true,
      webhookSync: true,
      serviceSync: true,
      staffSync: true,
      customerSync: true,
    },
  },
  booksy: {
    id: 'booksy',
    label: 'Booksy',
    implemented: false,
    status: 'planned',
    capabilities: {
      checkAvailability: true,
      createBooking: true,
      rescheduleBooking: true,
      cancelBooking: true,
      webhookSync: true,
      serviceSync: true,
      staffSync: true,
      customerSync: true,
    },
  },
};

export function parseCalendarProviderId(value: unknown): CalendarProviderId | null {
  if (typeof value !== 'string') return null;
  const normalized = value.trim().toLowerCase();
  if (!normalized) return null;
  return (Object.keys(CALENDAR_PROVIDER_CATALOG) as CalendarProviderId[]).includes(normalized as CalendarProviderId)
    ? (normalized as CalendarProviderId)
    : null;
}

export function listCalendarProviders(): CalendarProviderMetadata[] {
  return (Object.keys(CALENDAR_PROVIDER_CATALOG) as CalendarProviderId[]).map((id) => CALENDAR_PROVIDER_CATALOG[id]);
}
