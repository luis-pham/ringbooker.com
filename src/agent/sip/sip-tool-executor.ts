import {
  AVAILABILITY_CACHE_TTL_MS,
  buildAvailabilityCacheEntry,
  checkAvailabilityTool,
  publicAvailabilityResult,
} from '@/src/agent/tools/check-availability';
import { endCallTool } from '@/src/agent/tools/end-call';
import { cancelBookingTool } from '@/src/agent/tools/cancel-booking';
import { createBookingTool } from '@/src/agent/tools/create-booking';
import { getShopInfoTool } from '@/src/agent/tools/get-shop-info';
import { rescheduleBookingTool } from '@/src/agent/tools/reschedule-booking';
import { scheduleCallbackTool } from '@/src/agent/tools/schedule-callback';
import { sendBookingLinkTool } from '@/src/agent/tools/send-booking-link';
import { requestHumanHandoffTool } from '@/src/agent/tools/request-human-handoff';
import { transferToUserTool } from '@/src/agent/tools/transfer-to-user';
import {
  createBookingDraft,
  deriveBookingDraftReasonCodes,
  summarizeBookingDraftForLog,
  updateBookingDraftFromTranscript,
  type BookingDraftReasonCode,
} from '@/src/agent/booking/booking-draft';
import {
  applyConfirmedBookingDraftPhone,
  buildActionGuardBlockedToolOutput,
  createBookingActionGuardState,
  evaluateBookingActionGuard,
  markBookingActionGuardToolResult,
  recordBookingActionGuardBlocked,
  summarizeBookingActionGuardForLog,
} from '@/src/agent/booking/booking-action-guard';
import {
  type AppointmentTimeValidationResult,
  buildValidationMessageForAi,
  validateAppointmentTimeTool,
} from '@/src/agent/tools/validate-appointment-time';
import { resolveRuntimeService, type AgentToolContext } from '@/src/agent/tools/types';
import { extractAppointmentDateTime } from '@/src/agent/sip/appointment-time-extractor';
import type { Shop, TimeSlot } from '@/src/backend/domain/types';
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
import { getCalendarProvider, getShopCalendarProviderMetadata, type CalendarProvider } from '@/src/backend/services/calendar/types';
import { resolveBookingProviderReadiness } from '@/src/backend/services/calendar/provider-readiness';
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

function appointmentValidationResultLabel(result: unknown): 'valid' | 'invalid' | 'error' {
  if (!result || typeof result !== 'object') return 'error';
  const valid = (result as { valid?: unknown }).valid;
  if (valid === true) return 'valid';
  if (valid === false) return 'invalid';
  return 'error';
}

export type AvailabilityCheckPrePopulateResult =
  NonNullable<NonNullable<AgentToolContext['availabilityCheck']>['latest']>;

type AvailabilityCheckRequest = {
  providerId: string;
  service: string;
  date: string;
  time: string;
  durationMin: number;
  techName?: string;
  matchedServiceId?: string | null;
  key: string;
};

export type AvailabilityCheckPrePopulatePreview =
  Pick<AvailabilityCheckRequest, 'providerId' | 'service' | 'date' | 'time' | 'techName' | 'key'>;

type AvailabilityToolResult = {
  available: boolean;
  suggestions?: unknown;
  message?: string;
  requestedStaffUnavailable?: boolean;
  requestedStaffName?: string;
  fallbackStaffName?: string;
};

class LazySipCalendarProvider implements CalendarProvider {
  readonly shop: Shop;
  private provider: CalendarProvider | null = null;
  private degradedLogged = false;

  constructor(
    shop: Shop,
    private readonly createProvider: () => CalendarProvider,
    private readonly context: { requestId: string; rbCallId?: string; openAiLegCallControlId?: string | null },
  ) {
    this.shop = shop;
  }

  private getProvider(): CalendarProvider {
    if (this.provider) return this.provider;
    try {
      this.provider = this.createProvider();
      return this.provider;
    } catch (err) {
      const readiness = resolveBookingProviderReadiness(this.shop);
      if (!this.degradedLogged) {
        this.degradedLogged = true;
        logger.warn(
          {
            err,
            callSessionId: this.context.rbCallId ?? this.context.requestId,
            providerCallId: this.context.openAiLegCallControlId ?? null,
            shopId: this.shop.id,
            provider: readiness.providerId,
            readinessStatus: readiness.status,
            missingFields: readiness.missingFields,
          },
          'provider_config_invalid',
        );
        logger.warn(
          {
            callSessionId: this.context.rbCallId ?? this.context.requestId,
            providerCallId: this.context.openAiLegCallControlId ?? null,
            shopId: this.shop.id,
            provider: readiness.providerId,
            degradedReason: 'provider_unavailable',
          },
          'voice_session_degraded',
        );
      }
      throw err;
    }
  }

  async prefetchAvailability(params: { date: string; timezone: string }): Promise<void> {
    const provider = this.getProvider();
    await provider.prefetchAvailability?.(params);
  }

  async checkAvailability(params: Parameters<CalendarProvider['checkAvailability']>[0]): ReturnType<CalendarProvider['checkAvailability']> {
    return this.getProvider().checkAvailability(params);
  }

  async getTeamMembers(): Promise<Array<{ id: string; displayName: string; givenName?: string; familyName?: string }>> {
    return this.getProvider().getTeamMembers?.() ?? [];
  }

  async findTeamMemberByName(name: string): Promise<string | null> {
    return this.getProvider().findTeamMemberByName?.(name) ?? null;
  }

  async createBooking(input: Parameters<CalendarProvider['createBooking']>[0]): ReturnType<CalendarProvider['createBooking']> {
    return this.getProvider().createBooking(input);
  }

  async cancelBooking(params: Parameters<CalendarProvider['cancelBooking']>[0]): ReturnType<CalendarProvider['cancelBooking']> {
    return this.getProvider().cancelBooking(params);
  }

  async rescheduleBooking(params: Parameters<CalendarProvider['rescheduleBooking']>[0]): ReturnType<CalendarProvider['rescheduleBooking']> {
    return this.getProvider().rescheduleBooking(params);
  }
}

function availabilityCacheKey(params: {
  providerId: string;
  service: string;
  date: string;
  time: string;
  techName?: string;
}): string {
  return [
    params.providerId,
    params.service.trim().toLowerCase(),
    params.date,
    params.time,
    params.techName?.trim().toLowerCase() ?? '',
  ].join('|');
}

function availabilityCacheMatches(
  cached: AvailabilityCheckPrePopulateResult | null | undefined,
  request: Pick<AvailabilityCheckRequest, 'providerId' | 'service' | 'date' | 'time' | 'techName'>,
): cached is AvailabilityCheckPrePopulateResult {
  if (!cached) return false;
  if (Date.now() - cached.fetchedAtMs > AVAILABILITY_CACHE_TTL_MS) return false;
  return availabilityCacheKey(cached) === availabilityCacheKey(request);
}

function latestServiceCandidate(ctx: AgentToolContext): string | null {
  const draft = ctx.bookingDraft;
  if (!draft || draft.serviceCandidates.length === 0 || (draft.confidence.service ?? 0) < 0.55) return null;
  return draft.serviceCandidates[draft.serviceCandidates.length - 1] ?? null;
}

function resolveDraftServiceName(ctx: AgentToolContext): string | null {
  const candidate = latestServiceCandidate(ctx);
  if (!candidate) return null;
  const resolved = resolveRuntimeService(ctx.shop, candidate);
  return resolved.ok ? resolved.serviceName : null;
}

function buildAvailabilityRequestFromDraft(ctx: AgentToolContext): AvailabilityCheckRequest | null {
  const providerMeta = getShopCalendarProviderMetadata(ctx.shop);
  if (providerMeta.id === 'manual' || !providerMeta.capabilities.checkAvailability) return null;
  const readiness = resolveBookingProviderReadiness(ctx.shop);
  if (!readiness.canCheckAvailability) return null;

  const serviceCandidate = latestServiceCandidate(ctx);
  if (!serviceCandidate) return null;
  const service = resolveRuntimeService(ctx.shop, serviceCandidate);
  if (!service.ok) return null;

  const validation = ctx.appointmentTimeValidation?.latest;
  if (!validation?.valid) return null;

  const key = availabilityCacheKey({
    providerId: providerMeta.id,
    service: service.serviceName,
    date: validation.date,
    time: validation.time,
  });

  return {
    providerId: providerMeta.id,
    service: service.serviceName,
    date: validation.date,
    time: validation.time,
    durationMin: service.durationMin,
    matchedServiceId: service.matchedServiceId,
    key,
  };
}

export function previewAvailabilityFromDraft(ctx: AgentToolContext): AvailabilityCheckPrePopulatePreview | null {
  const request = buildAvailabilityRequestFromDraft(ctx);
  if (!request) return null;
  return {
    providerId: request.providerId,
    service: request.service,
    date: request.date,
    time: request.time,
    ...(request.techName ? { techName: request.techName } : {}),
    key: request.key,
  };
}

function buildAvailabilityRequestFromToolInput(
  ctx: AgentToolContext,
  input: unknown,
): AvailabilityCheckRequest | null {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return null;
  const record = input as Record<string, unknown>;
  const date = typeof record.date === 'string' ? record.date : '';
  const time = typeof record.time === 'string' ? record.time : '';
  const serviceText = typeof record.service === 'string' ? record.service : '';
  const techName = typeof record.techName === 'string' && record.techName.trim() ? record.techName.trim() : undefined;
  if (!date || !time || !serviceText) return null;

  const providerMeta = getShopCalendarProviderMetadata(ctx.shop);
  if (providerMeta.id === 'manual' || !providerMeta.capabilities.checkAvailability) return null;
  const readiness = resolveBookingProviderReadiness(ctx.shop);
  if (!readiness.canCheckAvailability) return null;
  const service = resolveRuntimeService(ctx.shop, serviceText);
  if (!service.ok) return null;

  return {
    providerId: providerMeta.id,
    service: service.serviceName,
    date,
    time,
    durationMin: service.durationMin,
    techName,
    matchedServiceId: service.matchedServiceId,
    key: availabilityCacheKey({
      providerId: providerMeta.id,
      service: service.serviceName,
      date,
      time,
      techName,
    }),
  };
}

function availabilityToolResult(result: unknown): AvailabilityToolResult | null {
  if (!result || typeof result !== 'object') return null;
  const record = result as Record<string, unknown>;
  if (typeof record.available !== 'boolean') return null;
  return {
    available: record.available,
    ...(record.suggestions !== undefined ? { suggestions: record.suggestions } : {}),
    ...(typeof record.message === 'string' ? { message: record.message } : {}),
    ...(typeof record.requestedStaffUnavailable === 'boolean' ? { requestedStaffUnavailable: record.requestedStaffUnavailable } : {}),
    ...(typeof record.requestedStaffName === 'string' ? { requestedStaffName: record.requestedStaffName } : {}),
    ...(typeof record.fallbackStaffName === 'string' ? { fallbackStaffName: record.fallbackStaffName } : {}),
  };
}

function clearAvailabilityIfDateTimeChanged(ctx: AgentToolContext, params: { date: string; time: string }): void {
  const cached = ctx.availabilityCheck?.latest;
  if (cached && (cached.date !== params.date || cached.time !== params.time)) {
    ctx.availabilityCheck = { latest: null };
  }
}

function clearAvailabilityIfServiceChanged(ctx: AgentToolContext, previousResolvedService: string | null): void {
  const cached = ctx.availabilityCheck?.latest;
  if (!cached) return;
  const currentResolvedService = resolveDraftServiceName(ctx);
  if (currentResolvedService !== previousResolvedService || currentResolvedService !== cached.service) {
    ctx.availabilityCheck = { latest: null };
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
  const readiness = resolveBookingProviderReadiness(params.shop);
  if (readiness.selectedIntegration && !readiness.liveReady) {
    logger.warn(
      {
        callSessionId: params.rbCallId ?? params.requestId,
        providerCallId: params.openAiLegCallControlId ?? null,
        shopId: params.shop.id,
        provider: readiness.providerId,
        readinessStatus: readiness.status,
        missingFields: readiness.missingFields,
      },
      'provider_config_invalid',
    );
    logger.warn(
      {
        callSessionId: params.rbCallId ?? params.requestId,
        providerCallId: params.openAiLegCallControlId ?? null,
        shopId: params.shop.id,
        provider: readiness.providerId,
        degradedReason: 'provider_not_live_ready',
      },
      'voice_session_degraded',
    );
  }

  const calendarProvider = new LazySipCalendarProvider(
    params.shop,
    () => getCalendarProvider(params.shop, {
      allowManualFallback: true,
      persistCredentials: async (encodedCredentials) => {
        await params.deps.shopsRepository.updateCalendarConnection(params.shop.id, {
          google_cal_id: params.shop.google_cal_id ?? null,
          google_cal_credentials_encrypted: encodedCredentials,
        });
      },
    }),
    {
      requestId: params.requestId,
      rbCallId: params.rbCallId,
      openAiLegCallControlId: params.openAiLegCallControlId,
    },
  );

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
    bookingDraft: createBookingDraft(),
    actionGuard: createBookingActionGuardState(),
    appointmentTimeValidation: { latest: null },
    availabilityCheck: { latest: null },
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
export type AppointmentTimePrePopulateResult = {
  date: string;
  time: string;
  valid: boolean;
  reason: AppointmentTimeValidationResult['reason'];
  normalizedDatetimeUtc: string;
  messageForAi: string;
  timestamp: string;
  status: 'set' | 'already_cached';
};

export type AppointmentTimePrePopulatePreview = {
  date: string;
  time: string;
};

export type AppointmentTimePrePopulateAttempt = {
  preview: AppointmentTimePrePopulatePreview | null;
  result: Promise<AppointmentTimePrePopulateResult | null>;
};

export function previewAppointmentTimeFromTranscript(
  ctx: AgentToolContext,
  transcript: string,
): AppointmentTimePrePopulatePreview | null {
  return extractAppointmentDateTime(transcript, ctx.shop);
}

export async function prePopulateFromTranscript(
  ctx: AgentToolContext,
  transcript: string,
): Promise<AppointmentTimePrePopulateResult | null> {
  if (!ctx.appointmentTimeValidation) return null;

  const extracted = extractAppointmentDateTime(transcript, ctx.shop);
  if (!extracted) return null;

  const existing = ctx.appointmentTimeValidation.latest;
  if (existing && existing.date === extracted.date && existing.time === extracted.time) {
    return {
      ...extracted,
      valid: existing.valid,
      reason: existing.reason,
      normalizedDatetimeUtc: existing.normalizedDatetimeUtc,
      messageForAi: buildValidationMessageForAi(existing.reason),
      timestamp: new Date().toISOString(),
      status: 'already_cached',
    };
  }
  clearAvailabilityIfDateTimeChanged(ctx, extracted);

  const startedAt = Date.now();
  logger.info(
    {
      callSessionId: ctx.rbCallId ?? ctx.requestId,
      providerCallId: ctx.openAiLegCallControlId ?? null,
      shopId: ctx.shop.id,
      timestamp: new Date(startedAt).toISOString(),
      eventType: 'appointment_time_prepopulate_tool_start',
      date: extracted.date,
      time: extracted.time,
    },
    `[TIMING] appointment_time_prepopulate_tool_start date=${extracted.date} time=${extracted.time}`,
  );
  try {
    await validateAppointmentTimeTool(ctx, extracted);
    const latest = ctx.appointmentTimeValidation.latest;
    if (!latest) return null;
    const completedAt = Date.now();
    logger.info(
      {
        callSessionId: ctx.rbCallId ?? ctx.requestId,
        providerCallId: ctx.openAiLegCallControlId ?? null,
        shopId: ctx.shop.id,
        timestamp: new Date(completedAt).toISOString(),
        eventType: 'appointment_time_prepopulate_tool_complete',
        date: extracted.date,
        time: extracted.time,
        elapsedMs: completedAt - startedAt,
        result: latest.valid ? 'valid' : 'invalid',
        reason: latest.reason,
      },
      `[TIMING] appointment_time_prepopulate_tool_complete elapsedMs=${completedAt - startedAt} result=${latest.valid ? 'valid' : 'invalid'}`,
    );
    return {
      ...extracted,
      valid: latest.valid,
      reason: latest.reason,
      normalizedDatetimeUtc: latest.normalizedDatetimeUtc,
      messageForAi: buildValidationMessageForAi(latest.reason),
      timestamp: new Date().toISOString(),
      status: 'set',
    };
  } catch (err) {
    logger.warn(
      {
        err,
        callSessionId: ctx.rbCallId ?? ctx.requestId,
        providerCallId: ctx.openAiLegCallControlId ?? null,
        shopId: ctx.shop.id,
        eventType: 'appointment_time_prepopulate_tool_error',
        date: extracted.date,
        time: extracted.time,
        elapsedMs: Date.now() - startedAt,
      },
      'appointment_time_prepopulate_tool_error',
    );
    // Best-effort — never fail the call over a pre-population error
    return null;
  }
}

export async function prePopulateAvailabilityFromDraft(
  ctx: AgentToolContext,
): Promise<AvailabilityCheckPrePopulateResult | null> {
  const request = buildAvailabilityRequestFromDraft(ctx);
  if (!request) return null;

  if (availabilityCacheMatches(ctx.availabilityCheck?.latest, request)) {
    return ctx.availabilityCheck?.latest ?? null;
  }

  const startedAt = Date.now();
  logger.info(
    {
      callSessionId: ctx.rbCallId ?? ctx.requestId,
      providerCallId: ctx.openAiLegCallControlId ?? null,
      shopId: ctx.shop.id,
      timestamp: new Date(startedAt).toISOString(),
      eventType: 'availability_prefetch_start',
      provider: request.providerId,
      service: request.service,
      date: request.date,
      time: request.time,
    },
    `[TIMING] availability_prefetch_start service=${request.service} date=${request.date} time=${request.time} provider=${request.providerId}`,
  );

  try {
    const result = await ctx.calendarProvider.checkAvailability({
      date: request.date,
      time: request.time,
      durationMin: request.durationMin,
      techName: request.techName,
      timezone: ctx.shop.timezone,
      matchedServiceId: request.matchedServiceId,
    });
    const publicResult = publicAvailabilityResult(result);
    const parsedResult = availabilityToolResult(publicResult);
    if (!parsedResult) return null;

    const currentRequest = buildAvailabilityRequestFromDraft(ctx);
    if (!currentRequest || currentRequest.key !== request.key) {
      logger.info(
        {
          callSessionId: ctx.rbCallId ?? ctx.requestId,
          providerCallId: ctx.openAiLegCallControlId ?? null,
          shopId: ctx.shop.id,
          eventType: 'availability_prefetch_stale_discarded',
          expectedKey: request.key,
          currentKey: currentRequest?.key ?? null,
        },
        `[TIMING] availability_prefetch_stale_discarded expectedKey=${request.key} currentKey=${currentRequest?.key ?? 'null'}`,
      );
      return null;
    }

    const cached: AvailabilityCheckPrePopulateResult = buildAvailabilityCacheEntry({
      providerId: request.providerId,
      service: request.service,
      date: request.date,
      time: request.time,
      ...(request.techName ? { techName: request.techName } : {}),
      result,
      fetchedAtMs: Date.now(),
      prefetchStartedAtMs: startedAt,
    });
    ctx.availabilityCheck = { latest: cached };

    logger.info(
      {
        callSessionId: ctx.rbCallId ?? ctx.requestId,
        providerCallId: ctx.openAiLegCallControlId ?? null,
        shopId: ctx.shop.id,
        eventType: 'availability_prefetch_complete',
        provider: request.providerId,
        service: request.service,
        date: request.date,
        time: request.time,
        available: cached.available,
        elapsedMs: cached.fetchedAtMs - startedAt,
      },
      `[TIMING] availability_prefetch_complete available=${cached.available} elapsedMs=${cached.fetchedAtMs - startedAt}`,
    );
    return cached;
  } catch (err) {
    const elapsedMs = Date.now() - startedAt;
    logger.warn(
      {
        err,
        callSessionId: ctx.rbCallId ?? ctx.requestId,
        providerCallId: ctx.openAiLegCallControlId ?? null,
        shopId: ctx.shop.id,
        eventType: 'availability_prefetch_error',
        provider: request.providerId,
        service: request.service,
        date: request.date,
        time: request.time,
        elapsedMs,
      },
      `[TIMING] availability_prefetch_error error=${err instanceof Error ? err.message : String(err)} elapsedMs=${elapsedMs}`,
    );
    return null;
  }
}

export function updateSipBookingDraftFromTranscript(
  ctx: AgentToolContext,
  transcript: string,
): { reasonCodes: BookingDraftReasonCode[]; bookingDraft: ReturnType<typeof summarizeBookingDraftForLog> } | null {
  const previousResolvedService = resolveDraftServiceName(ctx);
  const previous = ctx.bookingDraft ?? createBookingDraft();
  const next = updateBookingDraftFromTranscript(previous, transcript, {
    shop: ctx.shop,
    callerPhone: ctx.callerPhone,
  });
  ctx.bookingDraft = next;
  clearAvailabilityIfServiceChanged(ctx, previousResolvedService);

  return {
    reasonCodes: deriveBookingDraftReasonCodes(previous, next),
    bookingDraft: summarizeBookingDraftForLog(next),
  };
}

export async function executeSipShopToolCall(
  ctx: AgentToolContext,
  toolName: string,
  toolInput: unknown,
): Promise<string> {
  try {
    const guardDecision = evaluateBookingActionGuard(ctx, toolName, toolInput);
    logger.info(
      {
        callSessionId: ctx.rbCallId ?? ctx.requestId,
        providerCallId: ctx.openAiLegCallControlId ?? null,
        shopId: ctx.shop.id,
        eventType: 'action_guard_decision',
        proposedTool: toolName,
        backendDecision: guardDecision.backendDecision,
        reason: guardDecision.reason,
        missingFields: guardDecision.allowed ? undefined : guardDecision.missingFields,
        actionGuard: summarizeBookingActionGuardForLog(ctx),
      },
      'sip_action_guard_decision',
    );
    if (!guardDecision.allowed) {
      recordBookingActionGuardBlocked(ctx, toolName, guardDecision);
      return compactSipToolJson(JSON.parse(buildActionGuardBlockedToolOutput(guardDecision)));
    }
    if (toolName === 'create_booking' || toolName === 'send_booking_link' || toolName === 'schedule_callback') {
      const appliedPhone = applyConfirmedBookingDraftPhone(ctx);
      if (appliedPhone) {
        logger.info(
          {
            callSessionId: ctx.rbCallId ?? ctx.requestId,
            providerCallId: ctx.openAiLegCallControlId ?? null,
            shopId: ctx.shop.id,
            eventType: 'action_guard_phone_applied',
            proposedTool: toolName,
            backendDecision: 'execute_business_tool',
            phoneLast4: appliedPhone.slice(-4),
            reason: 'confirmed_phone_from_booking_draft',
          },
          'sip_action_guard_phone_applied',
        );
      }
    }

    let result: unknown;
    switch (toolName) {
      case 'validate_appointment_time': {
        const startedAt = Date.now();
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
            logger.info(
              {
                callSessionId: ctx.rbCallId ?? ctx.requestId,
                providerCallId: ctx.openAiLegCallControlId ?? null,
                shopId: ctx.shop.id,
                timestamp: new Date(startedAt).toISOString(),
                eventType: 'tool_execute_start',
                proposedTool: toolName,
                cache: 'HIT',
              },
              `[TIMING] tool_execute_start at ${new Date(startedAt).toISOString()}`,
            );
            const elapsedMs = Date.now() - startedAt;
            logger.info(
              {
                callSessionId: ctx.rbCallId ?? ctx.requestId,
                providerCallId: ctx.openAiLegCallControlId ?? null,
                shopId: ctx.shop.id,
                eventType: 'appointment_time_validation_cache_hit',
                proposedTool: toolName,
                backendDecision: 'cache_hit',
                date: inp.date,
                time: inp.time,
                elapsedMs,
              },
              `validate_appointment_time: CACHE HIT — returning prepopulated result in ${elapsedMs}ms`,
            );
            logger.info(
              {
                callSessionId: ctx.rbCallId ?? ctx.requestId,
                providerCallId: ctx.openAiLegCallControlId ?? null,
                shopId: ctx.shop.id,
                timestamp: new Date().toISOString(),
                eventType: 'tool_execute_complete',
                proposedTool: toolName,
                cache: 'HIT',
                elapsedMs,
                result: cached.valid ? 'valid' : 'invalid',
              },
              `[TIMING] tool_execute_complete at ${new Date().toISOString()}`,
            );
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
        logger.info(
          {
            callSessionId: ctx.rbCallId ?? ctx.requestId,
            providerCallId: ctx.openAiLegCallControlId ?? null,
            shopId: ctx.shop.id,
            timestamp: new Date(startedAt).toISOString(),
            eventType: 'tool_execute_start',
            proposedTool: toolName,
            cache: 'MISS',
          },
          `[TIMING] tool_execute_start at ${new Date(startedAt).toISOString()}`,
        );
        logger.info(
          {
            callSessionId: ctx.rbCallId ?? ctx.requestId,
            providerCallId: ctx.openAiLegCallControlId ?? null,
            shopId: ctx.shop.id,
            eventType: 'appointment_time_validation_cache_miss',
            proposedTool: toolName,
            backendDecision: 'cache_miss',
          },
          'validate_appointment_time: CACHE MISS — executing tool',
        );
        const inp = toolInput as Record<string, unknown>;
        if (typeof inp.date === 'string' && typeof inp.time === 'string') {
          clearAvailabilityIfDateTimeChanged(ctx, { date: inp.date, time: inp.time });
        }
        result = await validateAppointmentTimeTool(ctx, toolInput);
        logger.info(
          {
            callSessionId: ctx.rbCallId ?? ctx.requestId,
            providerCallId: ctx.openAiLegCallControlId ?? null,
            shopId: ctx.shop.id,
            timestamp: new Date().toISOString(),
            eventType: 'tool_execute_complete',
            proposedTool: toolName,
            cache: 'MISS',
            elapsedMs: Date.now() - startedAt,
            result: appointmentValidationResultLabel(result),
          },
          `[TIMING] tool_execute_complete at ${new Date().toISOString()}`,
        );
        break;
      }
      case 'get_shop_info':
        result = await getShopInfoTool(ctx, toolInput);
        break;
      case 'check_availability': {
        const startedAt = Date.now();
        const request = buildAvailabilityRequestFromToolInput(ctx, toolInput);
        if (request && availabilityCacheMatches(ctx.availabilityCheck?.latest, request)) {
          const cached = ctx.availabilityCheck!.latest!;
          const elapsedMs = Date.now() - startedAt;
          logger.info(
            {
              callSessionId: ctx.rbCallId ?? ctx.requestId,
              providerCallId: ctx.openAiLegCallControlId ?? null,
              shopId: ctx.shop.id,
              eventType: 'availability_cache_hit',
              provider: request.providerId,
              service: request.service,
              date: request.date,
              time: request.time,
              elapsedMs,
            },
            `[TIMING] availability_cache_hit elapsedMs=${elapsedMs}`,
          );
          result = {
            available: cached.available,
            ...(cached.message ? { message: cached.message } : {}),
            ...(cached.requestedStaffUnavailable !== undefined ? { requestedStaffUnavailable: cached.requestedStaffUnavailable } : {}),
            ...(cached.requestedStaffName ? { requestedStaffName: cached.requestedStaffName } : {}),
            ...(cached.fallbackStaffName ? { fallbackStaffName: cached.fallbackStaffName } : {}),
            ...(cached.suggestions !== undefined ? { suggestions: cached.suggestions } : {}),
          };
          break;
        }

        result = await checkAvailabilityTool(ctx, toolInput);
        const parsedResult = availabilityToolResult(result);
        if (request && parsedResult) {
          const validation = ctx.appointmentTimeValidation?.latest;
          const currentValidationMatches = !validation || (
            validation.date === request.date &&
            validation.time === request.time &&
            validation.valid === true
          );
          if (currentValidationMatches) {
            if (!availabilityCacheMatches(ctx.availabilityCheck?.latest, request)) {
              ctx.availabilityCheck = {
                latest: {
                  providerId: request.providerId,
                  service: request.service,
                  date: request.date,
                  time: request.time,
                  ...(request.techName ? { techName: request.techName } : {}),
                  available: parsedResult.available,
                  ...(parsedResult.suggestions !== undefined ? { suggestions: parsedResult.suggestions as TimeSlot[] } : {}),
                  ...(parsedResult.message ? { message: parsedResult.message } : {}),
                  requestedStaffUnavailable: parsedResult.requestedStaffUnavailable ?? false,
                  requestedStaffName: parsedResult.requestedStaffName ?? null,
                  fallbackStaffName: parsedResult.fallbackStaffName ?? null,
                  resolvedTeamMemberId: null,
                  resolvedTeamMemberName: null,
                  requestedTeamMemberId: null,
                  requestedTeamMemberName: null,
                  fallbackTeamMemberId: null,
                  fallbackTeamMemberName: null,
                  serviceVariationId: null,
                  locationId: null,
                  raw: result,
                  fetchedAtMs: Date.now(),
                },
              };
            }
          }
        }
        break;
      }
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
      case 'schedule_callback':
        result = await scheduleCallbackTool(ctx, toolInput);
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
    const output = compactSipToolJson(result);
    markBookingActionGuardToolResult(ctx, toolName, output);
    return output;
  } catch (err) {
    logger.warn({ err, toolName }, 'sip_shop_tool_execution_failed');
    return compactSipToolJson({ error: 'Tool execution failed. Please try again.' });
  }
}
