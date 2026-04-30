export type CalendarProviderId =
  | 'manual'
  | 'google_calendar'
  | 'vagaro'
  | 'square_appointments'
  | 'glossgenius'
  | 'fresha'
  | 'mindbody'
  | 'booksy';

export type CalendarProviderType = 'calendar' | 'booking_link';

export type CalendarProviderCapability = {
  checkAvailability: boolean;
  createBooking: boolean;
  rescheduleBooking: boolean;
  cancelBooking: boolean;
  webhookSync: boolean;
  serviceSync: boolean;
  staffSync: boolean;
  customerSync: boolean;
  hasBookingLink: boolean;
};

export type CalendarProviderMetadata = {
  id: CalendarProviderId;
  label: string;
  type: CalendarProviderType;
  implemented: boolean;
  status: 'active' | 'planned' | 'live';
  capabilities: CalendarProviderCapability;
};

export const CALENDAR_PROVIDER_CATALOG: Record<CalendarProviderId, CalendarProviderMetadata> = {
  manual: {
    id: 'manual',
    label: 'Manual Calendar',
    type: 'calendar',
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
      hasBookingLink: false,
    },
  },
  google_calendar: {
    id: 'google_calendar',
    label: 'Google Calendar',
    type: 'calendar',
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
      hasBookingLink: false,
    },
  },
  vagaro: {
    id: 'vagaro',
    label: 'Vagaro',
    type: 'calendar',
    implemented: true,
    status: 'active',
    capabilities: {
      checkAvailability: true,
      createBooking: false,
      rescheduleBooking: false,
      cancelBooking: false,
      webhookSync: true,
      serviceSync: true,
      staffSync: true,
      customerSync: false,
      hasBookingLink: true,
    },
  },
  square_appointments: {
    id: 'square_appointments',
    label: 'Square Appointments',
    type: 'calendar',
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
      hasBookingLink: false,
    },
  },
  glossgenius: {
    id: 'glossgenius',
    label: 'GlossGenius',
    type: 'booking_link',
    implemented: true,
    status: 'live',
    capabilities: {
      checkAvailability: false,
      createBooking: false,
      rescheduleBooking: false,
      cancelBooking: false,
      webhookSync: false,
      serviceSync: false,
      staffSync: false,
      customerSync: false,
      hasBookingLink: true,
    },
  },
  fresha: {
    id: 'fresha',
    label: 'Fresha',
    type: 'booking_link',
    implemented: true,
    status: 'live',
    capabilities: {
      checkAvailability: false,
      createBooking: false,
      rescheduleBooking: false,
      cancelBooking: false,
      webhookSync: false,
      serviceSync: false,
      staffSync: false,
      customerSync: false,
      hasBookingLink: true,
    },
  },
  mindbody: {
    id: 'mindbody',
    label: 'Mindbody',
    type: 'calendar',
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
      hasBookingLink: false,
    },
  },
  booksy: {
    id: 'booksy',
    label: 'Booksy',
    type: 'booking_link',
    implemented: true,
    status: 'live',
    capabilities: {
      checkAvailability: false,
      createBooking: false,
      rescheduleBooking: false,
      cancelBooking: false,
      webhookSync: false,
      serviceSync: false,
      staffSync: false,
      customerSync: false,
      hasBookingLink: true,
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
