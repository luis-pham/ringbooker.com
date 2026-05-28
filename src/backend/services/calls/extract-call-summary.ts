export type ExtractedCallSummary = {
  serviceRequest: string | null;
  urgency: 'low' | 'medium' | 'high';
  nextAction:
    | 'booking_created'
    | 'booking_link_sent'
    | 'booking_request_incomplete'
    | 'callback_scheduled'
    | 'cancellation_requested'
    | 'reschedule_requested'
    | 'needs_follow_up'
    | 'low_confidence_booking_intent'
    | 'info_provided'
    | 'escalated'
    | 'no_action_needed';
  callerQuestion: string | null;
  callerName: string | null;
  preferredTech: string | null;
  preferredDatetime: string | null;
  followUpRequired: boolean;
};

export const SAFE_CALL_SUMMARY_DEFAULTS: ExtractedCallSummary = {
  serviceRequest: null,
  urgency: 'low',
  nextAction: 'no_action_needed',
  callerQuestion: null,
  callerName: null,
  preferredTech: null,
  preferredDatetime: null,
  followUpRequired: false,
};

export type ExtractCallSummaryOptions = {
  callerPhone?: string | null;
};

const VALID_URGENCIES = new Set(['low', 'medium', 'high']);
const VALID_NEXT_ACTIONS = new Set([
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
  'no_action_needed',
]);

const BOOKING_INTENT_PATTERN =
  /\b(book|booking|appointment|schedule|make an appointment|set up|come in|get in)\b/i;
const NON_NEW_BOOKING_PATTERN = /\b(cancel|cancellation|reschedule|move my appointment|change my appointment)\b/i;
const BOOKING_SERVICE_PATTERN =
  /\b(color|hair|haircut|blowout|balayage|highlights?|nails?|manicure|pedicure|facial|massage|wax|lashes?|brows?|botox|filler|consultation)\b/i;
const DATE_TIME_PATTERN =
  /\b(today|tomorrow|tonight|morning|afternoon|evening|noon|midnight|monday|tuesday|wednesday|thursday|friday|saturday|sunday|\d{1,2}(?::[0-5]\d)?\s*(?:a\.?\s*m\.?|p\.?\s*m\.?))\b/i;
const PHONE_ATTEMPT_PATTERN =
  /\b(phone|number|call me|text me|reach me|digits?|area code|one|two|three|four|five|six|seven|eight|nine|zero|oh)\b/i;

function hasUsableCallerPhone(callerPhone: string | null | undefined): boolean {
  const trimmed = callerPhone?.trim();
  if (!trimmed) return false;
  return trimmed.replace(/\D/g, '').length >= 8;
}

function callerTranscriptOnly(transcriptText: string): string {
  const callerLines = transcriptText
    .split('\n')
    .filter((line) => /\bCALLER:\s*/i.test(line))
    .map((line) => line.replace(/^.*\bCALLER:\s*/i, '').trim())
    .filter(Boolean);
  return callerLines.length ? callerLines.join(' ') : transcriptText;
}

function partialBookingSummary(transcriptText: string, options?: ExtractCallSummaryOptions): ExtractedCallSummary | null {
  const callerText = callerTranscriptOnly(transcriptText);
  if (!BOOKING_INTENT_PATTERN.test(callerText)) return null;
  if (NON_NEW_BOOKING_PATTERN.test(callerText)) return null;

  const callerPhoneAvailable = hasUsableCallerPhone(options?.callerPhone);
  const hasService = BOOKING_SERVICE_PATTERN.test(callerText);
  const hasDateTime = DATE_TIME_PATTERN.test(callerText);
  const phoneAttempted = !callerPhoneAvailable && PHONE_ATTEMPT_PATTERN.test(callerText);
  if (!hasService && !hasDateTime && !phoneAttempted) {
    return {
      ...SAFE_CALL_SUMMARY_DEFAULTS,
      urgency: 'medium',
      nextAction: 'low_confidence_booking_intent',
      followUpRequired: true,
    };
  }

  return {
    ...SAFE_CALL_SUMMARY_DEFAULTS,
    serviceRequest: callerText.match(BOOKING_SERVICE_PATTERN)?.[0] ?? null,
    urgency: 'medium',
    nextAction: 'booking_request_incomplete',
    preferredDatetime: callerText.match(DATE_TIME_PATTERN)?.[0] ?? null,
    followUpRequired: true,
  };
}

function protectPartialBookingIntent(
  transcriptText: string,
  summary: ExtractedCallSummary,
  options?: ExtractCallSummaryOptions,
): ExtractedCallSummary {
  if (
    summary.nextAction !== 'no_action_needed' &&
    summary.nextAction !== 'low_confidence_booking_intent' &&
    summary.nextAction !== 'needs_follow_up'
  ) {
    return summary;
  }
  const partial = partialBookingSummary(transcriptText, options);
  if (!partial) return summary;
  return {
    ...summary,
    serviceRequest: summary.serviceRequest ?? partial.serviceRequest,
    urgency: summary.urgency === 'low' ? partial.urgency : summary.urgency,
    nextAction: partial.nextAction,
    preferredDatetime: summary.preferredDatetime ?? partial.preferredDatetime,
    followUpRequired: true,
  };
}

function nullableString(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function parseJsonContent(content: string): unknown {
  const trimmed = content.trim().replace(/^```(?:json)?/i, '').replace(/```$/, '').trim();
  return JSON.parse(trimmed);
}

export async function extractCallSummary(transcriptText: string, options?: ExtractCallSummaryOptions): Promise<ExtractedCallSummary> {
  const partial = partialBookingSummary(transcriptText, options);
  if (!transcriptText || transcriptText.trim().length < 50) {
    return partial ?? SAFE_CALL_SUMMARY_DEFAULTS;
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    console.warn('[extractCallSummary] OPENAI_API_KEY missing');
    return partial ?? SAFE_CALL_SUMMARY_DEFAULTS;
  }

  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        max_tokens: 250,
        temperature: 0,
        messages: [
          {
            role: 'user',
            content: `Analyze this call transcript from a beauty business (nail salon, hair salon, spa, med spa, or beauty clinic).

Extract ONLY these fields as JSON. No other text.

Fields:
- service_request: string or null. What service did the caller want?
- urgency: "low" | "medium" | "high". low = general info inquiry, no booking intent; medium = wants to book/general question; high = cancellation, complaint, urgent reschedule.
- next_action: one of: "booking_created", "booking_link_sent", "booking_request_incomplete", "callback_scheduled", "cancellation_requested", "reschedule_requested", "needs_follow_up", "low_confidence_booking_intent", "info_provided", "escalated", "no_action_needed". Use "booking_created" or "booking_link_sent" only if the transcript explicitly contains a successful tool/system confirmation. Use "booking_request_incomplete" when the caller clearly wanted an appointment but required details such as name, service, date, or time are missing or low confidence. Treat phone as already available when caller ID was available for the call; treat phone as missing only if caller ID was unavailable and no callback number was captured. Use "low_confidence_booking_intent" when booking intent is plausible but not clear enough to act on. Do not use either booking success value when the assistant only promised to record a request or said the shop will follow up. If owner follow-up is still required, do not use "booking_created".
- caller_question: string or null. Main question the caller asked.
- caller_name: string or null. Name the caller mentioned.
- preferred_tech: string or null. Stylist/technician preference mentioned.
- preferred_datetime: string or null. Preserve the caller's requested local date/time wording. Never convert it to UTC or invent a timezone.
- follow_up_required: boolean. True if owner needs to follow up.

Transcript:
${transcriptText.slice(0, 3000)}

Respond with ONLY valid JSON, nothing else:
{
  "service_request": null,
  "urgency": "low",
  "next_action": "no_action_needed",
  "caller_question": null,
  "caller_name": null,
  "preferred_tech": null,
  "preferred_datetime": null,
  "follow_up_required": false
}`,
          },
        ],
      }),
    });

    if (!response.ok) {
      console.warn('[extractCallSummary] OpenAI error:', response.status);
      return partial ?? SAFE_CALL_SUMMARY_DEFAULTS;
    }

    const data = await response.json();
    const content = data?.choices?.[0]?.message?.content;
    if (typeof content !== 'string' || !content.trim()) {
      return partial ?? SAFE_CALL_SUMMARY_DEFAULTS;
    }

    const parsed = parseJsonContent(content) as Record<string, unknown>;
    const urgency = typeof parsed.urgency === 'string' && VALID_URGENCIES.has(parsed.urgency) ? parsed.urgency : 'low';
    const nextAction =
      typeof parsed.next_action === 'string' && VALID_NEXT_ACTIONS.has(parsed.next_action)
        ? parsed.next_action
        : 'no_action_needed';

    return protectPartialBookingIntent(
      transcriptText,
      {
        serviceRequest: nullableString(parsed.service_request),
        urgency: urgency as ExtractedCallSummary['urgency'],
        nextAction: nextAction as ExtractedCallSummary['nextAction'],
        callerQuestion: nullableString(parsed.caller_question),
        callerName: nullableString(parsed.caller_name),
        preferredTech: nullableString(parsed.preferred_tech),
        preferredDatetime: nullableString(parsed.preferred_datetime),
        followUpRequired: Boolean(parsed.follow_up_required),
      },
      options,
    );
  } catch (err) {
    console.warn('[extractCallSummary] Failed:', err);
    return partial ?? SAFE_CALL_SUMMARY_DEFAULTS;
  }
}
