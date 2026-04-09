import { DateTime } from 'luxon';
import { z } from 'zod';

import type { Shop, ToolError } from '@/src/backend/domain/types';
import type { BookingsRepository, CallbacksRepository, JobsRepository, ShopsRepository } from '@/src/backend/ports/repositories';
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
  telephonyService: TelephonyService;
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
  const normalized = serviceName.trim().toLowerCase();
  const service = shop.services.find((item) => item.name.trim().toLowerCase().includes(normalized));
  return service?.duration_min ?? 60;
}

export function shopLocalToUtcIso(params: { date: string; time: string; timezone: string }): string | null {
  const datetime = DateTime.fromISO(`${params.date}T${params.time}:00`, { zone: params.timezone });
  if (!datetime.isValid) return null;
  return datetime.toUTC().toISO();
}
