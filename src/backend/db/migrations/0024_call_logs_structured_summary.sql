ALTER TABLE call_logs
ADD COLUMN IF NOT EXISTS summary_service_request TEXT;

ALTER TABLE call_logs
ADD COLUMN IF NOT EXISTS summary_urgency TEXT
  CHECK (summary_urgency IN ('low','medium','high'));

ALTER TABLE call_logs
ADD COLUMN IF NOT EXISTS summary_next_action TEXT
  CHECK (summary_next_action IN (
    'booking_created',
    'booking_link_sent',
    'callback_scheduled',
    'cancellation_requested',
    'reschedule_requested',
    'info_provided',
    'escalated',
    'no_action_needed'
  ));

ALTER TABLE call_logs
ADD COLUMN IF NOT EXISTS summary_caller_question TEXT;

ALTER TABLE call_logs
ADD COLUMN IF NOT EXISTS summary_caller_name TEXT;

ALTER TABLE call_logs
ADD COLUMN IF NOT EXISTS summary_preferred_tech TEXT;

ALTER TABLE call_logs
ADD COLUMN IF NOT EXISTS summary_preferred_datetime TEXT;

ALTER TABLE call_logs
ADD COLUMN IF NOT EXISTS summary_follow_up_required BOOLEAN DEFAULT FALSE;
