import { randomUUID } from 'node:crypto';
import { DateTime } from 'luxon';

import type { RealtimeAgentRuntime, StartInboundRealtimeResult } from '@/src/agent/realtime/types';
import type { Customer, Shop, ShopRoutingRule, ToolError } from '@/src/backend/domain/types';
import type { BookingsRepository, CallbacksRepository, CustomersRepository, JobsRepository, ShopRoutingRulesRepository, ShopsRepository } from '@/src/backend/ports/repositories';
import { buildSystemPrompt } from '@/src/backend/prompts/build-system-prompt';
import { getCalendarProvider, type CalendarProvider } from '@/src/backend/services/calendar/types';
import type { TelephonyService } from '@/src/backend/services/telephony/types';
import { checkAvailabilityTool } from '@/src/agent/tools/check-availability';
import { cancelBookingTool } from '@/src/agent/tools/cancel-booking';
import { createBookingTool } from '@/src/agent/tools/create-booking';
import { getShopInfoTool } from '@/src/agent/tools/get-shop-info';
import { rescheduleBookingTool } from '@/src/agent/tools/reschedule-booking';
import { scheduleCallbackTool } from '@/src/agent/tools/schedule-callback';
import { sendBookingLinkTool } from '@/src/agent/tools/send-booking-link';
import { transferToUserTool } from '@/src/agent/tools/transfer-to-user';

export type InboundAgentSessionDeps = {
  shopsRepository: ShopsRepository;
  jobsRepository: JobsRepository;
  bookingsRepository: BookingsRepository;
  callbacksRepository: CallbacksRepository;
  customersRepository?: CustomersRepository;
  telephonyService: TelephonyService;
  realtimeAgentRuntime: RealtimeAgentRuntime;
  shopRoutingRulesRepository?: ShopRoutingRulesRepository;
};

export type InboundAgentSessionInput = {
  destinationPhone: string;
  callerPhone: string;
  requestId?: string;
  roomName?: string;
  customer?: Customer | null;
};

export type AgentToolName =
  | 'check_availability'
  | 'create_booking'
  | 'cancel_booking'
  | 'reschedule_booking'
  | 'get_shop_info'
  | 'transfer_to_user'
  | 'schedule_callback'
  | 'send_booking_link';

export class InboundAgentSession {
  readonly requestId: string;
  readonly roomName: string;
  readonly shop: Shop;
  readonly callerPhone: string;
  readonly customer: Customer | null;
  readonly systemPrompt: string;
  private readonly calendarProvider: CalendarProvider;
  private readonly prefetchedDateKeys = new Set<string>();
  private prefetchAttempts = 0;
  private prefetchCompleted = 0;
  private checkAvailabilityCalls = 0;
  private checkAvailabilityPrefetchHits = 0;

  constructor(
    private readonly deps: InboundAgentSessionDeps,
    params: {
      requestId: string;
      roomName: string;
      shop: Shop;
      callerPhone: string;
      customer: Customer | null;
      routingRules?: ShopRoutingRule[];
    },
  ) {
    this.requestId = params.requestId;
    this.roomName = params.roomName;
    this.shop = params.shop;
    this.callerPhone = params.callerPhone;
    this.customer = params.customer;
    this.calendarProvider = getCalendarProvider(this.shop, {
      persistCredentials: async (encodedCredentials) => {
        await this.deps.shopsRepository.updateCalendarConnection(this.shop.id, {
          google_cal_id: this.shop.google_cal_id ?? null,
          google_cal_credentials_encrypted: encodedCredentials,
        });
      },
    });
    this.systemPrompt = buildSystemPrompt({
      shop: params.shop,
      customer: params.customer,
      mode: 'inbound',
      routingRules: params.routingRules,
    });
  }

  async runTool(name: AgentToolName, input: unknown): Promise<unknown | ToolError> {
    if (name === 'check_availability') {
      this.checkAvailabilityCalls += 1;
      const requestedDate = extractDateFromToolInput(input);
      if (requestedDate && this.prefetchedDateKeys.has(`${this.shop.id}:${requestedDate}`)) {
        this.checkAvailabilityPrefetchHits += 1;
      }
    }

    const ctx = {
      shop: this.shop,
      callerPhone: this.callerPhone,
      requestId: this.requestId,
      roomName: this.roomName,
      calendarProvider: this.calendarProvider,
      jobsRepository: this.deps.jobsRepository,
      bookingsRepository: this.deps.bookingsRepository,
      callbacksRepository: this.deps.callbacksRepository,
      shopsRepository: this.deps.shopsRepository,
      customersRepository: this.deps.customersRepository,
      telephonyService: this.deps.telephonyService,
    };

    switch (name) {
      case 'check_availability':
        return checkAvailabilityTool(ctx, input);
      case 'create_booking':
        return createBookingTool(ctx, input);
      case 'cancel_booking':
        return cancelBookingTool(ctx, input);
      case 'reschedule_booking':
        return rescheduleBookingTool(ctx, input);
      case 'get_shop_info':
        return getShopInfoTool(ctx, input);
      case 'transfer_to_user':
        return transferToUserTool(ctx, input);
      case 'schedule_callback':
        return scheduleCallbackTool(ctx, input);
      case 'send_booking_link':
        return sendBookingLinkTool(ctx, input);
      default:
        return {
          error: 'Unknown tool.',
          code: 'NOT_FOUND',
          retryable: false,
        } satisfies ToolError;
    }
  }

  async prefetchFromUtterance(text: string): Promise<void> {
    const utterance = text.trim();
    if (!utterance) return;
    const lower = utterance.toLowerCase();
    const maybeBookingIntent =
      lower.includes('book') ||
      lower.includes('appointment') ||
      lower.includes('availability') ||
      lower.includes('schedule') ||
      lower.includes('lich') ||
      lower.includes('lịch') ||
      lower.includes('dat lich') ||
      lower.includes('đặt lịch') ||
      lower.includes('hen') ||
      lower.includes('hẹn');
    if (!maybeBookingIntent) return;

    const dateCandidates = extractDateCandidates(utterance, this.shop.timezone);
    if (dateCandidates.length === 0) return;

    if (!this.calendarProvider.prefetchAvailability) return;

    for (const date of dateCandidates) {
      const key = `${this.shop.id}:${date}`;
      if (this.prefetchedDateKeys.has(key)) continue;
      this.prefetchedDateKeys.add(key);
      this.prefetchAttempts += 1;
      void this.calendarProvider.prefetchAvailability({
        date,
        timezone: this.shop.timezone,
      }).then(() => {
        this.prefetchCompleted += 1;
      }).catch(() => {
        // best effort prefetch
      });
    }
  }

  async warmupCallStartContext(): Promise<void> {
    const serviceSnapshot = this.shop.services.map((service) => `${service.name}:${service.price}:${service.duration_min}`).join('|');
    const staffSnapshot = (this.shop.staff ?? []).map((member) => `${member.name}:${member.role ?? ''}`).join('|');
    const faqSnapshot = (this.shop.faqs ?? []).map((item) => item.question).join('|');
    const hoursSnapshot = Object.entries(this.shop.hours)
      .map(([day, value]) => ('open' in value ? `${day}:${value.open}-${value.close}` : `${day}:closed`))
      .join('|');
    const contextFingerprint = `${this.shop.id}|${this.shop.timezone}|${serviceSnapshot}|${staffSnapshot}|${faqSnapshot}|${hoursSnapshot}|${this.customer?.phone ?? ''}`;
    if (!contextFingerprint) return;

    if (!this.calendarProvider.prefetchAvailability) return;
    const daysToWarm = resolveWarmupDays();
    if (daysToWarm <= 0) return;

    const datesToWarm = nextOpenDates({
      timezone: this.shop.timezone,
      hours: this.shop.hours,
      daysToWarm,
    });

    for (const date of datesToWarm) {
      const key = `${this.shop.id}:${date}`;
      if (this.prefetchedDateKeys.has(key)) continue;
      this.prefetchedDateKeys.add(key);
      this.prefetchAttempts += 1;
      await this.calendarProvider.prefetchAvailability({
        date,
        timezone: this.shop.timezone,
      });
      this.prefetchCompleted += 1;
    }
  }

  getPrefetchMetrics() {
    return {
      prefetchedDateCount: this.prefetchedDateKeys.size,
      prefetchAttempts: this.prefetchAttempts,
      prefetchCompleted: this.prefetchCompleted,
      checkAvailabilityCalls: this.checkAvailabilityCalls,
      checkAvailabilityPrefetchHits: this.checkAvailabilityPrefetchHits,
      checkAvailabilityPrefetchHitRate:
        this.checkAvailabilityCalls > 0 ? this.checkAvailabilityPrefetchHits / this.checkAvailabilityCalls : 0,
    };
  }

  async startRealtimeSession(): Promise<StartInboundRealtimeResult> {
    return await this.deps.realtimeAgentRuntime.startInboundSession({
      requestId: this.requestId,
      roomName: this.roomName,
      shopId: this.shop.id,
      destinationPhone: this.shop.phone_number,
      callerPhone: this.callerPhone,
      systemPrompt: this.systemPrompt,
      shopPlan: this.shop.plan,
    });
  }
}

function resolveWarmupDays(): number {
  const raw = Number(process.env.AGENT_CALENDAR_WARMUP_DAYS ?? 2);
  if (!Number.isFinite(raw) || raw <= 0) return 0;
  return Math.min(7, Math.floor(raw));
}

function weekdayKeyFromIsoWeekday(weekday: number): 'mon' | 'tue' | 'wed' | 'thu' | 'fri' | 'sat' | 'sun' {
  switch (weekday) {
    case 1:
      return 'mon';
    case 2:
      return 'tue';
    case 3:
      return 'wed';
    case 4:
      return 'thu';
    case 5:
      return 'fri';
    case 6:
      return 'sat';
    default:
      return 'sun';
  }
}

function nextOpenDates(params: { timezone: string; hours: Shop['hours']; daysToWarm: number }): string[] {
  const out: string[] = [];
  const now = DateTime.now().setZone(params.timezone).startOf('day');

  for (let i = 0; i < 14 && out.length < params.daysToWarm; i += 1) {
    const day = now.plus({ days: i });
    const key = weekdayKeyFromIsoWeekday(day.weekday);
    const slot = params.hours[key];
    if (!slot || ('closed' in slot && slot.closed)) continue;
    out.push(day.toFormat('yyyy-LL-dd'));
  }

  return out;
}

function extractDateCandidates(text: string, timezone: string): string[] {
  const result = new Set<string>();
  const now = DateTime.now().setZone(timezone);
  const lower = text.toLowerCase();

  if (lower.includes('today') || lower.includes('hôm nay')) {
    result.add(now.toFormat('yyyy-LL-dd'));
  }
  if (lower.includes('tomorrow') || lower.includes('ngày mai') || lower.includes('mai')) {
    result.add(now.plus({ days: 1 }).toFormat('yyyy-LL-dd'));
  }

  const isoMatches = text.match(/\b\d{4}-\d{2}-\d{2}\b/g) ?? [];
  for (const match of isoMatches) {
    const parsed = DateTime.fromISO(match, { zone: timezone });
    if (parsed.isValid) {
      result.add(parsed.toFormat('yyyy-LL-dd'));
    }
  }

  const slashMatches = text.match(/\b(\d{1,2})\/(\d{1,2})(?:\/(\d{4}))?\b/g) ?? [];
  for (const match of slashMatches) {
    const groups = match.match(/^(\d{1,2})\/(\d{1,2})(?:\/(\d{4}))?$/);
    if (!groups) continue;
    const month = Number(groups[1]);
    const day = Number(groups[2]);
    const year = groups[3] ? Number(groups[3]) : now.year;
    const parsed = DateTime.fromObject({ year, month, day }, { zone: timezone });
    if (!parsed.isValid) continue;
    result.add(parsed.toFormat('yyyy-LL-dd'));
  }

  return [...result].slice(0, 2);
}

function extractDateFromToolInput(input: unknown): string | null {
  if (!input || typeof input !== 'object') return null;
  const maybeDate = (input as { date?: unknown }).date;
  if (typeof maybeDate !== 'string') return null;
  return /^\d{4}-\d{2}-\d{2}$/.test(maybeDate) ? maybeDate : null;
}

export async function createInboundAgentSession(
  deps: InboundAgentSessionDeps,
  input: InboundAgentSessionInput,
): Promise<InboundAgentSession | null> {
  const shop = await deps.shopsRepository.findByDestinationPhone(input.destinationPhone);
  if (!shop) return null;

  const routingRules = deps.shopRoutingRulesRepository
    ? await deps.shopRoutingRulesRepository.listByShopId(shop.id, { activeOnly: true }).catch(() => [])
    : [];

  return new InboundAgentSession(deps, {
    requestId: input.requestId ?? randomUUID(),
    roomName: input.roomName ?? `rb-call-${randomUUID().slice(0, 8)}`,
    shop,
    callerPhone: input.callerPhone,
    customer: input.customer ?? null,
    routingRules,
  });
}
