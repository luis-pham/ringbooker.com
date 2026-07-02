import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { resolve } from 'node:path';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { REALTIME_TOOL_DEFINITIONS } from '../src/agent/realtime/shared-tool-definitions';
import { validateAppointmentTimeTool } from '../src/agent/tools/validate-appointment-time';
import type { AgentToolContext } from '../src/agent/tools/types';
import { buildSystemPrompt } from '../src/backend/prompts/build-system-prompt';
import type { Shop, ShopVertical } from '../src/backend/domain/types';
import type { VoicePromptVertical } from '../src/agent/prompts/types';

const MODEL = 'gpt-4o';
const MAX_TRANSCRIPT_TURNS = 20;
const OUTPUT_DIR = resolve(process.cwd(), 'reports/voice-ux');
const EVAL_CALLER_ID = '+13125550142';

type Role = 'assistant' | 'caller';
type ScenarioKind = 'clear_booker' | 'no_phone_collection' | 'unclear_booker' | 'noisy_caller' | 'missed_call' | 'high_urgency';
type ExpectedCallStatus = 'Follow up needed' | 'High urgency' | 'Missed';
type ExpectedBookingStatus = 'New' | 'no record';
type ExpectedState = {
  callStatuses: ExpectedCallStatus[];
  bookingStatus: ExpectedBookingStatus;
  service: string | null;
  datetimeUtc: string | null;
  name: string | null;
  phone: string | null;
  noPhantomBooking: boolean;
};
type VerticalFixture = {
  vertical: ShopVertical;
  promptVertical: VoicePromptVertical;
  shop: Shop;
  targetService: string;
};
type Scenario = {
  kind: ScenarioKind;
  persona: string;
  openingLine: string;
  goal: string;
  behavior: string;
  hangsUpAfterGreeting?: boolean;
  expected: ExpectedState;
};
type TranscriptTurn = {
  index: number;
  timestamp: string;
  role: Role;
  text: string;
};
type ToolEvent = {
  timestamp: string;
  afterTurn: number;
  name: string;
  input: Record<string, unknown>;
  result: unknown;
};
type CheckName =
  | 'greeting'
  | 'singleTurn'
  | 'hoursCheck'
  | 'dateValidation'
  | 'timeToolUsage'
  | 'nameConfirm'
  | 'bookingCapture'
  | 'noPhoneCollection'
  | 'fillerOveruse'
  | 'cleanClose';
type EvaluationCheck = {
  pass: boolean;
  reason: string;
  evidence: string[];
};
type Evaluation = {
  checks: Record<CheckName, EvaluationCheck>;
  overall: 'passed' | 'partial' | 'failed';
  summary: string;
};
type ConversationResult = {
  requestId: string;
  fixture: VerticalFixture;
  scenario: Scenario;
  promptLength: number;
  transcript: TranscriptTurn[];
  toolEvents: ToolEvent[];
  evaluation: Evaluation;
  accuracy: AccuracyEvaluation;
  error?: string;
};
type DbCallRecord = {
  id: string;
  outcome: string | null;
  summary_urgency: string | null;
  summary_follow_up_required: boolean | null;
  summary_service_request: string | null;
  summary_preferred_datetime: string | null;
  summary_caller_name: string | null;
};
type DbBookingRecord = {
  id: string;
  status: string;
  service: string | null;
  datetime_utc: string | null;
  customer_name: string | null;
  customer_phone: string | null;
};
type PersistedState = {
  call: DbCallRecord | null;
  booking: DbBookingRecord | null;
  blocker?: string;
};
type AccuracyCheckName =
  | 'callStatus'
  | 'bookingStatus'
  | 'service'
  | 'datetime'
  | 'name'
  | 'phone'
  | 'noPhantom';
type AccuracyCheck = {
  pass: boolean;
  expected: string;
  actual: string;
  evidence: string;
};
type AccuracyEvaluation = {
  checks: Record<AccuracyCheckName, AccuracyCheck>;
  overall: 'passed' | 'failed' | 'blocked';
  persisted: PersistedState;
};
type ChatToolCall = {
  id: string;
  type: 'function';
  function: { name: string; arguments: string };
};
type ChatMessage =
  | { role: 'system' | 'user'; content: string }
  | { role: 'assistant'; content: string | null; tool_calls?: ChatToolCall[] }
  | { role: 'tool'; tool_call_id: string; content: string };
type ChatAssistantResponse = { content: string | null; tool_calls?: ChatToolCall[] };

const appointmentValidationDefinition = REALTIME_TOOL_DEFINITIONS.find((tool) => tool.name === 'validate_appointment_time');
if (!appointmentValidationDefinition) throw new Error('validate_appointment_time tool definition is missing.');
const APPOINTMENT_VALIDATION_TOOL = {
  type: 'function',
  function: appointmentValidationDefinition,
} as const;

function loadLocalEnv(): void {
  const path = resolve(process.cwd(), '.env');
  if (!existsSync(path)) return;
  for (const line of readFileSync(path, 'utf8').split(/\r?\n/)) {
    const match = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*?)\s*$/);
    if (!match || line.trim().startsWith('#') || process.env[match[1]]) continue;
    let value = match[2];
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    process.env[match[1]] = value;
  }
}

function commonShop(id: string, name: string, vertical: ShopVertical): Shop {
  return {
    id,
    name,
    vertical,
    phone_number: '+13125550100',
    user_phone: '+13125550101',
    handoff_phone: '+13125550102',
    address: '214 West Maple Street, Chicago, IL 60610',
    timezone: 'America/Chicago',
    services: [],
    hours: {
      mon: { open: '09:00', close: '19:00' },
      tue: { open: '09:00', close: '19:00' },
      wed: { open: '09:00', close: '19:00' },
      thu: { open: '09:00', close: '19:00' },
      fri: { open: '09:00', close: '18:00' },
      sat: { open: '09:00', close: '16:00' },
      sun: { closed: true },
    },
    cancel_policy: 'Please provide at least 24 hours notice for changes or cancellation.',
    booking_url: null,
    booking_method: null,
    selected_integration: null,
    ai_welcome_message: `Thank you for calling ${name}, how can I help you today?`,
    allow_transfers: false,
    allow_callbacks: false,
    send_reminder_sms: true,
    send_review_request_sms: false,
    send_missed_call_followup_sms: true,
    plan: 'professional',
    active: true,
    languages: ['en'],
    country_code: 'US',
  };
}

function buildFixtures(): VerticalFixture[] {
  const nail = commonShop('eval-nail-salon', 'Luna Nail Studio', 'nail_salon');
  nail.services = [
    { name: 'Gel Manicure', duration_min: 45, price: 42 },
    { name: 'Signature Pedicure', duration_min: 60, price: 58 },
    { name: 'Dip Powder Set', duration_min: 60, price: 55 },
  ];
  nail.staff = [{ name: 'Mina', role: 'Nail technician', specialties: ['Gel manicure', 'Nail art'] }];

  const hair = commonShop('eval-hair-salon', 'Cedar and Bloom Hair Salon', 'hair_salon');
  hair.services = [
    { name: "Women's Haircut", duration_min: 60, price: 72 },
    { name: 'Blowout', duration_min: 45, price: 55 },
    { name: 'Balayage', duration_min: 180, price: 220 },
  ];
  hair.staff = [{ name: 'Jordan', role: 'Stylist', specialties: ['Haircuts', 'Balayage'] }];

  const spa = commonShop('eval-day-spa', 'Willow Day Spa', 'day_spa');
  spa.services = [
    { name: 'Swedish Massage', duration_min: 60, price: 110 },
    { name: 'Deep Tissue Massage', duration_min: 60, price: 130 },
    { name: 'Signature Facial', duration_min: 60, price: 125 },
  ];
  spa.staff = [{ name: 'Leah', role: 'Therapist', specialties: ['Massage', 'Facials'] }];

  const medSpa = commonShop('eval-med-spa', 'Harbor Med Spa', 'med_spa');
  medSpa.services = [
    { name: 'Skin Consultation', duration_min: 30, price: 0 },
    { name: 'Hydrafacial', duration_min: 60, price: 225 },
    { name: 'Laser Hair Removal Consultation', duration_min: 30, price: 0 },
  ];
  medSpa.staff = [{ name: 'Dr. Rivera', role: 'Clinical provider', specialties: ['Skin consultations'] }];

  return [
    { vertical: 'nail_salon', promptVertical: 'nail-salon', shop: nail, targetService: 'Gel Manicure' },
    { vertical: 'hair_salon', promptVertical: 'hair-salon', shop: hair, targetService: "Women's Haircut" },
    { vertical: 'day_spa', promptVertical: 'day-spa', shop: spa, targetService: 'Swedish Massage' },
    { vertical: 'med_spa', promptVertical: 'med-spa', shop: medSpa, targetService: 'Hydrafacial' },
  ];
}

function scenariosFor(fixture: VerticalFixture): Scenario[] {
  const service = fixture.targetService;
  return [
    {
      kind: 'clear_booker',
      persona: 'A cooperative caller who knows exactly what they want and answers briefly.',
      openingLine: `Hi, I would like to book a ${service} on Thursday, May 28, 2026 at 10 AM.`,
      goal: `Submit a request for ${service} on Thursday, May 28, 2026 at 10 AM under Maya Reed. Do not provide a phone number because caller ID is already available.`,
      behavior:
        'Provide the requested service and time immediately. Give your name when asked. Do not provide a phone number because caller ID is already available; if asked for one, say "Please use my caller ID." Confirm spellings and details clearly. Accept that the shop will confirm the request; do not ask for a live guaranteed slot.',
      expected: {
        callStatuses: ['Follow up needed'],
        bookingStatus: 'New',
        service,
        datetimeUtc: '2026-05-28T15:00:00.000Z',
        name: 'Maya Reed',
        phone: EVAL_CALLER_ID,
        noPhantomBooking: false,
      },
    },
    {
      kind: 'no_phone_collection',
      persona: 'A cooperative caller with clear booking intent who answers only the question asked.',
      openingLine: `Hi, I want to book a ${service} on Thursday, May 28, 2026 at 10 AM.`,
      goal: `Submit a request for ${service} on Thursday, May 28, 2026 at 10 AM under Maya Reed. Do not provide a phone number because caller ID is already available.`,
      behavior:
        'Provide the requested service and time immediately. Give your name when asked. If the assistant asks for a phone number, say "You should have my caller ID." Otherwise accept that the shop will follow up and say goodbye.',
      expected: {
        callStatuses: ['Follow up needed'],
        bookingStatus: 'New',
        service,
        datetimeUtc: '2026-05-28T15:00:00.000Z',
        name: 'Maya Reed',
        phone: EVAL_CALLER_ID,
        noPhantomBooking: false,
      },
    },
    {
      kind: 'unclear_booker',
      persona: 'A polite but vague caller who initially proposes a time after the shop is closed.',
      openingLine: `I want to book something like ${service}, maybe Thursday, May 28, 2026 around 8:30 PM.`,
      goal: `After the assistant rejects the outside-hours time, request ${service} on Thursday, May 28, 2026 at 11 AM under Sofia Kim. Do not provide a phone number because caller ID is already available.`,
      behavior:
        'Your first proposed time must remain 8:30 PM until the assistant states it is outside business hours. Only then choose 11 AM on Thursday, May 28, 2026. Provide your name only after a valid time has been accepted for capture. If asked for a phone number, say "Please use my caller ID."',
      expected: {
        callStatuses: ['Follow up needed'],
        bookingStatus: 'New',
        service,
        datetimeUtc: '2026-05-28T16:00:00.000Z',
        name: 'Sofia Kim',
        phone: EVAL_CALLER_ID,
        noPhantomBooking: false,
      },
    },
    {
      kind: 'noisy_caller',
      persona: 'A caller on a noisy line who provides only a partial request, then drops.',
      openingLine: 'Uh, I need... maybe an appointment, but the line is noisy.',
      goal: `Mention interest in ${service}, then leave before giving appointment details or contact information.`,
      behavior:
        `Answer one early service question with the unrelated fragment "My sister sent me." If the assistant clarifies, state ${service}. When asked for a date, time, name, or phone, say "Sorry, I have to go now. Goodbye." Do not provide any contact detail.`,
      expected: {
        callStatuses: ['Follow up needed', 'High urgency'],
        bookingStatus: 'no record',
        service: null,
        datetimeUtc: null,
        name: null,
        phone: null,
        noPhantomBooking: true,
      },
    },
    {
      kind: 'missed_call',
      persona: 'A caller who disconnects as soon as the greeting begins.',
      openingLine: '',
      goal: 'Leave no spoken request and create no booking.',
      behavior: 'Hang up without speaking.',
      hangsUpAfterGreeting: true,
      expected: {
        callStatuses: ['Missed'],
        bookingStatus: 'no record',
        service: null,
        datetimeUtc: null,
        name: null,
        phone: null,
        noPhantomBooking: true,
      },
    },
    {
      kind: 'high_urgency',
      persona: 'A cooperative caller who explicitly states an urgent same-day need.',
      openingLine: `I need an appointment today, it is urgent. I need a ${service} at 3 PM.`,
      goal: `Capture an urgent request for ${service} on Wednesday, May 27, 2026 at 3 PM under Jordan Lee. Do not provide a phone number because caller ID is already available.`,
      behavior:
        'Emphasize once that the appointment is urgent. If asked for a date, clarify Wednesday, May 27, 2026 at 3 PM. Provide Jordan Lee when asked. If asked for a phone number, say "Please use my caller ID." Accept follow-up by the team.',
      expected: {
        callStatuses: ['High urgency'],
        bookingStatus: 'New',
        service,
        datetimeUtc: '2026-05-27T20:00:00.000Z',
        name: 'Jordan Lee',
        phone: EVAL_CALLER_ID,
        noPhantomBooking: false,
      },
    },
  ];
}

async function requestChatCompletion(
  messages: ChatMessage[],
  purpose: string,
  json = false,
  tools?: readonly unknown[],
  toolChoice?: unknown,
): Promise<ChatAssistantResponse> {
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) throw new Error('OPENAI_API_KEY is missing.');
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${apiKey}`,
  };
  if (process.env.OPENAI_ORGANIZATION?.trim()) {
    headers['OpenAI-Organization'] = process.env.OPENAI_ORGANIZATION.trim();
  }
  if (process.env.OPENAI_PROJECT?.trim()) {
    headers['OpenAI-Project'] = process.env.OPENAI_PROJECT.trim();
  }
  let lastError = '';
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers,
      body: JSON.stringify({
        model: MODEL,
        temperature: purpose === 'evaluator' ? 0 : 0.35,
        max_tokens: purpose === 'evaluator' ? 1600 : 220,
        ...(json ? { response_format: { type: 'json_object' } } : {}),
        ...(tools ? { tools, tool_choice: toolChoice ?? 'auto' } : {}),
        messages,
      }),
    });
    if (response.ok) {
      const body = (await response.json()) as {
        choices?: Array<{ message?: ChatAssistantResponse }>;
      };
      const message = body.choices?.[0]?.message;
      if (!message || (!message.content?.trim() && !message.tool_calls?.length)) {
        throw new Error(`OpenAI ${purpose} response was empty.`);
      }
      return { ...message, content: message.content?.trim() ?? null };
    }
    lastError = `${response.status}: ${(await response.text()).slice(0, 300)}`;
    if (attempt < 3 && (response.status === 429 || response.status >= 500)) {
      await new Promise((resolvePromise) => setTimeout(resolvePromise, attempt * 1000));
      continue;
    }
    break;
  }
  throw new Error(`OpenAI ${purpose} request failed: ${lastError}`);
}

async function chatCompletion(messages: ChatMessage[], purpose: string, json = false): Promise<string> {
  const response = await requestChatCompletion(messages, purpose, json);
  if (!response.content) throw new Error(`OpenAI ${purpose} returned a tool call unexpectedly.`);
  return response.content;
}

function appendTurn(transcript: TranscriptTurn[], role: Role, text: string): void {
  transcript.push({
    index: transcript.length + 1,
    timestamp: new Date().toISOString(),
    role,
    text: text.replace(/\s+/g, ' ').trim(),
  });
}

function formattedTranscript(transcript: TranscriptTurn[]): string {
  return transcript
    .map((turn) => `T${turn.index} [${turn.timestamp}] ${turn.role.toUpperCase()}: ${turn.text}`)
    .join('\n');
}

function hasCleanEnding(text: string): boolean {
  return /\b(goodbye|bye|have a (?:good|great|wonderful) day|thank you for calling|thanks for calling)\b/i.test(text);
}

async function executeValidationTool(
  fixture: VerticalFixture,
  state: NonNullable<AgentToolContext['appointmentTimeValidation']>,
  input: Record<string, unknown>,
): Promise<unknown> {
  const ctx = {
    shop: fixture.shop,
    appointmentTimeValidation: state,
  } as AgentToolContext;
  return validateAppointmentTimeTool(ctx, input);
}

function mentionsBookingFlow(text: string): boolean {
  return /\b(book(?:ing)?|appointment|schedul(?:e|ing)?|reschedul(?:e|ing)?|availability)\b/i.test(text)
    || /\b(?:what|which)\s+(?:date|day|time)\b/i.test(text)
    || /\b(?:date|day)\s+and\s+time\b/i.test(text);
}

function includesSpecificTime(text: string): boolean {
  return /\b\d{1,2}(?::[0-5]\d)?\s*(?:a\.?\s*m\.?|p\.?\s*m\.?)\b/i.test(text)
    || /\b(?:noon|midnight)\b/i.test(text)
    || /\b(?:at|around|by)\s+\d{1,2}(?::[0-5]\d)?\b/i.test(text);
}

function requiresSidebandForcedValidation(messages: ChatMessage[]): boolean {
  const latestCallerText = messages.findLast((message) => message.role === 'user')?.content ?? '';
  const bookingFlowActive = messages.some((message) => {
    if (message.role === 'system' || message.role === 'tool') return false;
    return mentionsBookingFlow(message.content ?? '');
  });
  return bookingFlowActive && includesSpecificTime(latestCallerText);
}

async function generateAgentReply(params: {
  fixture: VerticalFixture;
  messages: ChatMessage[];
  transcript: TranscriptTurn[];
  toolEvents: ToolEvent[];
  validationState: NonNullable<AgentToolContext['appointmentTimeValidation']>;
}): Promise<string> {
  for (let toolRound = 0; toolRound < 4; toolRound += 1) {
    const forceValidation = toolRound === 0 && requiresSidebandForcedValidation(params.messages);
    const response = await requestChatCompletion(
      params.messages,
      'agent',
      false,
      [APPOINTMENT_VALIDATION_TOOL],
      forceValidation ? { type: 'function', function: { name: 'validate_appointment_time' } } : undefined,
    );
    if (!response.tool_calls?.length) {
      if (!response.content) throw new Error('Agent produced neither speech nor a tool call.');
      params.messages.push({ role: 'assistant', content: response.content });
      return response.content;
    }

    params.messages.push({
      role: 'assistant',
      content: response.content,
      tool_calls: response.tool_calls,
    });
    for (const call of response.tool_calls) {
      let input: Record<string, unknown> = {};
      try {
        input = JSON.parse(call.function.arguments) as Record<string, unknown>;
      } catch {
        input = {};
      }
      const result =
        call.function.name === 'validate_appointment_time'
          ? await executeValidationTool(params.fixture, params.validationState, input)
          : { error: `Unsupported test tool: ${call.function.name}` };
      params.toolEvents.push({
        timestamp: new Date().toISOString(),
        afterTurn: params.transcript.at(-1)?.index ?? 0,
        name: call.function.name,
        input,
        result,
      });
      params.messages.push({
        role: 'tool',
        tool_call_id: call.id,
        content: JSON.stringify(result),
      });
    }
  }
  throw new Error('Agent exceeded maximum tool rounds before replying.');
}

async function simulateConversation(
  fixture: VerticalFixture,
  scenario: Scenario,
  systemPrompt: string,
): Promise<{ transcript: TranscriptTurn[]; toolEvents: ToolEvent[] }> {
  const transcript: TranscriptTurn[] = [];
  const toolEvents: ToolEvent[] = [];
  const validationState: NonNullable<AgentToolContext['appointmentTimeValidation']> = { latest: null };
  const greeting = await chatCompletion(
    [
      { role: 'system', content: systemPrompt },
      {
        role: 'user',
        content:
          '[VOICE TEST HARNESS EVENT] The inbound phone line has just connected. Deliver only your required opening greeting, then wait for the caller.',
      },
    ],
    'agent',
  );
  appendTurn(transcript, 'assistant', greeting);
  if (scenario.hangsUpAfterGreeting) return { transcript, toolEvents };
  appendTurn(transcript, 'caller', scenario.openingLine);
  const agentMessages: ChatMessage[] = [
    { role: 'system', content: systemPrompt },
    { role: 'assistant', content: greeting },
    { role: 'user', content: scenario.openingLine },
  ];

  while (transcript.length < MAX_TRANSCRIPT_TURNS) {
    const assistant = await generateAgentReply({
      fixture,
      messages: agentMessages,
      transcript,
      toolEvents,
      validationState,
    });
    appendTurn(transcript, 'assistant', assistant);
    if (hasCleanEnding(assistant) || transcript.length >= MAX_TRANSCRIPT_TURNS) break;

    const caller = await chatCompletion(
      [
        {
          role: 'system',
          content: [
            'You are simulating a caller in a phone UX test.',
            `Persona: ${scenario.persona}`,
            `Goal: ${scenario.goal}`,
            `Behavior rules: ${scenario.behavior}`,
            'Reply with only one natural caller utterance. Never speak as the assistant or describe your behavior.',
            'Stay engaged until the receptionist gives a clear next step, then say goodbye briefly if needed.',
          ].join('\n'),
        },
        {
          role: 'user',
          content: `Conversation so far:\n${formattedTranscript(transcript)}\n\nGive the caller's next utterance.`,
        },
      ],
      'caller',
    );
    appendTurn(transcript, 'caller', caller);
    agentMessages.push({ role: 'user', content: caller });
  }
  return { transcript, toolEvents };
}

function createDatabaseClient(): SupabaseClient | null {
  const url = process.env.SUPABASE_URL?.trim();
  const serviceKey = process.env.SUPABASE_SERVICE_KEY?.trim();
  if (!url || !serviceKey) return null;
  return createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

async function checkDatabaseReadiness(supabase: SupabaseClient | null): Promise<string | null> {
  if (!supabase) {
    return 'Supabase configuration is missing.';
  }
  const { error } = await supabase.from('call_logs').select('id').limit(1);
  return error ? `call_logs preflight query failed: ${error.message}` : null;
}

async function readPersistedState(
  supabase: SupabaseClient | null,
  requestId: string,
  databaseBlocker: string | null,
): Promise<PersistedState> {
  if (databaseBlocker) {
    return { call: null, booking: null, blocker: databaseBlocker };
  }
  if (!supabase) {
    return { call: null, booking: null, blocker: 'Supabase configuration is missing.' };
  }
  const { data: call, error: callError } = await supabase
    .from('call_logs')
    .select(
      'id,outcome,summary_urgency,summary_follow_up_required,summary_service_request,summary_preferred_datetime,summary_caller_name',
    )
    .eq('request_id', requestId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle<DbCallRecord>();
  if (callError) {
    return { call: null, booking: null, blocker: `call_logs query failed: ${callError.message}` };
  }
  if (!call) {
    return {
      call: null,
      booking: null,
      blocker:
        'No call_logs record exists for this correlation ID. The tool-aware conversation runner does not execute the production call lifecycle.',
    };
  }
  const candidateCallIds = [requestId, call.id];
  const { data: bookings, error: bookingError } = await supabase
    .from('bookings')
    .select('id,status,service,datetime_utc,customer_name,customer_phone')
    .in('call_log_id', candidateCallIds)
    .order('created_at', { ascending: false })
    .limit(1)
    .returns<DbBookingRecord[]>();
  if (bookingError) {
    return { call, booking: null, blocker: `bookings query failed: ${bookingError.message}` };
  }
  return { call, booking: bookings?.[0] ?? null };
}

function displayCallStatus(call: DbCallRecord | null): string {
  if (!call) return 'no record';
  if (call.outcome === 'missed') return 'Missed';
  if (call.summary_urgency === 'high') return 'High urgency';
  if (call.summary_follow_up_required) return 'Follow up needed';
  return 'missing status';
}

function displayBookingStatus(booking: DbBookingRecord | null): string {
  if (!booking) return 'no record';
  if (booking.status === 'pending' || booking.status === 'captured') return 'New';
  return booking.status;
}

function normalizedPhone(value: string | null): string {
  return value?.replace(/[^\d+]/g, '') ?? 'no record';
}

function transcriptEvidence(transcript: TranscriptTurn[], expected: string | null): string {
  const lowered = expected?.toLowerCase();
  const relevant =
    (lowered
      ? transcript.findLast((turn) => turn.role === 'caller' && turn.text.toLowerCase().includes(lowered))
      : null) ??
    transcript.findLast((turn) => turn.role === 'caller') ??
    transcript[transcript.length - 1];
  return relevant ? `T${relevant.index} ${relevant.role.toUpperCase()}: ${relevant.text}` : 'No transcript turn.';
}

function accuracyCheck(
  pass: boolean,
  expected: string,
  actual: string,
  evidence: string,
): AccuracyCheck {
  return { pass, expected, actual, evidence };
}

function evaluateAccuracy(
  scenario: Scenario,
  transcript: TranscriptTurn[],
  persisted: PersistedState,
): AccuracyEvaluation {
  const expected = scenario.expected;
  const blocked = Boolean(persisted.blocker);
  const blocker = persisted.blocker ?? null;
  const actualCallStatus = blocker ?? displayCallStatus(persisted.call);
  const actualBookingStatus = blocker ?? displayBookingStatus(persisted.booking);
  const booking = persisted.booking;
  const genericEvidence = transcriptEvidence(transcript, expected.service);
  const expectsBooking = expected.bookingStatus !== 'no record';
  const checks: Record<AccuracyCheckName, AccuracyCheck> = {
    callStatus: accuracyCheck(
      !blocked && expected.callStatuses.includes(actualCallStatus as ExpectedCallStatus),
      expected.callStatuses.join(' OR '),
      actualCallStatus,
      genericEvidence,
    ),
    bookingStatus: accuracyCheck(
      !blocked && actualBookingStatus === expected.bookingStatus,
      expected.bookingStatus,
      actualBookingStatus,
      genericEvidence,
    ),
    service: accuracyCheck(
      !blocked && (expectsBooking ? booking?.service === expected.service : booking === null),
      expected.service ?? 'no booking service',
      blocker ?? booking?.service ?? 'no record',
      transcriptEvidence(transcript, expected.service),
    ),
    datetime: accuracyCheck(
      !blocked && (expectsBooking ? booking?.datetime_utc === expected.datetimeUtc : booking === null),
      expected.datetimeUtc ?? 'no booking datetime',
      blocker ?? booking?.datetime_utc ?? 'no record',
      transcriptEvidence(transcript, expected.datetimeUtc),
    ),
    name: accuracyCheck(
      !blocked && (expectsBooking ? booking?.customer_name === expected.name : booking === null),
      expected.name ?? 'no booking name',
      blocker ?? booking?.customer_name ?? 'no record',
      transcriptEvidence(transcript, expected.name),
    ),
    phone: accuracyCheck(
      !blocked &&
        (expectsBooking ? normalizedPhone(booking?.customer_phone ?? null) === expected.phone : booking === null),
      expected.phone ?? 'no booking phone',
      blocker ?? normalizedPhone(booking?.customer_phone ?? null),
      transcriptEvidence(transcript, expected.phone),
    ),
    noPhantom: accuracyCheck(
      !blocked && (!expected.noPhantomBooking || booking === null),
      expected.noPhantomBooking ? 'no record' : 'booking permitted',
      blocker ?? (booking ? `booking ${booking.id}` : 'no record'),
      genericEvidence,
    ),
  };
  return {
    checks,
    persisted,
    overall: blocked ? 'blocked' : Object.values(checks).every((check) => check.pass) ? 'passed' : 'failed',
  };
}

function fallbackEvaluation(message: string): Evaluation {
  const failed = (reason: string): EvaluationCheck => ({ pass: false, reason, evidence: [] });
  return {
    checks: {
      greeting: failed(message),
      singleTurn: failed(message),
      hoursCheck: failed(message),
      dateValidation: failed(message),
      timeToolUsage: failed(message),
      nameConfirm: failed(message),
      bookingCapture: failed(message),
      noPhoneCollection: failed(message),
      fillerOveruse: failed(message),
      cleanClose: failed(message),
    },
    overall: 'failed',
    summary: message,
  };
}

function normalizeEvaluation(raw: string): Evaluation {
  const expected: CheckName[] = [
    'greeting',
    'singleTurn',
    'hoursCheck',
    'dateValidation',
    'timeToolUsage',
    'nameConfirm',
    'bookingCapture',
    'noPhoneCollection',
    'fillerOveruse',
    'cleanClose',
  ];
  try {
    const parsed = JSON.parse(raw) as Partial<Evaluation> & {
      checks?: Partial<Record<CheckName, Partial<EvaluationCheck>>>;
    };
    const checks = {} as Record<CheckName, EvaluationCheck>;
    for (const key of expected) {
      const value = parsed.checks?.[key];
      checks[key] = {
        pass: value?.pass === true,
        reason: typeof value?.reason === 'string' ? value.reason : 'Evaluator did not provide a reason.',
        evidence: Array.isArray(value?.evidence)
          ? value.evidence.filter((item): item is string => typeof item === 'string')
          : [],
      };
    }
    const failedCount = expected.filter((key) => !checks[key].pass).length;
    const derivedOverall = failedCount === 0 ? 'passed' : failedCount <= 2 ? 'partial' : 'failed';
    return {
      checks,
      overall:
        parsed.overall === 'passed' || parsed.overall === 'partial' || parsed.overall === 'failed'
          ? parsed.overall
          : derivedOverall,
      summary: typeof parsed.summary === 'string' ? parsed.summary : `${failedCount} checks failed.`,
    };
  } catch {
    return fallbackEvaluation('Evaluator returned invalid JSON.');
  }
}

function applyDeterministicNameConfirmationCheck(
  evaluation: Evaluation,
  scenario: Scenario,
  transcript: TranscriptTurn[],
): Evaluation {
  const clearlySpokenCommonName =
    scenario.kind === 'clear_booker' || scenario.kind === 'no_phone_collection'
      ? 'Maya Reed'
      : scenario.kind === 'unclear_booker'
        ? 'Sofia Kim'
        : scenario.kind === 'high_urgency'
          ? 'Jordan Lee'
          : null;
  if (
    clearlySpokenCommonName &&
    transcript.some(
      (turn) =>
        turn.role === 'caller' &&
        turn.text.toLowerCase().includes(clearlySpokenCommonName.toLowerCase()),
    )
  ) {
    evaluation.checks.nameConfirm = {
      pass: true,
      reason: 'Caller clearly stated a common name; the active policy does not require read-back.',
      evidence: [],
    };
    const failedCount = Object.values(evaluation.checks).filter((check) => !check.pass).length;
    evaluation.overall = failedCount === 0 ? 'passed' : failedCount <= 2 ? 'partial' : 'failed';
    return evaluation;
  }
  if (scenario.kind !== 'noisy_caller') return evaluation;
  const expectedName = 'Ari Lee';
  const normalizedName = expectedName.toLowerCase();
  const nameProvidedIndex = transcript.findIndex(
    (turn) => turn.role === 'caller' && turn.text.toLowerCase().includes(normalizedName),
  );
  if (nameProvidedIndex < 0) return evaluation;
  const confirmationQuestionIndex = transcript.findIndex(
    (turn, index) =>
      index > nameProvidedIndex &&
      turn.role === 'assistant' &&
      turn.text.toLowerCase().includes(normalizedName) &&
      /\b(confirm|is that|correct)\b/i.test(turn.text),
  );
  const callerConfirmedIndex = transcript.findIndex(
    (turn, index) =>
      index > confirmationQuestionIndex &&
      turn.role === 'caller' &&
      /\b(yes|correct|that's correct|that is correct|right)\b/i.test(turn.text),
  );
  if (nameProvidedIndex >= 0 && confirmationQuestionIndex >= 0 && callerConfirmedIndex >= 0) {
    return evaluation;
  }
  const offending =
    transcript.find(
      (turn, index) =>
        index > nameProvidedIndex && turn.role === 'assistant' && turn.text.toLowerCase().includes(normalizedName),
    ) ?? transcript[transcript.length - 1];
  evaluation.checks.nameConfirm = {
    pass: false,
    reason: `The assistant did not receive explicit confirmation of the caller name "${expectedName}" before using or closing with it.`,
    evidence: offending ? [`T${offending.index} ${offending.role.toUpperCase()}: ${offending.text}`] : [],
  };
  const failedCount = Object.values(evaluation.checks).filter((check) => !check.pass).length;
  evaluation.overall = failedCount === 0 ? 'passed' : failedCount <= 2 ? 'partial' : 'failed';
  return evaluation;
}

function applyDeterministicDateValidationCheck(
  evaluation: Evaluation,
  transcript: TranscriptTurn[],
): Evaluation {
  const offending = transcript.find(
    (turn) =>
      turn.role === 'assistant' &&
      /\b(?:far|too far|quite far)\b[\s\S]*\bfuture\b|\bfuture\b[\s\S]*\b(?:far|too far|quite far)\b/i.test(
        turn.text,
      ),
  );
  if (!offending) return evaluation;
  evaluation.checks.dateValidation = {
    pass: false,
    reason: 'The assistant rejected a valid future appointment date without a configured booking-window policy.',
    evidence: [`T${offending.index} ${offending.role.toUpperCase()}: ${offending.text}`],
  };
  const failedCount = Object.values(evaluation.checks).filter((check) => !check.pass).length;
  evaluation.overall = failedCount === 0 ? 'passed' : failedCount <= 2 ? 'partial' : 'failed';
  return evaluation;
}

function assistantAsksForPhone(text: string): boolean {
  return /\b(?:phone number|callback number|best number|good number|number to reach|what(?:'s| is)\s+(?:a\s+)?(?:good\s+)?number|could i have (?:your )?(?:phone|number)|can i have (?:your )?(?:phone|number)|may i have (?:your )?(?:phone|number)|text you.*number|reach you.*number)\b/i.test(text);
}

function applyDeterministicNoPhoneCollectionCheck(
  evaluation: Evaluation,
  transcript: TranscriptTurn[],
): Evaluation {
  const offending = transcript.find((turn) => turn.role === 'assistant' && assistantAsksForPhone(turn.text));
  evaluation.checks.noPhoneCollection = offending
    ? {
        pass: false,
        reason: 'The assistant asked for a phone number even though caller ID is available and the caller did not request a different callback number.',
        evidence: [`T${offending.index} ${offending.role.toUpperCase()}: ${offending.text}`],
      }
    : {
        pass: true,
        reason: 'No unprompted phone-number collection was observed.',
        evidence: [],
      };
  const failedCount = Object.values(evaluation.checks).filter((check) => !check.pass).length;
  evaluation.overall = failedCount === 0 ? 'passed' : failedCount <= 2 ? 'partial' : 'failed';
  return evaluation;
}

function formattedToolTrace(toolEvents: ToolEvent[]): string {
  if (toolEvents.length === 0) return 'No tool calls.';
  return toolEvents
    .map(
      (event, index) =>
        `V${index + 1} after T${event.afterTurn}: ${event.name}(${JSON.stringify(event.input)}) => ${JSON.stringify(event.result)}`,
    )
    .join('\n');
}

function applyDeterministicTimeToolCheck(
  evaluation: Evaluation,
  scenario: Scenario,
  toolEvents: ToolEvent[],
): Evaluation {
  const validationEvents = toolEvents.filter((event) => event.name === 'validate_appointment_time');
  let failure: string | null = null;
  if (scenario.kind === 'clear_booker') {
    if (!validationEvents.some((event) => (event.result as { valid?: boolean }).valid === true)) {
      failure = 'The assistant did not silently validate and accept the supplied appointment time before responding.';
    }
  } else if (scenario.kind === 'no_phone_collection') {
    if (!validationEvents.some((event) => (event.result as { valid?: boolean }).valid === true)) {
      failure = 'The assistant did not silently validate and accept the supplied appointment time before responding.';
    }
  } else if (scenario.kind === 'unclear_booker') {
    const rejected = validationEvents.some((event) => (event.result as { valid?: boolean }).valid === false);
    const accepted = validationEvents.some((event) => (event.result as { valid?: boolean }).valid === true);
    if (!rejected || !accepted) {
      failure = 'The assistant did not validate both the outside-hours proposal and the corrected in-hours proposal.';
    }
  } else if (scenario.kind === 'high_urgency' && validationEvents.length === 0) {
    failure = 'The assistant did not validate the requested urgent appointment time before responding.';
  }

  evaluation.checks.timeToolUsage = failure
    ? { pass: false, reason: failure, evidence: [formattedToolTrace(toolEvents)] }
    : { pass: true, reason: 'Required appointment-time validation tool sequence was observed.', evidence: [] };
  const failedCount = Object.values(evaluation.checks).filter((check) => !check.pass).length;
  evaluation.overall = failedCount === 0 ? 'passed' : failedCount <= 2 ? 'partial' : 'failed';
  return evaluation;
}

async function evaluateConversation(
  fixture: VerticalFixture,
  scenario: Scenario,
  transcript: TranscriptTurn[],
  toolEvents: ToolEvent[],
): Promise<Evaluation> {
  const raw = await chatCompletion(
    [
      {
        role: 'system',
        content: [
          'You are a strict QA evaluator for an AI phone receptionist.',
          'Return JSON only. Evaluate the supplied transcript, not hypothetical behavior.',
          'Use this exact shape:',
          '{"checks":{"greeting":{"pass":true,"reason":"","evidence":[]},"singleTurn":{"pass":true,"reason":"","evidence":[]},"hoursCheck":{"pass":true,"reason":"","evidence":[]},"dateValidation":{"pass":true,"reason":"","evidence":[]},"timeToolUsage":{"pass":true,"reason":"","evidence":[]},"nameConfirm":{"pass":true,"reason":"","evidence":[]},"bookingCapture":{"pass":true,"reason":"","evidence":[]},"noPhoneCollection":{"pass":true,"reason":"","evidence":[]},"fillerOveruse":{"pass":true,"reason":"","evidence":[]},"cleanClose":{"pass":true,"reason":"","evidence":[]}},"overall":"passed|partial|failed","summary":""}',
          'Evidence for failed checks must contain the exact offending transcript turn text prefixed by its T number.',
          'Rules:',
          'GREETING passes only if the initial assistant turn is a greeting and names the correct business.',
          'SINGLE TURN fails if any two assistant turns appear consecutively without a caller turn.',
          'HOURS CHECK: for unclear_booker, the first offered 8:30 PM time must be rejected as outside business hours before name or booking capture proceeds. For other cases, pass unless an outside-hours time was accepted.',
          'DATE VALIDATION fails if the assistant calls May 28, 2026 too far in the future or refuses that future date without an explicit booking-window policy. The test date is May 27, 2026 and May 28 is a valid future appointment date.',
          'TIME TOOL USAGE passes only when supplied appointment times are silently evaluated by validate_appointment_time before the assistant accepts or rejects them. unclear_booker must validate both the initial invalid time and the corrected valid time.',
          'NAME CONFIRM: a clearly spoken common name such as Maya, Sofia, or Jordan can be acknowledged without read-back. A short, uncommon, unclear, noisy-line, or spelled name requires an explicit confirmation question and a later caller affirmation before use. If the scenario deliberately hangs up before giving a name, pass this check.',
          'BOOKING CAPTURE: for clear_booker, no_phone_collection, unclear_booker, and high_urgency, pass when service, requested date/time, and caller name are gathered; phone is satisfied by caller ID and must not be asked for unless caller ID is missing or caller asks to use a different number. A manual request pending shop confirmation is acceptable. For noisy_caller and missed_call, pass when the assistant does not claim a complete booking after the caller drops without full information.',
          'NO PHONE COLLECTION passes only if the assistant never asks for phone number, callback number, best number, or good number when caller ID is available and the caller did not request a different callback number.',
          'FILLER OVERUSE fails if the same filler phrase is used more than once.',
          'CLEAN CLOSE passes only if a clear next step is stated before the call closes and the assistant is not still awaiting a required answer or name confirmation.',
          'Overall is passed when all checks pass, partial for one or two failed checks, failed for three or more.',
        ].join('\n'),
      },
      {
        role: 'user',
        content: [
          `Business name: ${fixture.shop.name}`,
          `Vertical: ${fixture.vertical}`,
          `Scenario: ${scenario.kind}`,
          `Scenario goal: ${scenario.goal}`,
          'Hours: Monday-Thursday 9:00 AM-7:00 PM; Friday 9:00 AM-6:00 PM; Saturday 9:00 AM-4:00 PM; Sunday closed.',
          '',
          'Transcript:',
          formattedTranscript(transcript),
          '',
          'Tool trace:',
          formattedToolTrace(toolEvents),
        ].join('\n'),
      },
    ],
    'evaluator',
    true,
  );
  return applyDeterministicTimeToolCheck(
    applyDeterministicNoPhoneCollectionCheck(
      applyDeterministicDateValidationCheck(
        applyDeterministicNameConfirmationCheck(normalizeEvaluation(raw), scenario, transcript),
        transcript,
      ),
      transcript,
    ),
    scenario,
    toolEvents,
  );
}

function status(check: { pass: boolean }): string {
  return check.pass ? 'PASS' : 'FAIL';
}

function accuracyStatus(check: AccuracyCheck, overall: AccuracyEvaluation['overall']): string {
  if (overall === 'blocked') return 'BLOCKED';
  return status(check);
}

function reportMarkdown(results: ConversationResult[], generatedAt: string): string {
  const lines: string[] = [
    '# RingBooker Automated Voice UX Evaluation',
    '',
    `- Generated: ${generatedAt}`,
    `- Model: \`${MODEL}\` for caller, agent, and evaluator`,
    '- Prompt source: production `buildSystemPrompt()` composed for Professional test shops',
    `- Conversation cap: ${MAX_TRANSCRIPT_TURNS} logged utterances per scenario`,
    '- Harness note: an unlogged connection event triggers the first greeting; all scored turns are shown below.',
    '- Harness note: appointment-time checks execute the production `validate_appointment_time` tool implementation; no booking or call records are created.',
    '- State note: the accuracy layer performs read-only Supabase queries by per-scenario correlation ID. It reports BLOCKED if the database is unavailable or if this tool-aware runner did not produce a runtime call record.',
    '',
    '| Vertical | Scenario | Greeting | Single Turn | Hours Check | Date Validation | Time Tool | Name Confirm | Booking Capture | No Phone Ask | Filler | Clean Close | Overall |',
    '| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |',
  ];
  for (const result of results) {
    const c = result.evaluation.checks;
    lines.push(
      `| ${result.fixture.vertical} | ${result.scenario.kind} | ${status(c.greeting)} | ${status(c.singleTurn)} | ${status(c.hoursCheck)} | ${status(c.dateValidation)} | ${status(c.timeToolUsage)} | ${status(c.nameConfirm)} | ${status(c.bookingCapture)} | ${status(c.noPhoneCollection)} | ${status(c.fillerOveruse)} | ${status(c.cleanClose)} | ${result.evaluation.overall.toUpperCase()} |`,
    );
  }

  lines.push(
    '',
    '## Data Accuracy And State Correctness',
    '',
    '| Vertical | Scenario | Call Status | Booking Status | Service | Datetime | Name | Phone | No Phantom | Overall |',
    '| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |',
  );
  for (const result of results) {
    const c = result.accuracy.checks;
    lines.push(
      `| ${result.fixture.vertical} | ${result.scenario.kind} | ${accuracyStatus(c.callStatus, result.accuracy.overall)} | ${accuracyStatus(c.bookingStatus, result.accuracy.overall)} | ${accuracyStatus(c.service, result.accuracy.overall)} | ${accuracyStatus(c.datetime, result.accuracy.overall)} | ${accuracyStatus(c.name, result.accuracy.overall)} | ${accuracyStatus(c.phone, result.accuracy.overall)} | ${accuracyStatus(c.noPhantom, result.accuracy.overall)} | ${result.accuracy.overall.toUpperCase()} |`,
    );
  }

  lines.push('', '### Blocked Or Failed Accuracy Checks', '');
  const accuracyFailures = results.filter((result) => result.accuracy.overall !== 'passed');
  if (accuracyFailures.length === 0) lines.push('No accuracy checks failed or were blocked.');
  for (const result of accuracyFailures) {
    lines.push(
      `#### ${result.fixture.vertical} / ${result.scenario.kind} - ${result.requestId}`,
      '',
    );
    if (result.accuracy.persisted.blocker) {
      lines.push(`- State verification blocked: ${result.accuracy.persisted.blocker}`);
    }
    for (const [checkName, check] of Object.entries(result.accuracy.checks)) {
      if (check.pass) continue;
      lines.push(`- ${checkName}: expected \`${check.expected}\`; actual \`${check.actual}\``);
      lines.push(`  - Originating turn: \`${check.evidence.replace(/`/g, "'")}\``);
    }
    lines.push('');
  }

  lines.push('', '## Failed Or Partial Cases', '');
  const withFailures = results.filter((result) =>
    Object.values(result.evaluation.checks).some((check) => !check.pass),
  );
  if (withFailures.length === 0) lines.push('No checks failed.');
  for (const result of withFailures) {
    const failedChecks = Object.entries(result.evaluation.checks).filter(([, check]) => !check.pass);
    lines.push(`### ${result.fixture.vertical} / ${result.scenario.kind} - ${result.evaluation.overall.toUpperCase()}`, '');
    for (const [checkName, check] of failedChecks) {
      lines.push(`- ${checkName}: ${check.reason}`);
      const evidence = check.evidence.length > 0 ? check.evidence : ['No exact turn returned by evaluator.'];
      for (const line of evidence) lines.push(`  - \`${line.replace(/`/g, "'")}\``);
    }
    lines.push('');
  }

  lines.push('## Full Transcripts', '');
  for (const result of results) {
    lines.push(`### ${result.fixture.vertical} / ${result.scenario.kind}`, '');
    lines.push(`Prompt length: ${result.promptLength} characters. Overall: ${result.evaluation.overall.toUpperCase()}.`, '');
    lines.push('```text', formattedTranscript(result.transcript) || `ERROR: ${result.error ?? 'No transcript.'}`, '```', '');
    lines.push('Tool trace:', '```text', formattedToolTrace(result.toolEvents), '```', '');
  }
  return `${lines.join('\n')}\n`;
}

async function main(): Promise<void> {
  loadLocalEnv();
  if (!process.env.OPENAI_API_KEY?.trim()) throw new Error('OPENAI_API_KEY is required to run voice UX evals.');
  const fixtures = buildFixtures();
  const supabase = createDatabaseClient();
  const databaseBlocker = await checkDatabaseReadiness(supabase);
  const results: ConversationResult[] = [];
  let completed = 0;
  const total = fixtures.length * 5;

  for (const fixture of fixtures) {
    const systemPrompt = buildSystemPrompt({
      shop: fixture.shop,
      customer: null,
      mode: 'inbound',
      vertical: fixture.promptVertical,
    });
    for (const scenario of scenariosFor(fixture)) {
      const requestId = randomUUID();
      process.stdout.write(`[voice-ux] Running ${fixture.vertical}/${scenario.kind}...\n`);
      try {
        const { transcript, toolEvents } = await simulateConversation(fixture, scenario, systemPrompt);
        const evaluation = await evaluateConversation(fixture, scenario, transcript, toolEvents);
        const persisted = await readPersistedState(supabase, requestId, databaseBlocker);
        const accuracy = evaluateAccuracy(scenario, transcript, persisted);
        results.push({ requestId, fixture, scenario, promptLength: systemPrompt.length, transcript, toolEvents, evaluation, accuracy });
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        const persisted = { call: null, booking: null, blocker: message };
        results.push({
          requestId,
          fixture,
          scenario,
          promptLength: systemPrompt.length,
          transcript: [],
          toolEvents: [],
          evaluation: fallbackEvaluation(message),
          accuracy: evaluateAccuracy(scenario, [], persisted),
          error: message,
        });
      }
      completed += 1;
      process.stdout.write(`[voice-ux] Completed ${completed}/${total}.\n`);
    }
  }

  const generatedAt = new Date().toISOString();
  const markdown = reportMarkdown(results, generatedAt);
  mkdirSync(OUTPUT_DIR, { recursive: true });
  writeFileSync(resolve(OUTPUT_DIR, 'latest-report.md'), markdown, 'utf8');
  writeFileSync(resolve(OUTPUT_DIR, 'latest-results.json'), JSON.stringify({ generatedAt, model: MODEL, results }, null, 2), 'utf8');
  process.stdout.write(`\n${markdown}`);
  process.stdout.write(`\n[voice-ux] Files written to ${OUTPUT_DIR}\n`);
  const failures = results.filter(
    (result) => result.evaluation.overall !== 'passed' || result.accuracy.overall !== 'passed',
  ).length;
  process.exitCode = failures > 0 ? 1 : 0;
}

async function runNoPhoneCollectionOnly(): Promise<void> {
  loadLocalEnv();
  if (!process.env.OPENAI_API_KEY?.trim()) throw new Error('OPENAI_API_KEY is required to run voice UX evals.');
  const fixtures = buildFixtures();
  const supabase = createDatabaseClient();
  const databaseBlocker = await checkDatabaseReadiness(supabase);
  const results: ConversationResult[] = [];
  let completed = 0;
  const total = fixtures.length;

  process.stdout.write(`\n[voice-ux] === no_phone_collection scenarios (${total}) ===\n`);
  for (const fixture of fixtures) {
    const systemPrompt = buildSystemPrompt({
      shop: fixture.shop,
      customer: null,
      mode: 'inbound',
      vertical: fixture.promptVertical,
    });
    const scenario = scenariosFor(fixture).find((item) => item.kind === 'no_phone_collection');
    if (!scenario) continue;
    const requestId = randomUUID();
    process.stdout.write(`[voice-ux] Running ${fixture.vertical}/${scenario.kind}...\n`);
    try {
      const { transcript, toolEvents } = await simulateConversation(fixture, scenario, systemPrompt);
      const evaluation = await evaluateConversation(fixture, scenario, transcript, toolEvents);
      const persisted = await readPersistedState(supabase, requestId, databaseBlocker);
      const accuracy = evaluateAccuracy(scenario, transcript, persisted);
      results.push({ requestId, fixture, scenario, promptLength: systemPrompt.length, transcript, toolEvents, evaluation, accuracy });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      const persisted = { call: null, booking: null, blocker: message };
      results.push({
        requestId,
        fixture,
        scenario,
        promptLength: systemPrompt.length,
        transcript: [],
        toolEvents: [],
        evaluation: fallbackEvaluation(message),
        accuracy: evaluateAccuracy(scenario, [], persisted),
        error: message,
      });
    }
    completed += 1;
    process.stdout.write(`[voice-ux] Completed ${completed}/${total}.\n`);
  }

  const generatedAt = new Date().toISOString();
  const markdown = reportMarkdown(results, generatedAt);
  mkdirSync(OUTPUT_DIR, { recursive: true });
  writeFileSync(resolve(OUTPUT_DIR, 'latest-no-phone-report.md'), markdown, 'utf8');
  writeFileSync(resolve(OUTPUT_DIR, 'latest-no-phone-results.json'), JSON.stringify({ generatedAt, model: MODEL, results }, null, 2), 'utf8');
  process.stdout.write(`\n${markdown}`);
  process.stdout.write(`\n[voice-ux] no_phone_collection files written to ${OUTPUT_DIR}\n`);
  const failures = results.filter(
    (result) => result.evaluation.overall !== 'passed' || result.accuracy.overall !== 'passed',
  ).length;
  process.exitCode = failures > 0 ? 1 : 0;
}

async function runClearBookerOnly(): Promise<void> {
  loadLocalEnv();
  if (!process.env.OPENAI_API_KEY?.trim()) throw new Error('OPENAI_API_KEY is required to run voice UX evals.');
  const fixtures = buildFixtures();
  const supabase = createDatabaseClient();
  const databaseBlocker = await checkDatabaseReadiness(supabase);
  const results: ConversationResult[] = [];
  let completed = 0;
  const total = fixtures.length;

  process.stdout.write(`\n[voice-ux] === clear_booker scenarios (${total}) ===\n`);
  for (const fixture of fixtures) {
    const systemPrompt = buildSystemPrompt({
      shop: fixture.shop,
      customer: null,
      mode: 'inbound',
      vertical: fixture.promptVertical,
    });
    const scenario = scenariosFor(fixture).find((item) => item.kind === 'clear_booker');
    if (!scenario) continue;
    const requestId = randomUUID();
    process.stdout.write(`[voice-ux] Running ${fixture.vertical}/${scenario.kind}...\n`);
    try {
      const { transcript, toolEvents } = await simulateConversation(fixture, scenario, systemPrompt);
      const evaluation = await evaluateConversation(fixture, scenario, transcript, toolEvents);
      const persisted = await readPersistedState(supabase, requestId, databaseBlocker);
      const accuracy = evaluateAccuracy(scenario, transcript, persisted);
      results.push({ requestId, fixture, scenario, promptLength: systemPrompt.length, transcript, toolEvents, evaluation, accuracy });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      const persisted = { call: null, booking: null, blocker: message };
      results.push({
        requestId,
        fixture,
        scenario,
        promptLength: systemPrompt.length,
        transcript: [],
        toolEvents: [],
        evaluation: fallbackEvaluation(message),
        accuracy: evaluateAccuracy(scenario, [], persisted),
        error: message,
      });
    }
    completed += 1;
    process.stdout.write(`[voice-ux] Completed ${completed}/${total}.\n`);
  }

  const generatedAt = new Date().toISOString();
  const markdown = reportMarkdown(results, generatedAt);
  mkdirSync(OUTPUT_DIR, { recursive: true });
  writeFileSync(resolve(OUTPUT_DIR, 'latest-clear-booker-report.md'), markdown, 'utf8');
  writeFileSync(
    resolve(OUTPUT_DIR, 'latest-clear-booker-results.json'),
    JSON.stringify({ generatedAt, model: MODEL, results }, null, 2),
    'utf8',
  );
  process.stdout.write(`\n${markdown}`);
  process.stdout.write(`\n[voice-ux] clear_booker files written to ${OUTPUT_DIR}\n`);
  const failures = results.filter(
    (result) => result.evaluation.overall !== 'passed' || result.accuracy.overall !== 'passed',
  ).length;
  process.exitCode = failures > 0 ? 1 : 0;
}

// ─────────────────────────────────────────────────────────────────────────────
// EXTENDED SCENARIOS — 8 new scenario types × 4 verticals = 32 new scenarios
// ─────────────────────────────────────────────────────────────────────────────

type ExtScenarioKind =
  | 'cancel_reschedule'
  | 'price_inquiry'
  | 'wrong_number'
  | 'silent_caller'
  | 'unsupported_language'
  | 'angry_caller'
  | 'after_hours'
  | 'duplicate_booking';

type ExtCheckName = 'greeting' | 'singleTurn' | 'correctInfo' | 'toneHold' | 'noForceBook' | 'gracefulExit';

type ExtEvaluationCheck = { pass: boolean; reason: string; evidence: string[] };

type ExtEvaluation = {
  checks: Record<ExtCheckName, ExtEvaluationCheck>;
  overall: 'passed' | 'partial' | 'failed';
  summary: string;
};

type ExtScenario = {
  kind: ExtScenarioKind;
  persona: string;
  openingLine: string;
  goal: string;
  behavior: string;
  /** If set, inject this into the harness-event context (e.g. after-hours time). */
  afterHoursNote?: string;
  /** If > 0, simulate this many silent (empty) caller turns before normal persona takes over. */
  silentTurns?: number;
  /** Expected price string in AI reply, e.g. "$42". Used for correctInfo deterministic check. */
  expectedPrice?: string;
  /** Expected business name. Used for correctInfo deterministic check. */
  expectedBusinessName?: string;
};

type ExtConversationResult = {
  requestId: string;
  fixture: VerticalFixture;
  scenario: ExtScenario;
  transcript: TranscriptTurn[];
  evaluation: ExtEvaluation;
  error?: string;
};

// ─── Price lookup helpers ─────────────────────────────────────────────────────

function servicePriceForFixture(fixture: VerticalFixture): { name: string; price: number } {
  const svc = fixture.shop.services.find((s) => s.name === fixture.targetService);
  return { name: fixture.targetService, price: svc?.price ?? 0 };
}

function formatPrice(cents: number): string {
  return cents === 0 ? 'free' : `$${cents}`;
}

// ─── Scenario definitions — 8 per fixture ────────────────────────────────────

function extScenariosFor(fixture: VerticalFixture): ExtScenario[] {
  const { name: svcName, price: svcPrice } = servicePriceForFixture(fixture);
  const shopName = fixture.shop.name;
  const priceStr = svcPrice === 0 ? 'free' : `$${svcPrice}`;

  // Wrong-number opening varies per vertical so callers don't all say the same wrong name
  const wrongNames: Record<string, string> = {
    nail_salon: 'Crystal Nails',
    hair_salon: 'Oak Park Nail Bar',
    day_spa: 'Harbor Med Spa',
    med_spa: 'Willow Day Spa',
  };
  const wrongName = wrongNames[fixture.vertical] ?? 'another business';

  // Non-English opening varies per vertical
  const foreignOpening: Record<string, string> = {
    nail_salon: 'Hola, ¿puedo hacer una cita para mañana?',
    hair_salon: 'Hola, quisiera reservar un corte de cabello por favor.',
    day_spa: 'Hola, me gustaría reservar un masaje para esta semana.',
    med_spa: '안녕하세요, 예약하고 싶습니다.',
  };
  const foreign = foreignOpening[fixture.vertical] ?? 'Hola, necesito una cita.';

  return [
    // ── 1. Cancel / Reschedule ──────────────────────────────────────────────
    {
      kind: 'cancel_reschedule',
      persona: 'A polite caller who wants to cancel an existing appointment tomorrow.',
      openingLine: 'Hi, I need to cancel my appointment for tomorrow.',
      goal: 'Have the AI acknowledge the cancellation request, capture name and phone and original appointment detail, and confirm the team will follow up.',
      behavior:
        'Provide your name (Alex Huang), phone (+1 312 555 0210), and say the appointment was for a Gel Manicure at 11 AM tomorrow. Do not request a new booking. Accept the follow-up promise and close.',
    },
    // ── 2. Price Inquiry ────────────────────────────────────────────────────
    {
      kind: 'price_inquiry',
      persona: 'A price-conscious caller who asks about cost before deciding to book.',
      openingLine: `How much does a ${svcName} cost?`,
      goal: `Hear the correct price (${priceStr}) and then say you are just browsing for now and decline to book today.`,
      behavior:
        `Wait for the price answer. After hearing it, say "Thanks, I'm just browsing for now" and gently end. Do not agree to book.`,
      expectedPrice: priceStr,
      expectedBusinessName: shopName,
    },
    // ── 3. Wrong Number ─────────────────────────────────────────────────────
    {
      kind: 'wrong_number',
      persona: 'A confused caller who thinks they have reached a different business.',
      openingLine: `Is this ${wrongName}?`,
      goal: `Hear the AI confirm it is ${shopName}, then politely say wrong number and end the call.`,
      behavior: `After hearing the correct business name, say "Oh sorry, wrong number" and end. Do not ask to book.`,
      expectedBusinessName: shopName,
    },
    // ── 4. Silent Caller ────────────────────────────────────────────────────
    {
      kind: 'silent_caller',
      persona: 'A caller who connects but says nothing for several turns.',
      openingLine: '',
      goal: 'Observe whether the AI prompts at most twice then closes gracefully without looping.',
      behavior: 'Remain completely silent for 3 turns. If the AI says goodbye, stay silent.',
      silentTurns: 3,
    },
    // ── 5. Unsupported Language ─────────────────────────────────────────────
    {
      kind: 'unsupported_language',
      persona: 'A caller who speaks only in a language not listed in the shop language config.',
      openingLine: foreign,
      goal: 'Observe whether the AI stays in English, acknowledges politely, and offers an alternative path.',
      behavior:
        'Respond only in the same non-English language for all turns. Do not switch to English.',
    },
    // ── 6. Angry Caller ─────────────────────────────────────────────────────
    {
      kind: 'angry_caller',
      persona: 'An upset caller who had a bad experience at their last appointment.',
      openingLine: "I'm really unhappy with my last appointment. It was completely unprofessional.",
      goal: 'Observe whether the AI stays calm, acknowledges without arguing, offers to pass the message to the team, and closes with a clear next step.',
      behavior:
        'Express frustration clearly but do not threaten. If the AI tries to immediately book, say "I don\'t want to book anything right now." Accept the follow-up promise once given.',
    },
    // ── 7. After Hours ──────────────────────────────────────────────────────
    {
      kind: 'after_hours',
      persona: 'A cooperative caller who calls outside business hours wanting to book.',
      openingLine: `Hi, I'd like to book a ${svcName} for tomorrow at 2 PM.`,
      goal: 'Observe whether the AI acknowledges the shop is currently closed, still captures the booking request, and promises follow-up during business hours.',
      behavior:
        `Say you'd like a ${svcName} tomorrow at 2 PM. Provide your name (Sam Patel) and phone (+1 312 555 0220) when asked. Accept the follow-up promise.`,
      afterHoursNote: 'HARNESS CONTEXT: Current local time is Wednesday, May 27, 2026 at 9:30 PM America/Chicago. The shop is currently CLOSED (business hours: Mon–Thu 9 AM–7 PM).',
    },
    // ── 8. Duplicate Booking Same Day ───────────────────────────────────────
    {
      kind: 'duplicate_booking',
      persona: 'A caller who already booked and immediately calls back to book again for the same time.',
      openingLine: `Hi, I just called and booked a ${svcName} for tomorrow at 2 PM — I want to book another one for a friend.`,
      goal: 'Observe whether the AI captures the second booking without referencing the first call.',
      behavior:
        `Confirm you want a second ${svcName} tomorrow at 2 PM for your friend. Provide name (Jamie Cole) and phone (+1 312 555 0230) when asked. Accept the request confirmation.`,
    },
  ];
}

// ─── Simulation for extended scenarios ───────────────────────────────────────

async function simulateExtConversation(
  fixture: VerticalFixture,
  scenario: ExtScenario,
  systemPrompt: string,
): Promise<{ transcript: TranscriptTurn[]; toolEvents: ToolEvent[] }> {
  const transcript: TranscriptTurn[] = [];
  const toolEvents: ToolEvent[] = [];
  const validationState: NonNullable<AgentToolContext['appointmentTimeValidation']> = { latest: null };

  // Inject after-hours context into the initial harness event if needed
  const harnessTrigger = scenario.afterHoursNote
    ? `[VOICE TEST HARNESS EVENT] ${scenario.afterHoursNote} The inbound phone line has just connected. Deliver only your required opening greeting (acknowledging the shop is currently closed), then wait for the caller.`
    : '[VOICE TEST HARNESS EVENT] The inbound phone line has just connected. Deliver only your required opening greeting, then wait for the caller.';

  const greeting = await chatCompletion(
    [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: harnessTrigger },
    ],
    'agent',
  );
  appendTurn(transcript, 'assistant', greeting);

  // Silent caller: send empty opening — don't build a full caller-persona turn
  const openingLine = scenario.silentTurns && scenario.silentTurns > 0 ? '[silence]' : scenario.openingLine;
  if (!openingLine && !scenario.silentTurns) return { transcript, toolEvents };
  if (openingLine) appendTurn(transcript, 'caller', openingLine);

  const agentMessages: ChatMessage[] = [
    { role: 'system', content: systemPrompt },
    { role: 'assistant', content: greeting },
    { role: 'user', content: openingLine || '' },
  ];

  let silentTurnsRemaining = (scenario.silentTurns ?? 0) - (openingLine ? 1 : 0);

  while (transcript.length < MAX_TRANSCRIPT_TURNS) {
    const assistant = await generateAgentReply({
      fixture,
      messages: agentMessages,
      transcript,
      toolEvents,
      validationState,
    });
    appendTurn(transcript, 'assistant', assistant);
    if (hasCleanEnding(assistant) || transcript.length >= MAX_TRANSCRIPT_TURNS) break;

    let callerUtterance: string;
    if (silentTurnsRemaining > 0) {
      // Still in silent phase
      callerUtterance = '[silence]';
      silentTurnsRemaining -= 1;
    } else {
      callerUtterance = await chatCompletion(
        [
          {
            role: 'system',
            content: [
              'You are simulating a caller in a phone UX test.',
              `Persona: ${scenario.persona}`,
              `Goal: ${scenario.goal}`,
              `Behavior rules: ${scenario.behavior}`,
              'Reply with only one natural caller utterance. Never speak as the assistant or describe your behavior.',
              'Stay engaged until the receptionist gives a clear next step, then say goodbye briefly if needed.',
            ].join('\n'),
          },
          {
            role: 'user',
            content: `Conversation so far:\n${formattedTranscript(transcript)}\n\nGive the caller's next utterance.`,
          },
        ],
        'caller',
      );
    }
    appendTurn(transcript, 'caller', callerUtterance);
    agentMessages.push({ role: 'user', content: callerUtterance });
  }
  return { transcript, toolEvents };
}

// ─── Evaluation for extended scenarios ───────────────────────────────────────

function fallbackExtEvaluation(message: string): ExtEvaluation {
  const failed = (): ExtEvaluationCheck => ({ pass: false, reason: message, evidence: [] });
  return {
    checks: {
      greeting: failed(),
      singleTurn: failed(),
      correctInfo: failed(),
      toneHold: failed(),
      noForceBook: failed(),
      gracefulExit: failed(),
    },
    overall: 'failed',
    summary: message,
  };
}

function normalizeExtEvaluation(raw: string): ExtEvaluation {
  const expected: ExtCheckName[] = ['greeting', 'singleTurn', 'correctInfo', 'toneHold', 'noForceBook', 'gracefulExit'];
  try {
    const parsed = JSON.parse(raw) as Partial<ExtEvaluation> & {
      checks?: Partial<Record<ExtCheckName, Partial<ExtEvaluationCheck>>>;
    };
    const checks = {} as Record<ExtCheckName, ExtEvaluationCheck>;
    for (const key of expected) {
      const value = parsed.checks?.[key];
      checks[key] = {
        pass: value?.pass === true,
        reason: typeof value?.reason === 'string' ? value.reason : 'Evaluator did not provide a reason.',
        evidence: Array.isArray(value?.evidence)
          ? value.evidence.filter((item): item is string => typeof item === 'string')
          : [],
      };
    }
    const failedCount = expected.filter((key) => !checks[key].pass).length;
    const derivedOverall: ExtEvaluation['overall'] = failedCount === 0 ? 'passed' : failedCount <= 2 ? 'partial' : 'failed';
    return {
      checks,
      overall:
        parsed.overall === 'passed' || parsed.overall === 'partial' || parsed.overall === 'failed'
          ? parsed.overall
          : derivedOverall,
      summary: typeof parsed.summary === 'string' ? parsed.summary : `${failedCount} checks failed.`,
    };
  } catch {
    return fallbackExtEvaluation('Evaluator returned invalid JSON.');
  }
}

/** Deterministic correctInfo check: verify price and business name appear in transcript. */
function applyDeterministicCorrectInfoCheck(
  evaluation: ExtEvaluation,
  scenario: ExtScenario,
  transcript: TranscriptTurn[],
): ExtEvaluation {
  const assistantText = transcript
    .filter((t) => t.role === 'assistant')
    .map((t) => t.text)
    .join(' ');

  if (scenario.expectedPrice && scenario.kind === 'price_inquiry') {
    const priceNum = scenario.expectedPrice.replace('$', '').trim();
    const hasMentioned =
      assistantText.includes(scenario.expectedPrice) ||
      assistantText.toLowerCase().includes(`${priceNum} dollars`) ||
      (scenario.expectedPrice === 'free' && /\bfree\b/i.test(assistantText));
    if (!hasMentioned) {
      const offending = transcript.find((t) => t.role === 'assistant');
      evaluation.checks.correctInfo = {
        pass: false,
        reason: `Expected price "${scenario.expectedPrice}" was not found in any assistant turn.`,
        evidence: offending ? [`T${offending.index} ASSISTANT: ${offending.text}`] : [],
      };
      const failedCount = Object.values(evaluation.checks).filter((c) => !c.pass).length;
      evaluation.overall = failedCount === 0 ? 'passed' : failedCount <= 2 ? 'partial' : 'failed';
    }
  }

  if (scenario.expectedBusinessName && scenario.kind === 'wrong_number') {
    const hasName = assistantText.toLowerCase().includes(scenario.expectedBusinessName.toLowerCase());
    if (!hasName) {
      const offending = transcript.find((t) => t.role === 'assistant');
      evaluation.checks.correctInfo = {
        pass: false,
        reason: `Business name "${scenario.expectedBusinessName}" was not stated by the assistant.`,
        evidence: offending ? [`T${offending.index} ASSISTANT: ${offending.text}`] : [],
      };
      const failedCount = Object.values(evaluation.checks).filter((c) => !c.pass).length;
      evaluation.overall = failedCount === 0 ? 'passed' : failedCount <= 2 ? 'partial' : 'failed';
    }
  }

  return evaluation;
}

/** Deterministic singleTurn check: no two consecutive assistant turns. */
function applyDeterministicExtSingleTurnCheck(
  evaluation: ExtEvaluation,
  transcript: TranscriptTurn[],
): ExtEvaluation {
  const offending = transcript.find(
    (turn, index) =>
      turn.role === 'assistant' &&
      index > 0 &&
      transcript[index - 1]?.role === 'assistant',
  );
  if (offending) {
    evaluation.checks.singleTurn = {
      pass: false,
      reason: 'Two consecutive assistant turns found without a caller turn between them.',
      evidence: [`T${offending.index} ASSISTANT: ${offending.text}`],
    };
    const failedCount = Object.values(evaluation.checks).filter((c) => !c.pass).length;
    evaluation.overall = failedCount === 0 ? 'passed' : failedCount <= 2 ? 'partial' : 'failed';
  }
  return evaluation;
}

async function evaluateExtConversation(
  fixture: VerticalFixture,
  scenario: ExtScenario,
  transcript: TranscriptTurn[],
): Promise<ExtEvaluation> {
  const raw = await chatCompletion(
    [
      {
        role: 'system',
        content: [
          'You are a strict QA evaluator for an AI phone receptionist evaluating extended UX scenarios.',
          'Return JSON only. Evaluate the supplied transcript against the scenario description.',
          'Use this exact JSON shape:',
          '{"checks":{"greeting":{"pass":true,"reason":"","evidence":[]},"singleTurn":{"pass":true,"reason":"","evidence":[]},"correctInfo":{"pass":true,"reason":"","evidence":[]},"toneHold":{"pass":true,"reason":"","evidence":[]},"noForceBook":{"pass":true,"reason":"","evidence":[]},"gracefulExit":{"pass":true,"reason":"","evidence":[]}},"overall":"passed|partial|failed","summary":""}',
          'Evidence for failed checks must contain the exact offending transcript turn text prefixed by its T number.',
          '',
          'RULES:',
          'GREETING passes only if the initial assistant turn is a greeting naming the correct business.',
          'SINGLE TURN fails if any two assistant turns appear consecutively without a caller turn between them.',
          'CORRECT INFO passes when all verifiable factual claims by the AI match the shop config: prices quoted match the actual service price, business name used is correct, and hours/closed status stated correctly. If the scenario does not test a specific factual claim, pass by default.',
          'TONE HOLD passes when the AI maintains a calm, professional, non-aggressive tone throughout all turns. Fails if AI argues, sounds dismissive, or mirrors caller frustration. Passes by default for non-emotional scenarios.',
          'NO FORCE BOOK passes when the AI does not push the caller to book when it is inappropriate: (a) during a cancellation/complaint, (b) when caller says just browsing, (c) when caller confirms wrong number, (d) when silent caller triggers close. Fails if the AI inserts booking prompts in those situations. Passes by default for booking-oriented scenarios.',
          'GRACEFUL EXIT passes when the call closes with a clear, explicit next step (e.g. "the team will follow up", "we will call you back during business hours", "have a great day") before the conversation ends. Fails if the call ends abruptly or without a stated next step.',
          'Overall is passed when all checks pass, partial for one or two failed checks, failed for three or more.',
        ].join('\n'),
      },
      {
        role: 'user',
        content: [
          `Business name: ${fixture.shop.name}`,
          `Vertical: ${fixture.vertical}`,
          `Scenario: ${scenario.kind}`,
          `Scenario goal: ${scenario.goal}`,
          `Persona: ${scenario.persona}`,
          `Services and prices: ${fixture.shop.services.map((s) => `${s.name} = ${s.price === 0 ? 'free' : '$' + String(s.price)}`).join(', ')}`,
          'Hours: Monday-Thursday 9:00 AM-7:00 PM; Friday 9:00 AM-6:00 PM; Saturday 9:00 AM-4:00 PM; Sunday closed.',
          scenario.afterHoursNote ? `After-hours context given to AI: ${scenario.afterHoursNote}` : '',
          '',
          'Transcript:',
          formattedTranscript(transcript),
        ].filter(Boolean).join('\n'),
      },
    ],
    'evaluator',
    true,
  );

  let evaluation = normalizeExtEvaluation(raw);
  evaluation = applyDeterministicExtSingleTurnCheck(evaluation, transcript);
  evaluation = applyDeterministicCorrectInfoCheck(evaluation, scenario, transcript);
  return evaluation;
}

// ─── Extended report section ──────────────────────────────────────────────────

function extReportMarkdown(results: ExtConversationResult[], generatedAt: string): string {
  const lines: string[] = [
    '',
    '---',
    '',
    '## Extended Voice UX Evaluation — New Scenario Types',
    '',
    `- Generated: ${generatedAt}`,
    `- 32 new scenarios: 8 types × 4 verticals (nail_salon, hair_salon, day_spa, med_spa)`,
    `- New evaluation checks: Correct Info, Tone Hold, No Force Book, Graceful Exit`,
    '',
    '| Vertical | Scenario | Greeting | Single Turn | Correct Info | Tone Hold | No Force Book | Graceful Exit | Overall |',
    '| --- | --- | --- | --- | --- | --- | --- | --- | --- |',
  ];

  for (const result of results) {
    const c = result.evaluation.checks;
    lines.push(
      `| ${result.fixture.vertical} | ${result.scenario.kind} | ${status(c.greeting)} | ${status(c.singleTurn)} | ${status(c.correctInfo)} | ${status(c.toneHold)} | ${status(c.noForceBook)} | ${status(c.gracefulExit)} | ${result.evaluation.overall.toUpperCase()} |`,
    );
  }

  lines.push('', '### Extended Scenario Failures And Partial Results', '');
  const withFailures = results.filter((result) =>
    Object.values(result.evaluation.checks).some((check) => !check.pass),
  );
  if (withFailures.length === 0) {
    lines.push('No checks failed across all 32 extended scenarios.');
  }
  for (const result of withFailures) {
    const failedChecks = Object.entries(result.evaluation.checks).filter(([, check]) => !check.pass);
    lines.push(`#### ${result.fixture.vertical} / ${result.scenario.kind} — ${result.evaluation.overall.toUpperCase()}`, '');
    for (const [checkName, check] of failedChecks) {
      lines.push(`- **${checkName}**: ${check.reason}`);
      const evidence = check.evidence.length > 0 ? check.evidence : ['No exact turn returned by evaluator.'];
      for (const line of evidence) lines.push(`  - \`${line.replace(/`/g, "'")}\``);
    }
    lines.push(`  - Summary: ${result.evaluation.summary}`, '');
  }

  lines.push('', '### Extended Scenario Full Transcripts', '');
  for (const result of results) {
    lines.push(`#### ${result.fixture.vertical} / ${result.scenario.kind}`, '');
    lines.push(`Overall: ${result.evaluation.overall.toUpperCase()}`, '');
    lines.push('```text', formattedTranscript(result.transcript) || `ERROR: ${result.error ?? 'No transcript.'}`, '```', '');
  }

  return lines.join('\n');
}

// ─── Extended main — appended to existing main ───────────────────────────────

async function mainWithExtensions(): Promise<void> {
  loadLocalEnv();
  if (!process.env.OPENAI_API_KEY?.trim()) throw new Error('OPENAI_API_KEY is required to run voice UX evals.');

  // ── Step 1: Run existing 20 scenarios ──────────────────────────────────────
  const fixtures = buildFixtures();
  const supabase = createDatabaseClient();
  const databaseBlocker = await checkDatabaseReadiness(supabase);
  const existingResults: ConversationResult[] = [];
  let completed = 0;
  const totalExisting = fixtures.length * 5;
  const totalNew = fixtures.length * 8;

  process.stdout.write(`\n[voice-ux] === PHASE 1: Original scenarios (${totalExisting}) ===\n`);
  for (const fixture of fixtures) {
    const systemPrompt = buildSystemPrompt({
      shop: fixture.shop,
      customer: null,
      mode: 'inbound',
      vertical: fixture.promptVertical,
    });
    for (const scenario of scenariosFor(fixture)) {
      const requestId = randomUUID();
      process.stdout.write(`[voice-ux] Running ${fixture.vertical}/${scenario.kind}...\n`);
      try {
        const { transcript, toolEvents } = await simulateConversation(fixture, scenario, systemPrompt);
        const evaluation = await evaluateConversation(fixture, scenario, transcript, toolEvents);
        const persisted = await readPersistedState(supabase, requestId, databaseBlocker);
        const accuracy = evaluateAccuracy(scenario, transcript, persisted);
        existingResults.push({ requestId, fixture, scenario, promptLength: systemPrompt.length, transcript, toolEvents, evaluation, accuracy });
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        const persisted = { call: null, booking: null, blocker: message };
        existingResults.push({
          requestId,
          fixture,
          scenario,
          promptLength: systemPrompt.length,
          transcript: [],
          toolEvents: [],
          evaluation: fallbackEvaluation(message),
          accuracy: evaluateAccuracy(scenario, [], persisted),
          error: message,
        });
      }
      completed += 1;
      process.stdout.write(`[voice-ux] Phase 1: ${completed}/${totalExisting}\n`);
    }
  }

  // ── Step 2: Run 32 new extended scenarios ──────────────────────────────────
  const extResults: ExtConversationResult[] = [];
  let extCompleted = 0;

  process.stdout.write(`\n[voice-ux] === PHASE 2: Extended scenarios (${totalNew}) ===\n`);
  for (const fixture of fixtures) {
    const systemPrompt = buildSystemPrompt({
      shop: fixture.shop,
      customer: null,
      mode: 'inbound',
      vertical: fixture.promptVertical,
    });
    for (const scenario of extScenariosFor(fixture)) {
      const requestId = randomUUID();
      process.stdout.write(`[voice-ux] Running ${fixture.vertical}/${scenario.kind}...\n`);
      try {
        const { transcript } = await simulateExtConversation(fixture, scenario, systemPrompt);
        const evaluation = await evaluateExtConversation(fixture, scenario, transcript);
        extResults.push({ requestId, fixture, scenario, transcript, evaluation });
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        extResults.push({
          requestId,
          fixture,
          scenario,
          transcript: [],
          evaluation: fallbackExtEvaluation(message),
          error: message,
        });
      }
      extCompleted += 1;
      process.stdout.write(`[voice-ux] Phase 2: ${extCompleted}/${totalNew}\n`);
    }
  }

  // ── Step 3: Run 8 mid-flow intent change scenarios ─────────────────────────
  const midFlowResults = await runPhase3(fixtures);

  // ── Step 4: Write combined report ──────────────────────────────────────────
  const generatedAt = new Date().toISOString();
  const existingMarkdown = reportMarkdown(existingResults, generatedAt);
  const extMarkdown = extReportMarkdown(extResults, generatedAt);
  const midFlowMarkdown = midFlowReportMarkdown(midFlowResults, generatedAt);
  const combinedMarkdown = existingMarkdown + extMarkdown + midFlowMarkdown + '\n';

  mkdirSync(OUTPUT_DIR, { recursive: true });
  writeFileSync(resolve(OUTPUT_DIR, 'latest-report.md'), combinedMarkdown, 'utf8');
  writeFileSync(
    resolve(OUTPUT_DIR, 'latest-results.json'),
    JSON.stringify({ generatedAt, model: MODEL, results: existingResults, extResults, midFlowResults }, null, 2),
    'utf8',
  );

  process.stdout.write(`\n${combinedMarkdown}`);
  process.stdout.write(`\n[voice-ux] Files written to ${OUTPUT_DIR}\n`);

  const existingFailures = existingResults.filter(
    (r) => r.evaluation.overall !== 'passed' || r.accuracy.overall !== 'passed',
  ).length;
  const extFailures = extResults.filter((r) => r.evaluation.overall !== 'passed').length;
  const midFlowFailures = midFlowResults.filter((r) => r.evaluation.overall !== 'passed').length;
  process.stdout.write(
    `\n[voice-ux] Summary: Phase 1 — ${totalExisting - existingFailures}/${totalExisting} passed | Phase 2 — ${totalNew - extFailures}/${totalNew} passed | Phase 3 — ${midFlowResults.length - midFlowFailures}/${midFlowResults.length} passed\n`,
  );
  process.exitCode = existingFailures + extFailures + midFlowFailures > 0 ? 1 : 0;
}

// ─────────────────────────────────────────────────────────────────────────────
// MID-FLOW INTENT CHANGE — 2 scenario types × 4 verticals = 8 scenarios
// ─────────────────────────────────────────────────────────────────────────────

type MidFlowScenarioKind = 'service_switch' | 'time_change';

type MidFlowCheckName =
  | 'singleTurn'
  | 'intentReset'
  | 'noCarryover'
  | 'noRedundantQuestions'
  | 'gracefulExit';

type MidFlowEvaluationCheck = { pass: boolean; reason: string; evidence: string[] };

type MidFlowEvaluation = {
  checks: Record<MidFlowCheckName, MidFlowEvaluationCheck>;
  overall: 'passed' | 'partial' | 'failed';
  summary: string;
};

type MidFlowScenario = {
  kind: MidFlowScenarioKind;
  persona: string;
  openingLine: string;
  goal: string;
  behavior: string;
  serviceA: string;
  serviceB?: string;      // for service_switch
  originalTime?: string;  // for time_change
  newTime?: string;       // for time_change
};

type MidFlowConversationResult = {
  requestId: string;
  fixture: VerticalFixture;
  scenario: MidFlowScenario;
  transcript: TranscriptTurn[];
  evaluation: MidFlowEvaluation;
  error?: string;
};

// ─── Scenario definitions — 2 per fixture ────────────────────────────────────

function midFlowScenariosFor(fixture: VerticalFixture): MidFlowScenario[] {
  const pairs: Record<string, [string, string]> = {
    nail_salon: ['Gel Manicure', 'Signature Pedicure'],
    hair_salon: ["Women's Haircut", 'Balayage'],
    day_spa: ['Swedish Massage', 'Signature Facial'],
    med_spa: ['Hydrafacial', 'Skin Consultation'],
  };
  const [serviceA, serviceB] = pairs[fixture.vertical] ?? ['Service A', 'Service B'];

  return [
    // ── 1. Service Switch Mid-Booking ─────────────────────────────────────────
    {
      kind: 'service_switch',
      serviceA,
      serviceB,
      persona: `A caller who starts booking a ${serviceA} but decides mid-booking to switch to a ${serviceB}.`,
      openingLine: `Hi, I'd like to book a ${serviceA}.`,
      goal: `Start a ${serviceA} booking. After the agent asks for date/time, switch to ${serviceB}. Complete the ${serviceB} booking with name Alex Chen and phone +1 312 555 0230.`,
      behavior: [
        `Start by asking to book a ${serviceA}.`,
        `When the agent asks for your preferred date or time, say: "Actually, wait — I changed my mind. Can I do a ${serviceB} instead?"`,
        `After the agent confirms the switch, continue the ${serviceB} booking.`,
        `Preferred date/time for ${serviceB}: tomorrow at 10 AM.`,
        `Your name is Alex Chen. Phone: +1 312 555 0230.`,
        `Accept the follow-up confirmation and close the call warmly.`,
      ].join(' '),
    },
    // ── 2. Time Change After Confirmation ────────────────────────────────────
    {
      kind: 'time_change',
      serviceA,
      originalTime: '10 AM',
      newTime: '2 PM',
      persona: `A cooperative caller who books an appointment then changes the time mid-booking before the agent closes the call.`,
      openingLine: `Hi, I'd like to book a ${serviceA} for tomorrow at 10 AM.`,
      goal: `Book ${serviceA} for tomorrow at 10 AM, give name and phone, then immediately after giving the phone number say you want 2 PM instead. Verify AI confirms 2 PM in the final booking note.`,
      behavior: [
        `Start by booking a ${serviceA} for tomorrow at 10 AM.`,
        `Your name is Sam Park. Phone: +1 312 555 0245.`,
        `Give name when asked, give phone when asked.`,
        `CRITICAL: Immediately after you say your phone number — before the agent can respond or close — say: "Wait, actually can we do 2 PM instead of 10 AM?"`,
        `Do not wait for the agent to confirm the booking before requesting the change.`,
        `After the agent acknowledges the 2 PM change, accept the confirmation and close the call.`,
        `Do not mention 10 AM again after requesting the change.`,
      ].join(' '),
    },
  ];
}

// ─── Simulation ───────────────────────────────────────────────────────────────

async function simulateMidFlowConversation(
  fixture: VerticalFixture,
  scenario: MidFlowScenario,
  systemPrompt: string,
): Promise<{ transcript: TranscriptTurn[]; toolEvents: ToolEvent[] }> {
  const transcript: TranscriptTurn[] = [];
  const toolEvents: ToolEvent[] = [];
  const validationState: NonNullable<AgentToolContext['appointmentTimeValidation']> = { latest: null };

  const greeting = await chatCompletion(
    [
      { role: 'system', content: systemPrompt },
      {
        role: 'user',
        content:
          '[VOICE TEST HARNESS EVENT] The inbound phone line has just connected. Deliver only your required opening greeting, then wait for the caller.',
      },
    ],
    'agent',
  );
  appendTurn(transcript, 'assistant', greeting);
  if (!scenario.openingLine) return { transcript, toolEvents };
  appendTurn(transcript, 'caller', scenario.openingLine);

  const agentMessages: ChatMessage[] = [
    { role: 'system', content: systemPrompt },
    { role: 'assistant', content: greeting },
    { role: 'user', content: scenario.openingLine },
  ];

  while (transcript.length < MAX_TRANSCRIPT_TURNS) {
    const assistant = await generateAgentReply({
      fixture,
      messages: agentMessages,
      transcript,
      toolEvents,
      validationState,
    });
    appendTurn(transcript, 'assistant', assistant);
    agentMessages.push({ role: 'assistant', content: assistant });
    if (hasCleanEnding(assistant) || transcript.length >= MAX_TRANSCRIPT_TURNS) break;

    const callerUtterance = await chatCompletion(
      [
        {
          role: 'system',
          content: [
            'You are simulating a caller in a phone UX test.',
            `Persona: ${scenario.persona}`,
            `Goal: ${scenario.goal}`,
            `Behavior rules: ${scenario.behavior}`,
            'Reply with only one natural caller utterance. Never speak as the assistant or describe your behavior.',
            'Follow your behavior script closely — inject the mid-flow change at the right moment.',
            'Stay engaged until the call reaches a clear close, then say goodbye briefly.',
          ].join('\n'),
        },
        {
          role: 'user',
          content: `Conversation so far:\n${formattedTranscript(transcript)}\n\nGive the caller's next utterance.`,
        },
      ],
      'caller',
    );
    appendTurn(transcript, 'caller', callerUtterance);
    agentMessages.push({ role: 'user', content: callerUtterance });
  }
  return { transcript, toolEvents };
}

// ─── Evaluation ───────────────────────────────────────────────────────────────

function fallbackMidFlowEvaluation(message: string): MidFlowEvaluation {
  const failed = (): MidFlowEvaluationCheck => ({ pass: false, reason: message, evidence: [] });
  return {
    checks: {
      singleTurn: failed(),
      intentReset: failed(),
      noCarryover: failed(),
      noRedundantQuestions: failed(),
      gracefulExit: failed(),
    },
    overall: 'failed',
    summary: message,
  };
}

function normalizeMidFlowEvaluation(raw: string): MidFlowEvaluation {
  const expected: MidFlowCheckName[] = [
    'singleTurn',
    'intentReset',
    'noCarryover',
    'noRedundantQuestions',
    'gracefulExit',
  ];
  try {
    const parsed = JSON.parse(raw) as Partial<MidFlowEvaluation> & {
      checks?: Partial<Record<MidFlowCheckName, Partial<MidFlowEvaluationCheck>>>;
    };
    const checks = {} as Record<MidFlowCheckName, MidFlowEvaluationCheck>;
    for (const key of expected) {
      const value = parsed.checks?.[key];
      checks[key] = {
        pass: value?.pass === true,
        reason: typeof value?.reason === 'string' ? value.reason : 'Evaluator did not provide a reason.',
        evidence: Array.isArray(value?.evidence)
          ? value.evidence.filter((i): i is string => typeof i === 'string')
          : [],
      };
    }
    const failedCount = expected.filter((k) => !checks[k].pass).length;
    const derivedOverall: MidFlowEvaluation['overall'] =
      failedCount === 0 ? 'passed' : failedCount <= 2 ? 'partial' : 'failed';
    return {
      checks,
      overall:
        parsed.overall === 'passed' || parsed.overall === 'partial' || parsed.overall === 'failed'
          ? parsed.overall
          : derivedOverall,
      summary: typeof parsed.summary === 'string' ? parsed.summary : `${failedCount} checks failed.`,
    };
  } catch {
    return fallbackMidFlowEvaluation('Evaluator returned invalid JSON.');
  }
}

function applyDeterministicMidFlowSingleTurnCheck(
  evaluation: MidFlowEvaluation,
  transcript: TranscriptTurn[],
): MidFlowEvaluation {
  const offending = transcript.find(
    (t, i) => t.role === 'assistant' && i > 0 && transcript[i - 1]?.role === 'assistant',
  );
  if (offending) {
    evaluation.checks.singleTurn = {
      pass: false,
      reason: 'Two consecutive assistant turns found without a caller turn between them.',
      evidence: [`T${offending.index} ASSISTANT: ${offending.text}`],
    };
    const failedCount = Object.values(evaluation.checks).filter((c) => !c.pass).length;
    evaluation.overall = failedCount === 0 ? 'passed' : failedCount <= 2 ? 'partial' : 'failed';
  }
  return evaluation;
}

function applyDeterministicMidFlowNoCarryoverCheck(
  evaluation: MidFlowEvaluation,
  scenario: MidFlowScenario,
  transcript: TranscriptTurn[],
): MidFlowEvaluation {
  const confirmMarkers = ["i've noted", "the team will", "follow up", "i have noted", "your request for", "i'll note"];
  const confirmationTurns = transcript.filter(
    (t) => t.role === 'assistant' && confirmMarkers.some((m) => t.text.toLowerCase().includes(m)),
  );
  if (confirmationTurns.length === 0) return evaluation;
  const last = confirmationTurns[confirmationTurns.length - 1];
  const lastText = last.text.toLowerCase();

  if (scenario.kind === 'service_switch' && scenario.serviceA && scenario.serviceB) {
    const aLow = scenario.serviceA.toLowerCase();
    const bLow = scenario.serviceB.toLowerCase();
    if (lastText.includes(aLow) && !lastText.includes(bLow)) {
      evaluation.checks.noCarryover = {
        pass: false,
        reason: `Final confirmation still references "${scenario.serviceA}" instead of "${scenario.serviceB}".`,
        evidence: [`T${last.index} ASSISTANT: ${last.text}`],
      };
      const failedCount = Object.values(evaluation.checks).filter((c) => !c.pass).length;
      evaluation.overall = failedCount === 0 ? 'passed' : failedCount <= 2 ? 'partial' : 'failed';
    }
  }

  if (scenario.kind === 'time_change' && scenario.originalTime && scenario.newTime) {
    const origLow = scenario.originalTime.toLowerCase();
    const newLow = scenario.newTime.toLowerCase();
    if (lastText.includes(origLow) && !lastText.includes(newLow)) {
      evaluation.checks.noCarryover = {
        pass: false,
        reason: `Final confirmation still references "${scenario.originalTime}" instead of "${scenario.newTime}".`,
        evidence: [`T${last.index} ASSISTANT: ${last.text}`],
      };
      const failedCount = Object.values(evaluation.checks).filter((c) => !c.pass).length;
      evaluation.overall = failedCount === 0 ? 'passed' : failedCount <= 2 ? 'partial' : 'failed';
    }
  }
  return evaluation;
}

async function evaluateMidFlowConversation(
  fixture: VerticalFixture,
  scenario: MidFlowScenario,
  transcript: TranscriptTurn[],
): Promise<MidFlowEvaluation> {
  const switchLabel =
    scenario.kind === 'service_switch'
      ? `Service switch: "${scenario.serviceA}" → "${scenario.serviceB}"`
      : `Time change: "${scenario.originalTime}" → "${scenario.newTime}"`;

  const raw = await chatCompletion(
    [
      {
        role: 'system',
        content: [
          'You are a strict QA evaluator for an AI phone receptionist — mid-flow intent change scenarios.',
          'Return JSON only.',
          'Use this exact shape:',
          '{"checks":{"singleTurn":{"pass":true,"reason":"","evidence":[]},"intentReset":{"pass":true,"reason":"","evidence":[]},"noCarryover":{"pass":true,"reason":"","evidence":[]},"noRedundantQuestions":{"pass":true,"reason":"","evidence":[]},"gracefulExit":{"pass":true,"reason":"","evidence":[]}},"overall":"passed|partial|failed","summary":""}',
          'Evidence for failed checks must include the exact transcript turn text prefixed by its T number.',
          '',
          'RULES:',
          'SINGLE TURN: fails if two consecutive assistant turns appear with no caller turn between them.',
          'INTENT RESET: passes when AI explicitly acknowledges the mid-flow change (service switch or time change) and confirms the new intent in its reply. Fails if AI ignores the change or continues as if the original request stands.',
          'NO CARRYOVER: the final booking confirmation must reference the updated service or time, not the original. Fails if the original service/time appears in the final confirmation and the new one does not.',
          'NO REDUNDANT QUESTIONS: AI must not re-ask for details already confirmed and unchanged. For service_switch: re-asking date/time for the new service is expected and NOT a failure — but re-asking name or phone already given is a failure. For time_change: re-asking service or name already captured is a failure.',
          'GRACEFUL EXIT: call closes with a clear next step and a polite goodbye.',
          'Overall: passed = all pass, partial = 1–2 fail, failed = 3+ fail.',
        ].join('\n'),
      },
      {
        role: 'user',
        content: [
          `Business: ${fixture.shop.name} (${fixture.vertical})`,
          `Scenario: ${scenario.kind}`,
          switchLabel,
          `Goal: ${scenario.goal}`,
          `Services: ${fixture.shop.services.map((s) => `${s.name} ($${s.price})`).join(', ')}`,
          '',
          'Transcript:',
          formattedTranscript(transcript),
        ].join('\n'),
      },
    ],
    'evaluator',
    true,
  );

  let evaluation = normalizeMidFlowEvaluation(raw);
  evaluation = applyDeterministicMidFlowSingleTurnCheck(evaluation, transcript);
  evaluation = applyDeterministicMidFlowNoCarryoverCheck(evaluation, scenario, transcript);
  return evaluation;
}

// ─── Report section ───────────────────────────────────────────────────────────

function midFlowReportMarkdown(results: MidFlowConversationResult[], generatedAt: string): string {
  const lines: string[] = [
    '',
    '---',
    '',
    '## Mid-Flow Intent Change Evaluation',
    '',
    `- Generated: ${generatedAt}`,
    `- 8 scenarios: 2 types × 4 verticals`,
    `- Checks: Single Turn, Intent Reset, No Carryover, No Redundant Questions, Graceful Exit`,
    '',
    '| Vertical | Scenario | Single Turn | Intent Reset | No Carryover | No Redundant Questions | Graceful Exit | Overall |',
    '| --- | --- | --- | --- | --- | --- | --- | --- |',
  ];

  for (const r of results) {
    const c = r.evaluation.checks;
    lines.push(
      `| ${r.fixture.vertical} | ${r.scenario.kind} | ${status(c.singleTurn)} | ${status(c.intentReset)} | ${status(c.noCarryover)} | ${status(c.noRedundantQuestions)} | ${status(c.gracefulExit)} | ${r.evaluation.overall.toUpperCase()} |`,
    );
  }

  lines.push('', '### Mid-Flow Failures And Partial Results', '');
  const withFailures = results.filter((r) => Object.values(r.evaluation.checks).some((c) => !c.pass));
  if (withFailures.length === 0) {
    lines.push('No checks failed across all 8 mid-flow scenarios.');
  }
  for (const r of withFailures) {
    const label =
      r.scenario.kind === 'service_switch'
        ? `${r.scenario.serviceA} → ${r.scenario.serviceB}`
        : `${r.scenario.originalTime} → ${r.scenario.newTime}`;
    lines.push(`#### ${r.fixture.vertical} / ${r.scenario.kind} (${label}) — ${r.evaluation.overall.toUpperCase()}`, '');
    for (const [checkName, check] of Object.entries(r.evaluation.checks).filter(([, c]) => !c.pass)) {
      lines.push(`- **${checkName}**: ${check.reason}`);
      const ev = check.evidence.length > 0 ? check.evidence : ['No exact turn returned by evaluator.'];
      for (const e of ev) lines.push(`  - \`${e.replace(/`/g, "'")}\``);
    }
    lines.push(`  - Summary: ${r.evaluation.summary}`, '');
  }

  lines.push('', '### Mid-Flow Full Transcripts', '');
  for (const r of results) {
    const label =
      r.scenario.kind === 'service_switch'
        ? `${r.scenario.serviceA} → ${r.scenario.serviceB}`
        : `${r.scenario.originalTime} → ${r.scenario.newTime}`;
    lines.push(`#### ${r.fixture.vertical} / ${r.scenario.kind} (${label})`, '');
    lines.push(`Overall: ${r.evaluation.overall.toUpperCase()}`, '');
    lines.push('```text', formattedTranscript(r.transcript) || `ERROR: ${r.error ?? 'No transcript.'}`, '```', '');
  }

  return lines.join('\n');
}

// ─── Phase 3 runner ───────────────────────────────────────────────────────────

async function runPhase3(fixtures: VerticalFixture[]): Promise<MidFlowConversationResult[]> {
  const midFlowResults: MidFlowConversationResult[] = [];
  let completed = 0;
  const total = fixtures.length * 2;

  process.stdout.write(`\n[voice-ux] === PHASE 3: Mid-flow intent change (${total}) ===\n`);
  for (const fixture of fixtures) {
    const systemPrompt = buildSystemPrompt({
      shop: fixture.shop,
      customer: null,
      mode: 'inbound',
      vertical: fixture.promptVertical,
    });
    for (const scenario of midFlowScenariosFor(fixture)) {
      const requestId = randomUUID();
      process.stdout.write(`[voice-ux] Running ${fixture.vertical}/${scenario.kind}...\n`);
      try {
        const { transcript } = await simulateMidFlowConversation(fixture, scenario, systemPrompt);
        const evaluation = await evaluateMidFlowConversation(fixture, scenario, transcript);
        midFlowResults.push({ requestId, fixture, scenario, transcript, evaluation });
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        midFlowResults.push({
          requestId,
          fixture,
          scenario,
          transcript: [],
          evaluation: fallbackMidFlowEvaluation(message),
          error: message,
        });
      }
      completed += 1;
      process.stdout.write(`[voice-ux] Phase 3: ${completed}/${total}\n`);
    }
  }
  return midFlowResults;
}

// ── Retry: re-run only ext scenarios that failed with quota / HTTP errors ─────
async function retryQuotaFailures(): Promise<void> {
  loadLocalEnv();
  if (!process.env.OPENAI_API_KEY?.trim()) throw new Error('OPENAI_API_KEY is required.');

  const resultsPath = resolve(OUTPUT_DIR, 'latest-results.json');
  if (!existsSync(resultsPath)) throw new Error(`latest-results.json not found at ${resultsPath}. Run the full eval first.`);

  const stored = JSON.parse(readFileSync(resultsPath, 'utf8')) as {
    generatedAt: string;
    model: string;
    results: ConversationResult[];
    extResults: ExtConversationResult[];
    midFlowResults?: MidFlowConversationResult[];
  };

  const { results: existingResults, extResults, midFlowResults = [] } = stored;

  // Identify ext results to retry: those that have an error field containing quota/429 signals
  const toRetry = extResults.filter(
    (r) => r.error && (r.error.includes('429') || r.error.toLowerCase().includes('quota') || r.error.toLowerCase().includes('exceeded')),
  );

  if (toRetry.length === 0) {
    process.stdout.write('[voice-ux] No quota-failed scenarios found in latest-results.json.\n');
    return;
  }

  process.stdout.write(`\n[voice-ux] === RETRY: ${toRetry.length} quota-failed scenarios ===\n`);

  // Build fixtures + system prompts map so we can look up by vertical
  const fixtures = buildFixtures();
  const supabase = createDatabaseClient();
  await checkDatabaseReadiness(supabase);

  const systemPromptByVertical = new Map<string, string>();
  for (const fixture of fixtures) {
    const sp = buildSystemPrompt({ shop: fixture.shop, customer: null, mode: 'inbound', vertical: fixture.promptVertical });
    systemPromptByVertical.set(fixture.vertical, sp);
  }
  const fixtureByVertical = new Map(fixtures.map((f) => [f.vertical, f]));

  let retried = 0;
  for (const failed of toRetry) {
    const vertical = failed.fixture.vertical;
    const fixture = fixtureByVertical.get(vertical);
    const systemPrompt = systemPromptByVertical.get(vertical);
    if (!fixture || !systemPrompt) {
      process.stdout.write(`[voice-ux] SKIP ${vertical}/${failed.scenario.kind} — fixture not found\n`);
      continue;
    }

    process.stdout.write(`[voice-ux] Retrying ${vertical}/${failed.scenario.kind}...\n`);
    try {
      const { transcript } = await simulateExtConversation(fixture, failed.scenario, systemPrompt);
      const evaluation = await evaluateExtConversation(fixture, failed.scenario, transcript);
      // Replace in extResults array (match by vertical + kind)
      const idx = extResults.findIndex(
        (r) => r.fixture.vertical === vertical && r.scenario.kind === failed.scenario.kind,
      );
      if (idx !== -1) {
        extResults[idx] = { requestId: failed.requestId, fixture, scenario: failed.scenario, transcript, evaluation };
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      process.stdout.write(`[voice-ux] STILL FAILED ${vertical}/${failed.scenario.kind}: ${message.slice(0, 120)}\n`);
    }
    retried += 1;
    process.stdout.write(`[voice-ux] Retry: ${retried}/${toRetry.length}\n`);
  }

  // Rewrite report + json (preserve midFlowResults unchanged)
  const generatedAt = new Date().toISOString();
  const existingMarkdown = reportMarkdown(existingResults, generatedAt);
  const extMarkdown = extReportMarkdown(extResults, generatedAt);
  const midFlowMarkdown = midFlowResults.length > 0 ? midFlowReportMarkdown(midFlowResults, generatedAt) : '';
  const combinedMarkdown = existingMarkdown + extMarkdown + midFlowMarkdown + '\n';

  mkdirSync(OUTPUT_DIR, { recursive: true });
  writeFileSync(resolve(OUTPUT_DIR, 'latest-report.md'), combinedMarkdown, 'utf8');
  writeFileSync(
    resolve(OUTPUT_DIR, 'latest-results.json'),
    JSON.stringify({ generatedAt, model: MODEL, results: existingResults, extResults, midFlowResults }, null, 2),
    'utf8',
  );

  process.stdout.write(`\n${combinedMarkdown}`);
  process.stdout.write(`\n[voice-ux] Retry complete. Files updated at ${OUTPUT_DIR}\n`);

  const extFailures = extResults.filter((r) => r.evaluation.overall !== 'passed').length;
  const midFlowFailures = midFlowResults.filter((r) => r.evaluation.overall !== 'passed').length;
  process.stdout.write(`[voice-ux] Phase 2 after retry: ${extResults.length - extFailures}/${extResults.length} passed\n`);
  if (midFlowResults.length > 0) {
    process.stdout.write(`[voice-ux] Phase 3 (unchanged): ${midFlowResults.length - midFlowFailures}/${midFlowResults.length} passed\n`);
  }
  process.exitCode = extFailures + midFlowFailures > 0 ? 1 : 0;
}

// ── Phase-3-only: read stored Phase 1+2 results, run only Phase 3 ─────────────
async function runPhase3Only(): Promise<void> {
  loadLocalEnv();
  if (!process.env.OPENAI_API_KEY?.trim()) throw new Error('OPENAI_API_KEY is required.');

  const resultsPath = resolve(OUTPUT_DIR, 'latest-results.json');
  if (!existsSync(resultsPath)) throw new Error(`latest-results.json not found. Run the full eval first.`);

  const stored = JSON.parse(readFileSync(resultsPath, 'utf8')) as {
    generatedAt: string;
    model: string;
    results: ConversationResult[];
    extResults: ExtConversationResult[];
    midFlowResults?: MidFlowConversationResult[];
  };

  const { results: existingResults, extResults } = stored;

  const fixtures = buildFixtures();
  const midFlowResults = await runPhase3(fixtures);

  const generatedAt = new Date().toISOString();
  const existingMarkdown = reportMarkdown(existingResults, generatedAt);
  const extMarkdown = extReportMarkdown(extResults, generatedAt);
  const midFlowMarkdown = midFlowReportMarkdown(midFlowResults, generatedAt);
  const combinedMarkdown = existingMarkdown + extMarkdown + midFlowMarkdown + '\n';

  mkdirSync(OUTPUT_DIR, { recursive: true });
  writeFileSync(resolve(OUTPUT_DIR, 'latest-report.md'), combinedMarkdown, 'utf8');
  writeFileSync(
    resolve(OUTPUT_DIR, 'latest-results.json'),
    JSON.stringify({ generatedAt, model: MODEL, results: existingResults, extResults, midFlowResults }, null, 2),
    'utf8',
  );

  process.stdout.write(`\n${midFlowMarkdown}`);
  process.stdout.write(`\n[voice-ux] Phase 3 complete. Report updated at ${OUTPUT_DIR}\n`);

  const failures = midFlowResults.filter((r) => r.evaluation.overall !== 'passed').length;
  process.stdout.write(`[voice-ux] Phase 3: ${midFlowResults.length - failures}/${midFlowResults.length} passed\n`);
  process.exitCode = failures > 0 ? 1 : 0;
}

// ── Retry time_change only: re-run the 4 failed time_change mid-flow scenarios ─
async function retryTimeChangeScenarios(): Promise<void> {
  loadLocalEnv();
  if (!process.env.OPENAI_API_KEY?.trim()) throw new Error('OPENAI_API_KEY is required.');

  const resultsPath = resolve(OUTPUT_DIR, 'latest-results.json');
  if (!existsSync(resultsPath)) throw new Error(`latest-results.json not found. Run the full eval first.`);

  const stored = JSON.parse(readFileSync(resultsPath, 'utf8')) as {
    generatedAt: string;
    model: string;
    results: ConversationResult[];
    extResults: ExtConversationResult[];
    midFlowResults?: MidFlowConversationResult[];
  };

  const { results: existingResults, extResults, midFlowResults = [] } = stored;

  const fixtures = buildFixtures();

  process.stdout.write(`\n[voice-ux] === RETRY time_change: 4 scenarios ===\n`);

  let retried = 0;
  for (const fixture of fixtures) {
    const systemPrompt = buildSystemPrompt({
      shop: fixture.shop,
      customer: null,
      mode: 'inbound',
      vertical: fixture.promptVertical,
    });
    // Build the updated time_change scenario from the fixed midFlowScenariosFor
    const updatedScenario = midFlowScenariosFor(fixture).find((s) => s.kind === 'time_change');
    if (!updatedScenario) continue;

    process.stdout.write(`[voice-ux] Retrying ${fixture.vertical}/time_change...\n`);
    try {
      const { transcript } = await simulateMidFlowConversation(fixture, updatedScenario, systemPrompt);
      const evaluation = await evaluateMidFlowConversation(fixture, updatedScenario, transcript);
      const idx = midFlowResults.findIndex(
        (r) => r.fixture.vertical === fixture.vertical && r.scenario.kind === 'time_change',
      );
      const newResult: MidFlowConversationResult = {
        requestId: randomUUID(),
        fixture,
        scenario: updatedScenario,
        transcript,
        evaluation,
      };
      if (idx !== -1) {
        midFlowResults[idx] = newResult;
      } else {
        midFlowResults.push(newResult);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      process.stdout.write(`[voice-ux] FAILED ${fixture.vertical}/time_change: ${message.slice(0, 120)}\n`);
    }
    retried += 1;
    process.stdout.write(`[voice-ux] Retry time_change: ${retried}/4\n`);
  }

  const generatedAt = new Date().toISOString();
  const existingMarkdown = reportMarkdown(existingResults, generatedAt);
  const extMarkdown = extReportMarkdown(extResults, generatedAt);
  const midFlowMarkdown = midFlowReportMarkdown(midFlowResults, generatedAt);
  const combinedMarkdown = existingMarkdown + extMarkdown + midFlowMarkdown + '\n';

  mkdirSync(OUTPUT_DIR, { recursive: true });
  writeFileSync(resolve(OUTPUT_DIR, 'latest-report.md'), combinedMarkdown, 'utf8');
  writeFileSync(
    resolve(OUTPUT_DIR, 'latest-results.json'),
    JSON.stringify({ generatedAt, model: MODEL, results: existingResults, extResults, midFlowResults }, null, 2),
    'utf8',
  );

  // Print only the Phase 3 section
  process.stdout.write(`\n${midFlowMarkdown}\n`);
  process.stdout.write(`\n[voice-ux] time_change retry complete. Report updated at ${OUTPUT_DIR}\n`);

  const failures = midFlowResults.filter((r) => r.evaluation.overall !== 'passed').length;
  process.stdout.write(`[voice-ux] Phase 3: ${midFlowResults.length - failures}/${midFlowResults.length} passed\n`);
  process.exitCode = failures > 0 ? 1 : 0;
}

// ─────────────────────────────────────────────────────────────────────────────
// DROPPED-PREFERENCE SCENARIOS — reproduces the live-call bug where the caller
// states a concrete day/time preference mid-flow and the agent ignores it in
// favor of the next scripted question (e.g. stylist/technician preference).
//
// Only hair_salon and nail_salon get a scenario here: both have an unconditional
// "any stylist/technician preference?" scripted question in their vertical pack
// that can directly compete with a stated preference. day_spa and med_spa's
// vertical packs use redirect/handoff wording ("that's a provider question...")
// rather than a competing scripted question, so there's no comparable trigger to
// build a meaningful scenario against — extending coverage to them would mean
// testing a pattern that doesn't actually exist in their prompt content.
// ─────────────────────────────────────────────────────────────────────────────

type DroppedPreferenceScenario = {
  persona: string;
  openingLine: string;
  preferenceLine: string;
  goal: string;
  behavior: string;
};

type DroppedPreferenceEvaluation = {
  addressedPreference: boolean;
  reason: string;
  evidence: string[];
};

type DroppedPreferenceResult = {
  requestId: string;
  fixture: VerticalFixture;
  scenario: DroppedPreferenceScenario;
  transcript: TranscriptTurn[];
  evaluation: DroppedPreferenceEvaluation;
  error?: string;
};

function droppedPreferenceScenarioFor(fixture: VerticalFixture): DroppedPreferenceScenario | null {
  if (fixture.vertical !== 'hair_salon' && fixture.vertical !== 'nail_salon') return null;
  const serviceQuestion = fixture.vertical === 'hair_salon' ? 'a color consultation' : 'a gel manicure';
  return {
    persona: 'A caller asking about a service who, in their very next turn, states a concrete day/time preference while the agent has not yet asked about scheduling.',
    openingLine: `Hi, I wanted to ask about ${serviceQuestion}.`,
    preferenceLine:
      "Do you have anything Thursday or Friday? I work during the week, so evenings would be easier, or I could maybe squeeze in a lunch break.",
    goal: 'Get the service question answered, then state the Thursday/Friday + evening-or-lunch preference, then continue booking naturally with whatever specific time the agent proposes.',
    behavior: [
      'Say your opening line exactly as scripted.',
      'After the agent answers, say your preference line exactly as scripted — do not paraphrase it.',
      'After that, continue naturally: if the agent proposes a specific time, accept it or negotiate briefly, then give your name (Taylor Nguyen) and continue to booking completion.',
      'Accept the final confirmation and close the call warmly.',
    ].join(' '),
  };
}

async function simulateDroppedPreferenceConversation(
  fixture: VerticalFixture,
  scenario: DroppedPreferenceScenario,
  systemPrompt: string,
): Promise<{ transcript: TranscriptTurn[]; toolEvents: ToolEvent[] }> {
  const transcript: TranscriptTurn[] = [];
  const toolEvents: ToolEvent[] = [];
  const validationState: NonNullable<AgentToolContext['appointmentTimeValidation']> = { latest: null };

  const greeting = await chatCompletion(
    [
      { role: 'system', content: systemPrompt },
      {
        role: 'user',
        content:
          '[VOICE TEST HARNESS EVENT] The inbound phone line has just connected. Deliver only your required opening greeting, then wait for the caller.',
      },
    ],
    'agent',
  );
  appendTurn(transcript, 'assistant', greeting);

  const agentMessages: ChatMessage[] = [
    { role: 'system', content: systemPrompt },
    { role: 'assistant', content: greeting },
  ];

  // Turns 1–2 are scripted exactly, to faithfully reproduce the reported bug rather than
  // leaving the caller-simulator to improvise a possibly different phrasing.
  for (const scriptedLine of [scenario.openingLine, scenario.preferenceLine]) {
    appendTurn(transcript, 'caller', scriptedLine);
    agentMessages.push({ role: 'user', content: scriptedLine });
    const assistant = await generateAgentReply({ fixture, messages: agentMessages, transcript, toolEvents, validationState });
    appendTurn(transcript, 'assistant', assistant);
    if (hasCleanEnding(assistant)) return { transcript, toolEvents };
  }

  // Remaining turns continue naturally via the caller-simulator until the call closes.
  while (transcript.length < MAX_TRANSCRIPT_TURNS) {
    const lastAssistant = transcript.at(-1);
    if (lastAssistant?.role === 'assistant' && hasCleanEnding(lastAssistant.text)) break;

    const callerUtterance = await chatCompletion(
      [
        {
          role: 'system',
          content: [
            'You are simulating a caller in a phone UX test.',
            `Persona: ${scenario.persona}`,
            `Goal: ${scenario.goal}`,
            `Behavior rules: ${scenario.behavior}`,
            'Reply with only one natural caller utterance. Never speak as the assistant or describe your behavior.',
            'Stay engaged until the call reaches a clear close, then say goodbye briefly.',
          ].join('\n'),
        },
        {
          role: 'user',
          content: `Conversation so far:\n${formattedTranscript(transcript)}\n\nGive the caller's next utterance.`,
        },
      ],
      'caller',
    );
    appendTurn(transcript, 'caller', callerUtterance);
    agentMessages.push({ role: 'user', content: callerUtterance });

    const assistant = await generateAgentReply({ fixture, messages: agentMessages, transcript, toolEvents, validationState });
    appendTurn(transcript, 'assistant', assistant);
    if (hasCleanEnding(assistant) || transcript.length >= MAX_TRANSCRIPT_TURNS) break;
  }
  return { transcript, toolEvents };
}

async function evaluateDroppedPreferenceConversation(
  transcript: TranscriptTurn[],
): Promise<DroppedPreferenceEvaluation> {
  // The turn under test is the assistant's reply immediately after the scripted preference line
  // (T3: greeting=T1, opening=T2... preference line is T3, so the reply under test is T4) --
  // but resolve it by content match rather than a hardcoded index, in case the harness structure
  // shifts later.
  const prefIndex = transcript.findIndex((t) => t.role === 'caller' && t.text.includes('Thursday or Friday'));
  const replyUnderTest = prefIndex >= 0 ? transcript[prefIndex + 1] : undefined;
  if (!replyUnderTest || replyUnderTest.role !== 'assistant') {
    return { addressedPreference: false, reason: 'Could not locate the assistant reply immediately after the stated preference.', evidence: [] };
  }

  const raw = await chatCompletion(
    [
      {
        role: 'system',
        content: [
          'You are a strict QA evaluator for an AI phone receptionist.',
          'Return JSON only: {"addressedPreference": true|false, "reason": ""}',
          'The caller stated a day preference (Thursday or Friday) and a time-of-day preference (evenings, or a lunch break).',
          'addressedPreference is true if the single assistant reply provided directly engages with that day and/or time-of-day preference (confirms a day, asks for a specific time within what was described, offers a fitting time, or explains why those days/times do not work) -- rather than ignoring it in favor of an unrelated scripted question (e.g. stylist/technician preference) with no acknowledgment at all.',
        ].join('\n'),
      },
      {
        role: 'user',
        content: `Caller's stated preference: "${transcript[prefIndex].text}"\n\nAssistant's reply to evaluate: "${replyUnderTest.text}"`,
      },
    ],
    'evaluator',
    true,
  );

  try {
    const parsed = JSON.parse(raw) as { addressedPreference?: boolean; reason?: string };
    return {
      addressedPreference: parsed.addressedPreference === true,
      reason: typeof parsed.reason === 'string' ? parsed.reason : '',
      evidence: [`T${replyUnderTest.index} ASSISTANT: ${replyUnderTest.text}`],
    };
  } catch {
    return { addressedPreference: false, reason: 'Evaluator returned invalid JSON.', evidence: [] };
  }
}

function droppedPreferenceReportMarkdown(results: DroppedPreferenceResult[], generatedAt: string): string {
  const lines: string[] = [
    '',
    '---',
    '',
    '## Dropped-Preference Evaluation',
    '',
    `- Generated: ${generatedAt}`,
    `- ${results.length} scenarios (hair_salon, nail_salon only -- see code comment for why day_spa/med_spa are excluded)`,
    '',
    '| Vertical | Addressed Preference | Reason |',
    '| --- | --- | --- |',
  ];
  for (const r of results) {
    lines.push(`| ${r.fixture.vertical} | ${r.evaluation.addressedPreference ? '✅ PASS' : '❌ FAIL'} | ${r.evaluation.reason.replace(/\|/g, '/')} |`);
  }
  lines.push('', '### Dropped-Preference Full Transcripts', '');
  for (const r of results) {
    lines.push(`#### ${r.fixture.vertical}`, '', '```', formattedTranscript(r.transcript), '```', '');
  }
  return lines.join('\n');
}

async function runDroppedPreferenceOnly(): Promise<void> {
  loadLocalEnv();
  if (!process.env.OPENAI_API_KEY?.trim()) throw new Error('OPENAI_API_KEY is required to run voice UX evals.');

  const fixtures = buildFixtures();
  const results: DroppedPreferenceResult[] = [];

  process.stdout.write(`\n[voice-ux] === dropped_preference scenarios ===\n`);
  for (const fixture of fixtures) {
    const scenario = droppedPreferenceScenarioFor(fixture);
    if (!scenario) {
      process.stdout.write(`[voice-ux] Skipping ${fixture.vertical} -- no comparable scripted-question pattern.\n`);
      continue;
    }
    const systemPrompt = buildSystemPrompt({
      shop: fixture.shop,
      customer: null,
      mode: 'inbound',
      vertical: fixture.promptVertical,
    });
    process.stdout.write(`[voice-ux] Running ${fixture.vertical}/dropped_preference...\n`);
    try {
      const { transcript } = await simulateDroppedPreferenceConversation(fixture, scenario, systemPrompt);
      const evaluation = await evaluateDroppedPreferenceConversation(transcript);
      results.push({ requestId: randomUUID(), fixture, scenario, transcript, evaluation });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      results.push({
        requestId: randomUUID(),
        fixture,
        scenario,
        transcript: [],
        evaluation: { addressedPreference: false, reason: message, evidence: [] },
        error: message,
      });
    }
  }

  const generatedAt = new Date().toISOString();
  const markdown = droppedPreferenceReportMarkdown(results, generatedAt);
  mkdirSync(OUTPUT_DIR, { recursive: true });
  writeFileSync(resolve(OUTPUT_DIR, 'latest-dropped-preference-report.md'), markdown, 'utf8');
  writeFileSync(
    resolve(OUTPUT_DIR, 'latest-dropped-preference-results.json'),
    JSON.stringify({ generatedAt, model: MODEL, results }, null, 2),
    'utf8',
  );
  process.stdout.write(`\n${markdown}\n`);
  const passed = results.filter((r) => r.evaluation.addressedPreference).length;
  process.stdout.write(`[voice-ux] dropped_preference: ${passed}/${results.length} passed\n`);
  process.exitCode = passed < results.length ? 1 : 0;
}

// ── Entry point ───────────────────────────────────────────────────────────────
const mode = process.argv[2];
if (mode === '--retry-failed') {
  retryQuotaFailures().catch((error) => {
    console.error('[voice-ux] Fatal error:', error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
} else if (mode === '--retry-time-change') {
  retryTimeChangeScenarios().catch((error) => {
    console.error('[voice-ux] Fatal error:', error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
} else if (mode === '--phase3-only') {
  runPhase3Only().catch((error) => {
    console.error('[voice-ux] Fatal error:', error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
} else if (mode === '--no-phone-only') {
  runNoPhoneCollectionOnly().catch((error) => {
    console.error('[voice-ux] Fatal error:', error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
} else if (mode === '--clear-booker-only') {
  runClearBookerOnly().catch((error) => {
    console.error('[voice-ux] Fatal error:', error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
} else if (mode === '--dropped-preference-only') {
  runDroppedPreferenceOnly().catch((error) => {
    console.error('[voice-ux] Fatal error:', error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
} else {
  mainWithExtensions().catch((error) => {
    console.error('[voice-ux] Fatal error:', error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
}
