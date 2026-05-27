import { checkAvailabilityTool } from '@/src/agent/tools/check-availability';
import { endCallTool } from '@/src/agent/tools/end-call';
import { cancelBookingTool } from '@/src/agent/tools/cancel-booking';
import { createBookingTool } from '@/src/agent/tools/create-booking';
import { getShopInfoTool } from '@/src/agent/tools/get-shop-info';
import { rescheduleBookingTool } from '@/src/agent/tools/reschedule-booking';
import { sendBookingLinkTool } from '@/src/agent/tools/send-booking-link';
import { requestHumanHandoffTool } from '@/src/agent/tools/request-human-handoff';
import { transferToUserTool } from '@/src/agent/tools/transfer-to-user';
import {
  type AppointmentTimeValidationResult,
  buildValidationMessageForAi,
  validateAppointmentTimeTool,
} from '@/src/agent/tools/validate-appointment-time';
import type { AgentToolContext } from '@/src/agent/tools/types';
import { extractAppointmentDateTime } from '@/src/agent/sip/appointment-time-extractor';
import type { Shop } from '@/src/backend/domain/types';
import type {
  BillingSubscriptionsRepository,
  BookingsRepository,
  CallbacksRepository,
  CustomersRepository,
  JobsRepository,
  ShopAccessStatesRepository,
  ShopsRepository,
} from '@/src/backend/ports/repositories';
import { logger } from '@/src/backend/observability/logger';
import { getCalendarProvider } from '@/src/backend/services/calendar/types';
import type { TelephonyService } from '@/src/backend/services/telephony/types';
import { getResolvedVoiceTransport } from '@/src/backend/config/voice-transport';

export type SipToolExecutorDeps = {
  shopsRepository: ShopsRepository;
  jobsRepository: JobsRepository;
  bookingsRepository: BookingsRepository;
  callbacksRepository: CallbacksRepository;
  customersRepository?: CustomersRepository;
  billingSubscriptionsRepository?: BillingSubscriptionsRepository;
  shopAccessStatesRepository?: ShopAccessStatesRepository;
  telephonyService: TelephonyService;
};

function compactSipToolJson(output: unknown): string {
  try {
    const s = JSON.stringify(output);
    return s.length > 8000 ? `${s.slice(0, 8000)}…` : s;
  } catch {
    return '{"error":"serialization_failed"}';
  }
}

export function createSipAgentToolContext(params: {
  shop: Shop;
  callerPhone: string;
  requestId: string;
  roomName: string;
  deps: SipToolExecutorDeps;
  parentTelnyxCallControlId?: string | null;
  rbCallId?: string;
  openAiLegCallControlId?: string | null;
}): AgentToolContext {
  const calendarProvider = getCalendarProvider(params.shop, {
    persistCredentials: async (encodedCredentials) => {
      await params.deps.shopsRepository.updateCalendarConnection(params.shop.id, {
        google_cal_id: params.shop.google_cal_id ?? null,
        google_cal_credentials_encrypted: encodedCredentials,
      });
    },
  });

  return {
    shop: params.shop,
    callerPhone: params.callerPhone,
    requestId: params.requestId,
    roomName: params.roomName,
    calendarProvider,
    jobsRepository: params.deps.jobsRepository,
    bookingsRepository: params.deps.bookingsRepository,
    callbacksRepository: params.deps.callbacksRepository,
    shopsRepository: params.deps.shopsRepository,
    customersRepository: params.deps.customersRepository,
    billingSubscriptionsRepository: params.deps.billingSubscriptionsRepository,
    shopAccessStatesRepository: params.deps.shopAccessStatesRepository,
    telephonyService: params.deps.telephonyService,
    parentTelnyxCallControlId: params.parentTelnyxCallControlId ?? null,
    rbCallId: params.rbCallId ?? params.requestId,
    openAiLegCallControlId: params.openAiLegCallControlId ?? null,
    appointmentTimeValidation: { latest: null },
  };
}

/**
 * Pre-populate `ctx.appointmentTimeValidation.latest` from a raw caller transcript.
 *
 * Called immediately when the caller's utterance is transcribed — before the model
 * begins its `validate_appointment_time` tool call (~7 s round-trip on OpenAI Realtime).
 * When the model later calls the tool with a matching date+time, the result is returned
 * from cache without re-executing the tool function.
 *
 * - Requires explicit AM/PM in the transcript (e.g. "9 a.m.", "2 PM") — ambiguous
 *   times like "9 o'clock" are skipped.
 * - Best-effort: never throws. If extraction fails, the tool call proceeds normally.
 * - Idempotent: skips re-computation if the same date+time is already cached.
 */
export async function prePopulateFromTranscript(
  ctx: AgentToolContext,
  transcript: string,
): Promise<void> {
  if (!ctx.appointmentTimeValidation) return;

  const extracted = extractAppointmentDateTime(transcript, ctx.shop);
  if (!extracted) return;

  const existing = ctx.appointmentTimeValidation.latest;
  if (existing && existing.date === extracted.date && existing.time === extracted.time) return;

  try {
    await validateAppointmentTimeTool(ctx, extracted);
  } catch {
    // Best-effort — never fail the call over a pre-population error
  }
}

export async function executeSipShopToolCall(
  ctx: AgentToolContext,
  toolName: string,
  toolInput: unknown,
): Promise<string> {
  try {
    let result: unknown;
    switch (toolName) {
      case 'validate_appointment_time': {
        // Fast path: return pre-computed result when transcript monitoring has already
        // run the tool and cached the result for this exact date+time.
        const cached = ctx.appointmentTimeValidation?.latest ?? null;
        if (cached !== null) {
          const inp = toolInput as Record<string, unknown>;
          if (
            typeof inp.date === 'string' &&
            typeof inp.time === 'string' &&
            inp.date === cached.date &&
            inp.time === cached.time
          ) {
            result = {
              success: true,
              valid: cached.valid,
              reason: cached.reason,
              normalizedDatetimeUtc: cached.normalizedDatetimeUtc,
              messageForAi: buildValidationMessageForAi(cached.reason),
            } satisfies AppointmentTimeValidationResult;
            break;
          }
        }
        result = await validateAppointmentTimeTool(ctx, toolInput);
        break;
      }
      case 'get_shop_info':
        result = await getShopInfoTool(ctx, toolInput);
        break;
      case 'check_availability':
        result = await checkAvailabilityTool(ctx, toolInput);
        break;
      case 'create_booking':
        result = await createBookingTool(ctx, toolInput);
        break;
      case 'cancel_booking':
        result = await cancelBookingTool(ctx, toolInput);
        break;
      case 'reschedule_booking':
        result = await rescheduleBookingTool(ctx, toolInput);
        break;
      case 'send_booking_link':
        result = await sendBookingLinkTool(ctx, toolInput);
        break;
      case 'end_call':
        result = await endCallTool(ctx, toolInput);
        break;
      case 'request_human_handoff':
        result = await requestHumanHandoffTool(ctx, toolInput);
        break;
      case 'transfer_to_user':
        if (getResolvedVoiceTransport() === 'openai_sip_direct') {
          return compactSipToolJson({
            error:
              'transfer_to_user is disabled on OpenAI SIP direct; use request_human_handoff when live transfer is needed.',
          });
        }
        result = await transferToUserTool(ctx, toolInput);
        break;
      default:
        return compactSipToolJson({ error: `Unknown tool: ${toolName}` });
    }
    return compactSipToolJson(result);
  } catch (err) {
    logger.warn({ err, toolName }, 'sip_shop_tool_execution_failed');
    return compactSipToolJson({ error: 'Tool execution failed. Please try again.' });
  }
}
