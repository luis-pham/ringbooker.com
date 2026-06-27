import type { Hono } from 'hono';

import { isCapabilityAllowed } from '@/src/backend/domain/shop-plan-capabilities';
import type {
  BillingSubscriptionsRepository,
  BookingsRepository,
  CallLogListItem,
  CallLogsRepository,
  CommercialAccountsRepository,
  JobsRepository,
  OutboundMessagesRepository,
  ShopAccessStatesRepository,
  ShopActiveCallSessionsRepository,
  ShopsRepository,
} from '@/src/backend/ports/repositories';
import { reminderSourceFromBooking, scheduleBookingFollowupJobs } from '@/src/backend/services/bookings/reminder-scheduling';
import type { CallRecordingStorage } from '@/src/backend/services/calls/call-recording-storage';
import { getBillingPeriodForShop } from '@/src/backend/services/usage/period';
import { getShopUsageForPeriod } from '@/src/backend/services/usage/shop-usage';
import { normalizeShopTimezone } from '@/src/shared/timezone';
import {
  buildUserBookingFilters,
  buildUserCallFilters,
  enforceRateLimit,
  enforceSameOriginForCookieMutation,
  hasViewableTranscript,
  normalizeUserBookingStatus,
  planFeatureLockedJson,
  RATE_LIMIT_POLICIES,
  requireSession,
  shopLocalDateKey,
  shopLocalHour,
  toBasicUserCallResponse,
  toUserBookingResponse,
  toUserCallResponse,
  USER_BOOKINGS_PAGE_SIZE,
  USER_CALLS_PAGE_SIZE,
  userBookingsListQuerySchema,
  userBookingStatsStatuses,
  userBookingStatusPatchSchema,
  userCallsListQuerySchema,
} from '../app-shared';

type UserBookingsCallsDeps = {
  shopsRepository?: ShopsRepository;
  bookingsRepository?: BookingsRepository;
  callLogsRepository?: CallLogsRepository;
  shopAccessStatesRepository?: ShopAccessStatesRepository;
  outboundMessagesRepository?: OutboundMessagesRepository;
  jobsRepository?: JobsRepository;
  commercialAccountsRepository?: CommercialAccountsRepository;
  shopActiveCallSessionsRepository?: ShopActiveCallSessionsRepository;
  billingSubscriptionsRepository?: BillingSubscriptionsRepository;
  recordingStorage?: CallRecordingStorage;
};

export function registerUserBookingsCallsRoutes(
  app: Hono,
  path: (route: string) => string,
  deps: UserBookingsCallsDeps,
) {
  app.patch(path('/user/calls/:requestId/follow-up-done'), async (c) => {
    const csrfBlocked = enforceSameOriginForCookieMutation(c);
    if (csrfBlocked) return csrfBlocked;
    const limited = await enforceRateLimit(c, RATE_LIMIT_POLICIES.user_api, 'user_calls_follow_up_done');
    if (limited) return limited;
    const sessionResult = await requireSession(c, 'user');
    if (sessionResult instanceof Response) return sessionResult;
    if (!deps.callLogsRepository || !deps.shopsRepository) {
      return c.json({ ok: false, error: 'user_dependencies_unavailable' }, 500);
    }

    const shop = await deps.shopsRepository.findById(sessionResult.shopId ?? '');
    if (!shop) return c.json({ ok: false, error: 'shop_not_found' }, 404);

    const requestId = c.req.param('requestId');
    if (!requestId) return c.json({ ok: false, error: 'missing_request_id' }, 400);
    const call = await deps.callLogsRepository.findTranscriptByShopAndRequestId({ shopId: shop.id, requestId });
    if (!call) return c.json({ ok: false, error: 'call_not_found' }, 404);

    await deps.callLogsRepository.updateStructuredSummary(shop.id, requestId, {
      summaryFollowUpRequired: false,
      summaryUrgency: null,
    });

    return c.json({ ok: true });
  });

  app.get(path('/user/bookings'), async (c) => {
    const limited = await enforceRateLimit(c, RATE_LIMIT_POLICIES.user_api, 'user_bookings');
    if (limited) return limited;
    const sessionResult = await requireSession(c, 'user');
    if (sessionResult instanceof Response) return sessionResult;
    if (!deps.bookingsRepository || !deps.shopsRepository) {
      return c.json({ ok: false, error: 'user_dependencies_unavailable' }, 500);
    }

    const parsed = userBookingsListQuerySchema.safeParse({
      page: c.req.query('page'),
      limit: c.req.query('limit'),
      tab: c.req.query('tab'),
      dateFrom: c.req.query('dateFrom'),
      dateTo: c.req.query('dateTo'),
      callId: c.req.query('callId'),
    });
    if (!parsed.success) {
      return c.json({ ok: false, error: 'invalid_query', details: parsed.error.flatten() }, 400);
    }

    const shop = await deps.shopsRepository.findById(sessionResult.shopId ?? '');
    if (!shop) return c.json({ ok: false, error: 'shop_not_found' }, 404);
    const accessState = deps.shopAccessStatesRepository
      ? await deps.shopAccessStatesRepository.findByShopId(shop.id).catch(() => null)
      : null;

    const page = parsed.data.page ?? 1;
    const limit = parsed.data.limit ?? USER_BOOKINGS_PAGE_SIZE;
    const offset = (page - 1) * limit;
    const filters = buildUserBookingFilters(parsed.data);
    const repo = deps.bookingsRepository;
    const [bookings, total, totalAll, awaitingAction, contacted, confirmed, declined, rescheduled, cancellationPending, cancelled, completed] = await Promise.all([
      repo.listByShop(shop.id, { ...filters, limit, offset }),
      repo.countByShop(shop.id, filters),
      repo.countByShop(shop.id),
      repo.countByShop(shop.id, { statuses: userBookingStatsStatuses('awaitingAction') }),
      repo.countByShop(shop.id, { statuses: userBookingStatsStatuses('contacted') }),
      repo.countByShop(shop.id, { statuses: userBookingStatsStatuses('confirmed') }),
      repo.countByShop(shop.id, { statuses: userBookingStatsStatuses('declined') }),
      repo.countByShop(shop.id, { statuses: userBookingStatsStatuses('rescheduled') }),
      repo.countByShop(shop.id, { statuses: userBookingStatsStatuses('cancellationPending') }),
      repo.countByShop(shop.id, { statuses: userBookingStatsStatuses('cancelled') }),
      repo.countByShop(shop.id, { statuses: userBookingStatsStatuses('completed') }),
    ]);
    const linkedCallMeta = deps.callLogsRepository
      ? await deps.callLogsRepository.listTranscriptMetaByShopAndRequestIds({
          shopId: shop.id,
          requestIds: bookings.flatMap((booking) => (booking.callLogId ? [booking.callLogId] : [])),
        }).catch(() => new Map())
      : new Map<string, { callerPhone?: string }>();
    const totalPages = Math.max(1, Math.ceil(total / limit));
    return c.json({
      ok: true,
      bookings: bookings.map((booking) =>
        toUserBookingResponse({
          ...booking,
          customerPhone: (booking.callLogId && linkedCallMeta.get(booking.callLogId)?.callerPhone) || booking.customerPhone,
        }),
      ),
      shop: {
        timezone: shop.timezone,
        liveCallsEnabled: accessState?.liveCallsEnabled ?? false,
        goLiveAt: accessState?.goLiveAt ?? null,
      },
      total,
      stats: {
        total: totalAll,
        awaitingAction,
        contacted,
        confirmed,
        declined,
        rescheduled,
        cancellationPending,
        cancelled,
        completed,
      },
      pagination: { page, limit, total, totalPages },
    });
  });

  app.get(path('/user/bookings/:id'), async (c) => {
    const limited = await enforceRateLimit(c, RATE_LIMIT_POLICIES.user_api, 'user_bookings_detail');
    if (limited) return limited;
    const sessionResult = await requireSession(c, 'user');
    if (sessionResult instanceof Response) return sessionResult;
    if (!deps.bookingsRepository || !deps.shopsRepository) {
      return c.json({ ok: false, error: 'user_dependencies_unavailable' }, 500);
    }

    const shop = await deps.shopsRepository.findById(sessionResult.shopId ?? '');
    if (!shop) return c.json({ ok: false, error: 'shop_not_found' }, 404);

    const id = c.req.param('id') ?? '';
    const booking = await deps.bookingsRepository.findById(id);
    if (!booking || booking.shopId !== shop.id) return c.json({ ok: false, error: 'booking_not_found' }, 404);

    const smsLog = deps.outboundMessagesRepository?.listByBookingId
      ? await deps.outboundMessagesRepository.listByBookingId(booking.id).catch(() => [])
      : [];
    let parentCall: Record<string, unknown> | null = null;
    let displayBooking = booking;
    if (booking.callLogId && deps.callLogsRepository) {
      const call = await deps.callLogsRepository.findTranscriptByShopAndRequestId({ shopId: shop.id, requestId: booking.callLogId }).catch(() => null);
      if (call) {
        displayBooking = call.callerPhone ? { ...booking, customerPhone: call.callerPhone } : booking;
        parentCall = {
          id: booking.callLogId,
          callerPhone: displayBooking.customerPhone,
          startedAt: call.startedAt,
          durationSeconds:
            call.startedAt && call.endedAt
              ? Math.max(0, Math.round((new Date(call.endedAt).getTime() - new Date(call.startedAt).getTime()) / 1000))
              : undefined,
          transcriptAvailable: hasViewableTranscript(call),
        };
      }
    }
    return c.json({ ok: true, booking: { ...toUserBookingResponse(displayBooking, smsLog), parentCall } });
  });

  app.patch(path('/user/bookings/:id'), async (c) => {
    const csrfBlocked = enforceSameOriginForCookieMutation(c);
    if (csrfBlocked) return csrfBlocked;
    const limited = await enforceRateLimit(c, RATE_LIMIT_POLICIES.user_api, 'user_bookings_update');
    if (limited) return limited;
    const sessionResult = await requireSession(c, 'user');
    if (sessionResult instanceof Response) return sessionResult;
    if (!deps.bookingsRepository || !deps.shopsRepository) {
      return c.json({ ok: false, error: 'user_dependencies_unavailable' }, 500);
    }

    const shop = await deps.shopsRepository.findById(sessionResult.shopId ?? '');
    if (!shop) return c.json({ ok: false, error: 'shop_not_found' }, 404);
    const parsed = userBookingStatusPatchSchema.safeParse(await c.req.json().catch(() => ({})));
    if (!parsed.success) return c.json({ ok: false, error: 'invalid_payload', details: parsed.error.flatten() }, 400);

    const id = c.req.param('id') ?? '';
    const booking = await deps.bookingsRepository.findById(id);
    if (!booking || booking.shopId !== shop.id) return c.json({ ok: false, error: 'booking_not_found' }, 404);

    const current = normalizeUserBookingStatus(booking.status, booking.reminder24hSent, booking.reminder2hSent);
    const next = parsed.data.status;
    const allowed =
      ((current === 'captured' || current === 'link_sent') && (next === 'contacted' || next === 'cancelled')) ||
      (current === 'contacted' && (next === 'confirmed' || next === 'declined' || next === 'cancelled')) ||
      ((current === 'confirmed' || current === 'reminder_sent') && (next === 'completed' || next === 'cancelled')) ||
      (current === 'rescheduled' && next === 'confirmed');
    if (!allowed) return c.json({ ok: false, error: 'invalid_status_transition' }, 400);

    const updated = await deps.bookingsRepository.updateStatusByShop(shop.id, id, next);
    if (!updated) return c.json({ ok: false, error: 'booking_not_found' }, 404);
    if (next === 'confirmed' && deps.jobsRepository) {
      await scheduleBookingFollowupJobs({
        jobsRepository: deps.jobsRepository,
        shop,
        booking: updated,
        source: reminderSourceFromBooking(updated),
      });
    }
    return c.json({ ok: true, booking: toUserBookingResponse(updated) });
  });

  app.get(path('/user/calls/summary'), async (c) => {
    const limited = await enforceRateLimit(c, RATE_LIMIT_POLICIES.user_api, 'user_calls_summary');
    if (limited) return limited;
    const sessionResult = await requireSession(c, 'user');
    if (sessionResult instanceof Response) return sessionResult;
    if (!deps.callLogsRepository || !deps.shopsRepository) {
      return c.json({ ok: false, error: 'user_dependencies_unavailable' }, 500);
    }

    const shop = await deps.shopsRepository.findById(sessionResult.shopId ?? '');
    if (!shop) return c.json({ ok: false, error: 'shop_not_found' }, 404);

    const last7Days = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const repo = deps.callLogsRepository;
    const commercialAccount = deps.commercialAccountsRepository ? await deps.commercialAccountsRepository.findByShopId(shop.id).catch(() => null) : null;
    const [totalLast7Days, bookingsCount, followUpCount, missedCount, usage] = await Promise.all([
      repo.countByShop(shop.id, { startedAfter: last7Days }),
      deps.bookingsRepository ? deps.bookingsRepository.countByShop(shop.id) : Promise.resolve(0),
      repo.countByShop(shop.id, { summaryFollowUpRequired: true }),
      repo.countByShop(shop.id, { startedAfter: last7Days, outcome: 'missed' }),
      getShopUsageForPeriod(
        {
          callLogsRepository: repo,
          shopActiveCallSessionsRepository: deps.shopActiveCallSessionsRepository,
          billingSubscriptionsRepository: deps.billingSubscriptionsRepository,
        },
        { shop, commercialAccount },
      ),
    ]);
    return c.json({
      ok: true,
      totalLast7Days,
      bookingsCount,
      followUpCount,
      missedCount,
      usage,
    });
  });

  app.get(path('/user/calls/insights'), async (c) => {
    const limited = await enforceRateLimit(c, RATE_LIMIT_POLICIES.user_api, 'user_calls_insights');
    if (limited) return limited;
    const sessionResult = await requireSession(c, 'user');
    if (sessionResult instanceof Response) return sessionResult;
    if (!deps.callLogsRepository || !deps.shopsRepository) {
      return c.json({ ok: false, error: 'user_dependencies_unavailable' }, 500);
    }

    const shop = await deps.shopsRepository.findById(sessionResult.shopId ?? '');
    if (!shop) return c.json({ ok: false, error: 'shop_not_found' }, 404);
    if (!isCapabilityAllowed(shop.plan, 'call_recovery_insights')) {
      return planFeatureLockedJson(c, 'call_recovery_insights');
    }

    const period = await getBillingPeriodForShop(shop.id, deps, { shopTimezone: shop.timezone });
    const periodCalls: CallLogListItem[] = [];
    const batchSize = 1000;
    for (let offset = 0; ; offset += batchSize) {
      const batch = await deps.callLogsRepository.listByShop(shop.id, {
        startedAfter: period.start,
        startedBefore: period.end,
        limit: batchSize,
        offset,
      });
      periodCalls.push(...batch);
      if (batch.length < batchSize) break;
    }

    const timezone = normalizeShopTimezone(shop.timezone);
    const missed = periodCalls.filter((call) => call.outcome === 'missed');
    const missedByDate = new Map<string, number>();
    for (const call of missed) {
      if (!call.startedAt) continue;
      const date = shopLocalDateKey(call.startedAt, timezone);
      missedByDate.set(date, (missedByDate.get(date) ?? 0) + 1);
    }
    const now = new Date();
    const trend = Array.from({ length: 7 }, (_, index) => {
      const date = shopLocalDateKey(new Date(now.getTime() - (6 - index) * 24 * 60 * 60 * 1000), timezone);
      return { date, count: missedByDate.get(date) ?? 0 };
    });

    const services = new Map<string, { service: string; count: number }>();
    for (const call of periodCalls) {
      const service = call.summaryServiceRequest?.trim();
      if (!service) continue;
      const key = service.toLocaleLowerCase();
      const current = services.get(key);
      services.set(key, { service: current?.service ?? service, count: (current?.count ?? 0) + 1 });
    }
    const totalServiceRequests = [...services.values()].reduce((sum, item) => sum + item.count, 0);
    const topServices = [...services.values()]
      .sort((a, b) => b.count - a.count || a.service.localeCompare(b.service))
      .slice(0, 5)
      .map((item) => ({
        ...item,
        percentage: totalServiceRequests ? Math.round((item.count / totalServiceRequests) * 100) : 0,
      }));

    const callCountsByHour = new Map<number, number>();
    for (const call of periodCalls) {
      if (!call.startedAt) continue;
      const hour = shopLocalHour(call.startedAt, timezone);
      if (hour == null) continue;
      callCountsByHour.set(hour, (callCountsByHour.get(hour) ?? 0) + 1);
    }
    const peakCallTimes = periodCalls.length
      ? Array.from({ length: 24 }, (_, hour) => ({ hour, count: callCountsByHour.get(hour) ?? 0 }))
      : [];

    return c.json({
      ok: true,
      missedOpportunities: {
        percentage: periodCalls.length ? Math.round((missed.length / periodCalls.length) * 100) : 0,
        trend,
      },
      topServices,
      peakCallTimes,
    });
  });

  app.get(path('/user/calls/:id/recording-playback-url'), async (c) => {
    const limited = await enforceRateLimit(c, RATE_LIMIT_POLICIES.user_api, 'user_call_recording_playback');
    if (limited) return limited;
    const sessionResult = await requireSession(c, 'user');
    if (sessionResult instanceof Response) return sessionResult;
    if (!deps.callLogsRepository || !deps.shopsRepository) {
      return c.json({ ok: false, error: 'user_dependencies_unavailable' }, 500);
    }

    const shop = await deps.shopsRepository.findById(sessionResult.shopId ?? '');
    if (!shop) return c.json({ ok: false, error: 'shop_not_found' }, 404);
    if (!isCapabilityAllowed(shop.plan, 'call_recording_playback')) {
      return planFeatureLockedJson(c, 'call_recording_playback');
    }
    if (!deps.recordingStorage) {
      return c.json({ ok: false, error: 'recording_storage_unavailable' }, 503);
    }

    const providerCallId = c.req.param('id') ?? '';
    const call = await deps.callLogsRepository.findByProviderCallId({
      provider: 'telnyx_call_control',
      providerCallId,
    });
    if (!call || call.shopId !== shop.id) return c.json({ ok: false, error: 'call_not_found' }, 404);
    if (call.recordingStatus !== 'available' || !call.recordingStorageKey) {
      return c.json({ ok: false, error: 'recording_not_available' }, 404);
    }

    const expiresInSeconds = 300;
    const url = await deps.recordingStorage.createPlaybackUrl({
      objectKey: call.recordingStorageKey,
      expiresInSeconds,
    });
    return c.json({ ok: true, url, expiresInSeconds });
  });

  /**
   * Proxy endpoint for call recording audio.
   *
   * The <audio> element sets this as its src directly.  The request is
   * same-origin (session cookie auth) so no CORS or CSP issues apply.
   * Range requests from the browser are forwarded to R2 so seeking works.
   *
   * Background: presigned R2 URLs work fine when opened in a new tab
   * (top-level navigation bypasses CORS/CSP), but <audio> elements trigger
   * CORS preflight on range requests, which R2 rejects without a CORS
   * policy configured.  Proxying through the server avoids this entirely.
   */
  app.get(path('/user/calls/:id/recording-audio'), async (c) => {
    const limited = await enforceRateLimit(c, RATE_LIMIT_POLICIES.user_api, 'user_call_recording_playback');
    if (limited) return new Response('Too Many Requests', { status: 429 });
    const sessionResult = await requireSession(c, 'user');
    if (sessionResult instanceof Response) return sessionResult;
    if (!deps.callLogsRepository || !deps.shopsRepository) {
      return new Response('Service unavailable', { status: 503 });
    }

    const shop = await deps.shopsRepository.findById(sessionResult.shopId ?? '');
    if (!shop) return new Response('Not found', { status: 404 });
    if (!isCapabilityAllowed(shop.plan, 'call_recording_playback')) {
      return new Response('Plan feature locked', { status: 403 });
    }
    if (!deps.recordingStorage) {
      return new Response('Recording storage unavailable', { status: 503 });
    }

    const providerCallId = c.req.param('id') ?? '';
    const call = await deps.callLogsRepository.findByProviderCallId({
      provider: 'telnyx_call_control',
      providerCallId,
    });
    if (!call || call.shopId !== shop.id) return new Response('Not found', { status: 404 });
    if (call.recordingStatus !== 'available' || !call.recordingStorageKey) {
      return new Response('Recording not available', { status: 404 });
    }

    // Generate a short-lived presigned URL for the server-side fetch only.
    const presignedUrl = await deps.recordingStorage.createPlaybackUrl({
      objectKey: call.recordingStorageKey,
      expiresInSeconds: 60,
    });

    // Forward Range header so the browser can seek inside the audio player.
    const rangeHeader = c.req.header('Range');
    const upstreamHeaders: Record<string, string> = {};
    if (rangeHeader) upstreamHeaders['Range'] = rangeHeader;

    let r2Response: Response;
    try {
      r2Response = await fetch(presignedUrl, {
        headers: upstreamHeaders,
        signal: AbortSignal.timeout(30_000),
      });
    } catch {
      return new Response('Recording fetch failed', { status: 502 });
    }

    if (!r2Response.ok && r2Response.status !== 206) {
      return new Response('Recording fetch failed', { status: 502 });
    }

    // Forward only the headers the browser needs for media playback.
    const outHeaders = new Headers();
    for (const name of ['Content-Type', 'Content-Length', 'Content-Range', 'Accept-Ranges', 'ETag', 'Last-Modified']) {
      const val = r2Response.headers.get(name);
      if (val) outHeaders.set(name, val);
    }
    // Ensure the browser renders it as inline audio, never a download.
    outHeaders.set('Content-Disposition', 'inline');
    // Allow short-term browser caching so rapid seeks don't re-hit the server.
    outHeaders.set('Cache-Control', 'private, max-age=60');

    return new Response(r2Response.body, {
      status: r2Response.status,
      headers: outHeaders,
    });
  });

  app.get(path('/user/calls/:id'), async (c) => {
    const limited = await enforceRateLimit(c, RATE_LIMIT_POLICIES.user_api, 'user_calls_detail');
    if (limited) return limited;
    const sessionResult = await requireSession(c, 'user');
    if (sessionResult instanceof Response) return sessionResult;
    if (!deps.callLogsRepository || !deps.shopsRepository) {
      return c.json({ ok: false, error: 'user_dependencies_unavailable' }, 500);
    }

    const shop = await deps.shopsRepository.findById(sessionResult.shopId ?? '');
    if (!shop) return c.json({ ok: false, error: 'shop_not_found' }, 404);

    await deps.callLogsRepository.resolveStaleInProgressByShop(shop.id, new Date(Date.now() - 30 * 60 * 1000)).catch(() => 0);
    const id = c.req.param('id');
    const recent = await deps.callLogsRepository.listByShop(shop.id, { limit: 500 });
    const call = recent.find((item) => item.requestId === id || item.providerCallId === id);
    if (!call) return c.json({ ok: false, error: 'call_not_found' }, 404);
    const canUseAdvancedCallAnalytics = isCapabilityAllowed(shop.plan, 'advanced_call_analytics');
    const canPlayCallRecording = isCapabilityAllowed(shop.plan, 'call_recording_playback');
    const linkedBooking = deps.bookingsRepository && call.requestId
      ? (await deps.bookingsRepository.listByShop(shop.id, { callLogId: call.requestId, limit: 1 }))[0] ?? null
      : null;
    const detailedCall = toUserCallResponse(call, {}, linkedBooking);
    return c.json({
      ok: true,
      call: canUseAdvancedCallAnalytics
        ? canPlayCallRecording
          ? detailedCall
          : { ...detailedCall, recordingAvailable: undefined, recordingStatus: undefined }
        : toBasicUserCallResponse(call, {}, { includeTranscriptText: true }),
      shop: { timezone: shop.timezone },
    });
  });

  app.get(path('/user/calls'), async (c) => {
    const limited = await enforceRateLimit(c, RATE_LIMIT_POLICIES.user_api, 'user_calls');
    if (limited) return limited;
    const sessionResult = await requireSession(c, 'user');
    if (sessionResult instanceof Response) return sessionResult;
    if (!deps.callLogsRepository || !deps.shopsRepository) {
      return c.json({ ok: false, error: 'user_dependencies_unavailable' }, 500);
    }

    const parsed = userCallsListQuerySchema.safeParse({
      page: c.req.query('page'),
      limit: c.req.query('limit'),
      tab: c.req.query('tab'),
      filter: c.req.query('filter'),
      from: c.req.query('from'),
      to: c.req.query('to'),
      dateFrom: c.req.query('dateFrom'),
      dateTo: c.req.query('dateTo'),
    });
    if (!parsed.success) {
      return c.json({ ok: false, error: 'invalid_query', details: parsed.error.flatten() }, 400);
    }

    const shop = await deps.shopsRepository.findById(sessionResult.shopId ?? '');
    if (!shop) return c.json({ ok: false, error: 'shop_not_found' }, 404);
    const accessState = deps.shopAccessStatesRepository
      ? await deps.shopAccessStatesRepository.findByShopId(shop.id).catch(() => null)
      : null;

    const repo = deps.callLogsRepository;
    await repo.resolveStaleInProgressByShop(shop.id, new Date(Date.now() - 30 * 60 * 1000)).catch(() => 0);

    const page = parsed.data.page ?? 1;
    const limit = parsed.data.limit ?? USER_CALLS_PAGE_SIZE;
    const offset = (page - 1) * limit;
    const filters = buildUserCallFilters(parsed.data);
    const last7Days = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const canUseAdvancedCallAnalytics = isCapabilityAllowed(shop.plan, 'advanced_call_analytics');
    const canPlayCallRecording = isCapabilityAllowed(shop.plan, 'call_recording_playback');

    const [calls, total, totalAll, last7DaysCount, missed] = await Promise.all([
      repo.listByShop(shop.id, { ...filters, limit, offset }),
      repo.countByShop(shop.id, filters),
      repo.countByShop(shop.id),
      repo.countByShop(shop.id, { startedAfter: last7Days }),
      repo.countByShop(shop.id, { outcome: 'missed' }),
    ]);
    const advancedStats = canUseAdvancedCallAnalytics
      ? await Promise.all([
          deps.bookingsRepository ? deps.bookingsRepository.countByShop(shop.id) : Promise.resolve(0),
          repo.countByShop(shop.id, { summaryFollowUpRequired: true }),
          repo.countByShop(shop.id, { summaryUrgency: 'high' }),
          repo.countByShop(shop.id, { ...filters, transcriptStatus: 'completed' }),
        ])
      : null;
    const [bookings, followUp, highUrgency, transcriptsReady] = advancedStats ?? [0, 0, 0, 0];
    const totalPages = Math.max(1, Math.ceil(total / limit));

    const missedPhones = calls
      .filter((c) => c.outcome === 'missed' && c.callerPhone)
      .map((c) => c.callerPhone as string);
    const missedSmsSentPhones = missedPhones.length > 0 && deps.outboundMessagesRepository?.listMissedCallSmsSentPhones
      ? await deps.outboundMessagesRepository.listMissedCallSmsSentPhones(shop.id, missedPhones)
      : new Set<string>();
    const linkedBookingEntries = canUseAdvancedCallAnalytics && deps.bookingsRepository
      ? await Promise.all(
          calls.map(async (call) => [
            call.requestId ?? '',
            call.requestId ? (await deps.bookingsRepository!.listByShop(shop.id, { callLogId: call.requestId, limit: 1 }))[0] ?? null : null,
          ] as const),
        )
      : [];
    const linkedBookingsByRequestId = new Map(linkedBookingEntries);

    return c.json({
      ok: true,
      calls: calls.map((call) => {
        const extras = { missedFollowupSmsSent: missedSmsSentPhones.has(call.callerPhone ?? '') };
        if (!canUseAdvancedCallAnalytics) return toBasicUserCallResponse(call, extras);
        const advancedCall = toUserCallResponse(call, extras, linkedBookingsByRequestId.get(call.requestId ?? '') ?? null);
        return canPlayCallRecording
          ? advancedCall
          : { ...advancedCall, recordingAvailable: undefined, recordingStatus: undefined };
      }),
      shop: {
        timezone: shop.timezone,
        liveCallsEnabled: accessState?.liveCallsEnabled ?? false,
        goLiveAt: accessState?.goLiveAt ?? null,
      },
      total,
      stats: canUseAdvancedCallAnalytics
        ? { total: totalAll, last7Days: last7DaysCount, bookings, followUp, missed, highUrgency }
        : { total: totalAll, last7Days: last7DaysCount, missed },
      capabilities: { call_recovery_insights: isCapabilityAllowed(shop.plan, 'call_recovery_insights') },
      pagination: { page, limit, pageSize: limit, total, totalPages },
      ...(canUseAdvancedCallAnalytics ? { summary: { total, booked: bookings, missed, transcriptsReady } } : {}),
    });
  });
}
