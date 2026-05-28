ALTER TABLE call_logs
DROP CONSTRAINT IF EXISTS call_logs_summary_next_action_check;

ALTER TABLE call_logs
ADD CONSTRAINT call_logs_summary_next_action_check
CHECK (summary_next_action IN (
  'booking_created',
  'booking_link_sent',
  'booking_request_incomplete',
  'callback_scheduled',
  'cancellation_requested',
  'reschedule_requested',
  'needs_follow_up',
  'low_confidence_booking_intent',
  'info_provided',
  'escalated',
  'no_action_needed'
));
