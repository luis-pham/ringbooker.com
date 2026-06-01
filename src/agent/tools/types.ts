import { DateTime } from 'luxon';
import { z } from 'zod';

import type { Shop, TimeSlot, ToolError } from '@/src/backend/domain/types';
import {
  matchServiceFromCallerText,
  normalizeServiceText,
} from '@/src/backend/domain/service-catalog';
import { isWithinBusinessHours } from '@/src/backend/services/calls/business-hours';
import type { BookingActionGuardState } from '@/src/agent/booking/booking-action-guard';
import type { BookingDraft } from '@/src/agent/booking/booking-draft';
import type {
  BillingSubscriptionsRepository,
  BookingsRepository,
  CallbacksRepository,
  CustomersRepository,
  JobsRepository,
  ShopAccessStatesRepository,
  ShopsRepository,
} from '@/src/backend/ports/repositories';
import type { CalendarProvider } from '@/src/backend/services/calendar/types';
import type { TelephonyService } from '@/src/backend/services/telephony/types';

export type AgentToolContext = {
  shop: Shop;
  callerPhone: string;
  requestId: string;
  roomName: string;
  calendarProvider: CalendarProvider;
  jobsRepository: JobsRepository;
  bookingsRepository: BookingsRepository;
  callbacksRepository: CallbacksRepository;
  shopsRepository: ShopsRepository;
  billingSubscriptionsRepository?: BillingSubscriptionsRepository;
  shopAccessStatesRepository?: ShopAccessStatesRepository;
  customersRepository?: CustomersRepository;
  telephonyService: TelephonyService;
  /** Present when inbound used Telnyx Call Control (client_state on SIP). Needed for owner handoff. */
  parentTelnyxCallControlId?: string | null;
  /** Correlation id (matches Call Control `requestId` / rb_call_id). */
  rbCallId?: string;
  /** Optional OpenAI SIP outbound Telnyx leg call_control_id, when available from SIP headers. */
  openAiLegCallControlId?: string | null;
  /** Runtime-only slot accumulator built from caller transcripts. */
  bookingDraft?: BookingDraft;
  /** Runtime-only guard state for sensitive booking/link/handoff/end-call actions. */
  actionGuard?: BookingActionGuardState;
  /** Runtime-only state used to require deterministic time validation before booking decisions. */
  appointmentTimeValidation?: {
    latest: {
      date: string;
      time: string;
      valid: boolean;
      reason: 'within_business_hours' | 'outside_business_hours' | 'business_hours_not_configured' | 'past_datetime';
      normalizedDatetimeUtc: string;
    } | null;
  };
  /** Runtime-only cache used to avoid repeated availability provider calls during one live turn. */
  availabilityCheck?: {
    latest: {
      providerId: string;
      service: string;
      date: string;
      time: string;
      techName?: string;
      available: boolean;
      suggestions?: TimeSlot[];
      message?: string;
      requestedStaffUnavailable?: boolean;
      requestedStaffName?: string | null;
      fallbackStaffName?: string | null;
      resolvedTeamMemberId?: string | null;
      resolvedTeamMemberName?: string | null;
      requestedTeamMemberId?: string | null;
      requestedTeamMemberName?: string | null;
      fallbackTeamMemberId?: string | null;
      fallbackTeamMemberName?: string | null;
      serviceVariationId?: string | null;
      locationId?: string | null;
      raw: unknown;
      fetchedAtMs: number;
      prefetchStartedAtMs?: number;
    } | null;
  };
};

export const dateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
export const timeSchema = z.string().regex(/^\d{2}:\d{2}$/);

export function toToolError(error: string, options?: Partial<ToolError>): ToolError {
  return {
    error,
    code: options?.code ?? 'INTERNAL',
    retryable: options?.retryable,
  };
}

export function findServiceDuration(shop: Shop, serviceName: string): number {
  const resolved = resolveRuntimeService(shop, serviceName);
  if (resolved.ok) return resolved.durationMin;
  return 60;
}

export function resolveRuntimeService(
  shop: Shop,
  serviceName: string,
):
  | { ok: true; serviceName: string; durationMin: number; matchedServiceId?: string | null; matchedServiceConfidence?: number | null }
  | { ok: false; reason: 'unknown_service' | 'service_needs_clarification' | 'service_not_bookable'; message: string } {
  const requested = serviceName.trim();
  if (!requested) {
    return {
      ok: false,
      reason: 'unknown_service',
      message: 'Ask which service the caller wants before checking availability or creating a booking.',
    };
  }
  const requestedTokens = normalizeServiceText(requested);
  const notOffered = (shop.not_offered_services ?? []).find((item) => {
    const normalized = normalizeServiceText(item);
    return normalized.length > 0 && (normalized === requestedTokens || requestedTokens.includes(normalized));
  });
  if (notOffered) {
    return {
      ok: false,
      reason: 'unknown_service',
      message: `The shop has marked "${notOffered}" as not offered. Tell the caller it is not offered and redirect to configured services.`,
    };
  }

  if (shop.service_catalog?.services.length) {
    const match = matchServiceFromCallerText({
      shopServiceCatalog: shop.service_catalog,
      callerText: requested,
      vertical: shop.vertical ?? null,
    });
    if (match.requiresClarification) {
      return {
        ok: false,
        reason: 'service_needs_clarification',
        message: `The caller asked for ${requested}, which matches a service category. Ask which specific service they want before checking availability or creating a booking.`,
      };
    }
    if (!match.matchedServiceId || !match.matchedName || match.confidence < 0.72) {
      return {
        ok: false,
        reason: 'unknown_service',
        message: `The requested service "${requested}" is not clearly listed in the shop's configured services. Do not say it is available. Ask a clarifying question or offer team follow-up.`,
      };
    }
    if (match.bookable === false) {
      return {
        ok: false,
        reason: 'service_not_bookable',
        message: `The requested service "${match.matchedName}" is capture-request-only. Record the request and tell the caller the shop will follow up to confirm.`,
      };
    }
    const service = shop.service_catalog.services.find((item) => item.id === match.matchedServiceId);
    return {
      ok: true,
      serviceName: service?.name ?? match.matchedName,
      durationMin: service?.durationMinutes ?? service?.variants?.find((variant) => typeof variant.durationMinutes === 'number')?.durationMinutes ?? 60,
      matchedServiceId: match.matchedServiceId,
      matchedServiceConfidence: match.confidence,
    };
  }

  const normalized = serviceName.trim().toLowerCase();
  const normalizedTokens = requestedTokens;
  const service = shop.services.find((item) => {
    const itemName = item.name.trim().toLowerCase();
    const itemTokens = normalizeServiceText(item.name);
    return (
      itemName === normalized ||
      itemName.includes(normalized) ||
      normalized.includes(itemName) ||
      itemTokens === normalizedTokens ||
      (itemTokens.length > 0 && normalizedTokens.includes(itemTokens))
    );
  });
  if (!service) {
    return {
      ok: false,
      reason: 'unknown_service',
      message: `The requested service "${requested}" is not clearly listed in the shop's configured services. Do not say it is available. Ask a clarifying question or offer team follow-up.`,
    };
  }
  return {
    ok: true,
    serviceName: service.name,
    durationMin: service.duration_min ?? 60,
    matchedServiceId: null,
    matchedServiceConfidence: null,
  };
}

export function shopLocalToUtcIso(params: { date: string; time: string; timezone: string }): string | null {
  const datetime = DateTime.fromISO(`${params.date}T${params.time}:00`, { zone: params.timezone });
  if (!datetime.isValid) return null;
  return datetime.toUTC().toISO();
}

export function isRequestedAppointmentInsideBusinessHours(
  shop: Pick<Shop, 'hours' | 'timezone'>,
  params: { date: string; time: string },
): boolean | null {
  if (Object.keys(shop.hours ?? {}).length === 0) return null;
  const utcIso = shopLocalToUtcIso({
    date: params.date,
    time: params.time,
    timezone: shop.timezone,
  });
  if (!utcIso) return false;
  return isWithinBusinessHours(shop, new Date(utcIso));
}
