export type ExtractedCallSummary = {
  serviceRequest: string | null;
  urgency: 'low' | 'medium' | 'high';
  nextAction:
    | 'booking_created'
    | 'booking_link_sent'
    | 'callback_scheduled'
    | 'cancellation_requested'
    | 'reschedule_requested'
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

const VALID_URGENCIES = new Set(['low', 'medium', 'high']);
const VALID_NEXT_ACTIONS = new Set([
  'booking_created',
  'booking_link_sent',
  'callback_scheduled',
  'cancellation_requested',
  'reschedule_requested',
  'info_provided',
  'escalated',
  'no_action_needed',
]);

function nullableString(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function parseJsonContent(content: string): unknown {
  const trimmed = content.trim().replace(/^```(?:json)?/i, '').replace(/```$/, '').trim();
  return JSON.parse(trimmed);
}

export async function extractCallSummary(transcriptText: string): Promise<ExtractedCallSummary> {
  if (!transcriptText || transcriptText.trim().length < 50) {
    return SAFE_CALL_SUMMARY_DEFAULTS;
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    console.warn('[extractCallSummary] OPENAI_API_KEY missing');
    return SAFE_CALL_SUMMARY_DEFAULTS;
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
- next_action: one of: "booking_created", "booking_link_sent", "callback_scheduled", "cancellation_requested", "reschedule_requested", "info_provided", "escalated", "no_action_needed".
- caller_question: string or null. Main question the caller asked.
- caller_name: string or null. Name the caller mentioned.
- preferred_tech: string or null. Stylist/technician preference mentioned.
- preferred_datetime: string or null. When caller wants appointment.
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
      return SAFE_CALL_SUMMARY_DEFAULTS;
    }

    const data = await response.json();
    const content = data?.choices?.[0]?.message?.content;
    if (typeof content !== 'string' || !content.trim()) {
      return SAFE_CALL_SUMMARY_DEFAULTS;
    }

    const parsed = parseJsonContent(content) as Record<string, unknown>;
    const urgency = typeof parsed.urgency === 'string' && VALID_URGENCIES.has(parsed.urgency) ? parsed.urgency : 'low';
    const nextAction =
      typeof parsed.next_action === 'string' && VALID_NEXT_ACTIONS.has(parsed.next_action)
        ? parsed.next_action
        : 'no_action_needed';

    return {
      serviceRequest: nullableString(parsed.service_request),
      urgency: urgency as ExtractedCallSummary['urgency'],
      nextAction: nextAction as ExtractedCallSummary['nextAction'],
      callerQuestion: nullableString(parsed.caller_question),
      callerName: nullableString(parsed.caller_name),
      preferredTech: nullableString(parsed.preferred_tech),
      preferredDatetime: nullableString(parsed.preferred_datetime),
      followUpRequired: Boolean(parsed.follow_up_required),
    };
  } catch (err) {
    console.warn('[extractCallSummary] Failed:', err);
    return SAFE_CALL_SUMMARY_DEFAULTS;
  }
}
