import { checkAvailabilityTool } from '@/src/agent/tools/check-availability';
import { cancelBookingTool } from '@/src/agent/tools/cancel-booking';
import { createBookingTool } from '@/src/agent/tools/create-booking';
import { getShopInfoTool } from '@/src/agent/tools/get-shop-info';
import { rescheduleBookingTool } from '@/src/agent/tools/reschedule-booking';
import { sendBookingLinkTool } from '@/src/agent/tools/send-booking-link';
import { transferToUserTool } from '@/src/agent/tools/transfer-to-user';
import type { AgentToolContext } from '@/src/agent/tools/types';
import type { Shop } from '@/src/backend/domain/types';
import type { BookingsRepository, CallbacksRepository, JobsRepository, ShopsRepository } from '@/src/backend/ports/repositories';
import { logger } from '@/src/backend/observability/logger';
import { getCalendarProvider } from '@/src/backend/services/calendar/types';
import type { TelephonyService } from '@/src/backend/services/telephony/types';

export type SipToolExecutorDeps = {
  shopsRepository: ShopsRepository;
  jobsRepository: JobsRepository;
  bookingsRepository: BookingsRepository;
  callbacksRepository: CallbacksRepository;
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
    telephonyService: params.deps.telephonyService,
  };
}

export async function executeSipShopToolCall(
  ctx: AgentToolContext,
  toolName: string,
  toolInput: unknown,
): Promise<string> {
  try {
    let result: unknown;
    switch (toolName) {
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
      case 'transfer_to_user':
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
