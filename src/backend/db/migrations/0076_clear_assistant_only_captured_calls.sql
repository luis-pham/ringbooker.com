-- Calls with no caller utterance cannot be captured usage or actionable summaries.
update public.call_logs
set
  is_captured_caller = false,
  captured_caller_reason = null,
  captured_at = null,
  summary_service_request = null,
  summary_urgency = 'low',
  summary_next_action = 'no_action_needed',
  summary_caller_question = null,
  summary_caller_name = null,
  summary_preferred_tech = null,
  summary_preferred_datetime = null,
  summary_follow_up_required = false
where transcript_status = 'completed'
  and coalesce(transcript_text, '') !~* '(^|\n).*CALLER:[[:space:]]*\S'
  and (
    is_captured_caller = true
    or summary_service_request is not null
    or summary_next_action in ('booking_created', 'booking_link_sent', 'callback_scheduled')
    or summary_caller_name is not null
    or summary_follow_up_required = true
  );
