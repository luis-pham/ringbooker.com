export type CalendarProviderId =
  | 'manual'
  | 'google_calendar'
  | 'vagaro'
  | 'square_appointments'
  | 'glossgenius'
  | 'fresha'
  | 'custom'
  | 'mindbody'
  | 'booksy'
  | 'boulevard'
  | 'calendly'
  | 'styleseat'
  | 'mangomint'
  | 'schedulicity'
  | 'zenoti'
  | 'phorest'
  | 'timely'
  | 'acuity';

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
      webhookSync: false,
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
  custom: {
    id: 'custom',
    label: 'Custom booking link',
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
    implemented: true,
    status: 'active',
    capabilities: {
      checkAvailability: true,
      createBooking: false,
      rescheduleBooking: false,
      cancelBooking: false,
      webhookSync: false,
      serviceSync: true,
      staffSync: true,
      customerSync: false,
      hasBookingLink: true,
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
  boulevard: {
    id: 'boulevard',
    label: 'Boulevard',
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
  calendly: {
    id: 'calendly',
    label: 'Calendly',
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
  styleseat: {
    id: 'styleseat',
    label: 'StyleSeat',
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
  mangomint: {
    id: 'mangomint',
    label: 'Mangomint',
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
  schedulicity: {
    id: 'schedulicity',
    label: 'Schedulicity',
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
  zenoti: {
    id: 'zenoti',
    label: 'Zenoti',
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
  phorest: {
    id: 'phorest',
    label: 'Phorest',
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
  timely: {
    id: 'timely',
    label: 'Timely',
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
  acuity: {
    id: 'acuity',
    label: 'Acuity Scheduling',
    type: 'calendar',
    implemented: true,
    status: 'active',
    capabilities: {
      checkAvailability: true,
      createBooking: true,
      rescheduleBooking: true,
      cancelBooking: true,
      webhookSync: true,
      serviceSync: true,
      staffSync: true,
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
