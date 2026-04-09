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
        techName: { type: 'string', description: 'Optional requested technician.' },
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
        techName: { type: 'string', description: 'Optional requested technician.' },
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
        newDate: { type: 'string', description: 'New date in YYYY-MM-DD format.' },
        newTime: { type: 'string', description: 'New time in HH:mm format.' },
      },
      required: ['bookingId', 'newDate', 'newTime'],
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
];
