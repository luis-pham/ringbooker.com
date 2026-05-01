export type RealtimeToolDefinition = {
  name: string;
  description: string;
  parameters: Record<string, unknown>;
};

export const REALTIME_TOOL_DEFINITIONS: RealtimeToolDefinition[] = [
  {
    name: 'check_availability',
    description: 'Check appointment availability for a service at a specific date and time.',
    parameters: {
      type: 'object',
      additionalProperties: false,
      properties: {
        date: { type: 'string', description: 'Date in YYYY-MM-DD format.' },
        time: { type: 'string', description: 'Time in HH:mm format.' },
        service: { type: 'string', description: 'Requested service name.' },
        techName: {
          type: 'string',
          description:
            "Name of the stylist, technician, or staff member requested by the caller. Use when caller says things like 'I want Sarah' or 'Can I book with Mike?'",
        },
      },
      required: ['date', 'time', 'service'],
    },
  },
  {
    name: 'create_booking',
    description: 'Create a booking for a customer once date and time are confirmed.',
    parameters: {
      type: 'object',
      additionalProperties: false,
      properties: {
        date: { type: 'string', description: 'Date in YYYY-MM-DD format.' },
        time: { type: 'string', description: 'Time in HH:mm format.' },
        service: { type: 'string', description: 'Requested service name.' },
        techName: {
          type: 'string',
          description:
            "Name of the stylist, technician, or staff member requested by the caller. Use when caller says things like 'I want Sarah' or 'Can I book with Mike?'",
        },
        customerName: { type: 'string', description: 'Optional customer name.' },
        notes: { type: 'string', description: 'Optional booking notes.' },
      },
      required: ['date', 'time', 'service'],
    },
  },
  {
    name: 'reschedule_booking',
    description: 'Reschedule an existing booking to a new date and time.',
    parameters: {
      type: 'object',
      additionalProperties: false,
      properties: {
        bookingId: { type: 'string', description: 'Existing booking identifier.' },
        currentDateTime: { type: 'string', description: 'Optional current appointment date/time.' },
        newDateTime: { type: 'string', description: 'Requested new appointment date/time.' },
        newDate: { type: 'string', description: 'New date in YYYY-MM-DD format. Use with newTime if newDateTime is not provided.' },
        newTime: { type: 'string', description: 'New time in HH:mm format. Use with newDate if newDateTime is not provided.' },
        callerName: { type: 'string', description: 'Optional caller name.' },
      },
      required: ['bookingId'],
    },
  },
  {
    name: 'cancel_booking',
    description:
      'Cancel an existing appointment. For Square Appointments, cancels directly via API. For all other providers, captures the request, provides caller with self-cancel instructions where available, and notifies the shop owner.',
    parameters: {
      type: 'object',
      additionalProperties: false,
      properties: {
        bookingId: { type: 'string', description: 'Optional existing booking identifier, required for direct Square cancellation.' },
        callerName: { type: 'string', description: 'Optional caller name.' },
        callerPhone: { type: 'string', description: "Optional caller's phone number." },
        appointmentDate: { type: 'string', description: 'Optional appointment date or time description.' },
        reason: { type: 'string', description: 'Optional cancellation reason.' },
      },
      required: [],
    },
  },
  {
    name: 'get_shop_info',
    description: 'Fetch canonical shop information such as hours, services, and policy.',
    parameters: {
      type: 'object',
      additionalProperties: false,
      properties: {
        query: { type: 'string', description: 'Natural language query about shop information.' },
      },
      required: ['query'],
    },
  },
  {
    name: 'transfer_to_user',
    description: 'Attempt a live transfer to the user or fallback to voicemail path.',
    parameters: {
      type: 'object',
      additionalProperties: false,
      properties: {
        reason: { type: 'string', description: 'Reason for transfer escalation.' },
      },
      required: ['reason'],
    },
  },
  {
    name: 'schedule_callback',
    description: 'Queue a callback request for the customer.',
    parameters: {
      type: 'object',
      additionalProperties: false,
      properties: {
        customerName: { type: 'string', description: 'Optional customer name for callback note.' },
        reason: { type: 'string', description: 'Reason for callback request.' },
      },
      required: ['reason'],
    },
  },
  {
    name: 'send_booking_link',
    description:
      'Send the business booking link to the caller via SMS when they want to schedule an appointment and the business uses GlossGenius, Fresha, or Booksy. Use this tool when the caller asks to book or schedule and createBooking is not available for this provider.',
    parameters: {
      type: 'object',
      additionalProperties: false,
      properties: {
        callerName: { type: 'string', description: 'Optional caller name.' },
        serviceInterest: { type: 'string', description: 'Optional service or appointment type the caller wants to book.' },
      },
      required: [],
    },
  },
];
