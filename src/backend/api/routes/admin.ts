import type { Hono } from 'hono';
import {
  ADMIN_CALL_CHART_SAMPLE,
  ADMIN_CALL_LIST_PAGE_SIZE,
  ADMIN_DEMO_LIST_PAGE_SIZE,
  ADMIN_SMS_LIST_PAGE_SIZE,
  ADMIN_WEB_DEMO_MERGE_CAP,
  adminCallsListQuerySchema,
  adminCommercialAccountSchema,
  adminCommercialGoLiveApprovalSchema,
  adminCreateShopSchema,
  adminDashboardChartMetricSchema,
  adminDashboardChartPeriodSchema,
  adminDemoCallsListQuerySchema,
  adminInviteSchema,
  adminLeadStatusUpdateSchema,
  adminLeadsListQuerySchema,
  adminShopAnalyticsQuerySchema,
  adminShopCallsQuerySchema,
  adminShopDynamicConfigSchema,
  adminShopLocationSchema,
  adminShopRoutingRuleSchema,
  adminShopSettingsUpdateSchema,
  adminSmsListQuerySchema,
  adminUpdatePlanSchema,
  adminUserPatchSchema,
  adminUserSetPasswordSchema,
  adminVerifyForwardingSchema,
  adminWebDemosListQuerySchema,
  buildAdminCallChartDaily,
  enforceRateLimit,
  enforceRateLimitWithIdentity,
  enforceSameOriginForCookieMutation,
  requireSession,
  securityAudit,
  getClientIp,
  RATE_LIMIT_POLICIES,
  getMetricsSnapshot,
  collectEmailLifecycleDiagnostics,
  buildAdminShopStatus,
  buildAdminTrialEndingSoonWatchlist,
  getShopUsageForPeriod,
  getBillingPeriodForShop,
  buildAdminDemoCallsListResult,
  counterMetricTotal,
  demoCallDurationSeconds,
  durationMetricAggregate,
  effectiveDemoClientCountry,
  escapeHtml,
  fetchPaddleGrossCollected,
  formatWebDemoTranscriptForAdmin,
  hashPassword,
  hashPasswordResetToken,
  liveKitDemoRunToWebAdminStatus,
  normalizePhone,
  parseAdminResourceUuid,
  parseAdminShopIdParam,
  parseAdminUuidParam,
  toAdminFacingShop,
  stripSensitiveShopFields,
  timingSafeStringEqual,
  getEnv,
  unifiedWebDemoRowMatchesFilters,
} from '../app-shared';
import { logger } from '@/src/backend/observability/logger';
import { randomBytes, randomUUID } from 'node:crypto';
import type {
  ShopsRepository,
  CallLogsRepository,
  BookingsRepository,
  BlogPostsRepository,
  ContactRequestsRepository,
  DemoSessionsRepository,
  AuthUsersRepository,
  BillingCustomersRepository,
  BillingSubscriptionsRepository,
  ShopOverageChargesRepository,
  ShopUsageAlertsRepository,
  BillingNotificationsRepository,
  ShopAccessStatesRepository,
  CommercialGoLiveApprovalEventsRepository,
  ShopLocationsRepository,
  ShopRoutingRulesRepository,
  CommercialAccountsRepository,
  ShopActiveCallSessionsRepository,
  TestCallAttemptsRepository,
  ForwardingTestSessionsRepository,
  CallbacksRepository,
  CustomersRepository,
  OutboundMessagesRepository,
  SmsMessagesRepository,
  HandoffSessionsRepository,
  VoiceCallLegsRepository,
  MissedCallsRepository,
  ShopStaffRepository,
  ShopStaffServicesRepository,
  JobsRepository,
} from '@/src/backend/ports/repositories';
import type { WebDemoSessionAdminRecord, WebDemoSessionStatus, WebDemoSessionsRepository } from '@/src/backend/ports/web-demo-sessions';
import type { SalesPreparedDemosRepository } from '@/src/backend/ports/sales-prepared-demos';
import type { EmailService } from '@/src/backend/services/email/types';
import type { BillingProviderAdapter } from '@/src/backend/services/billing/types';
import type { DashboardChartPeriod } from '@/src/backend/services/admin-dashboard-chart-series';
import { getChartRangeSpec, aggregateIntoBuckets } from '@/src/backend/services/admin-dashboard-chart-series';
import type {
  Shop,
  BillingSubscription,
  BillingSubscriptionStatus,
  ShopAccessState,
  ContactRequestStatus,
} from '@/src/backend/domain/types';
import type { AdminTrialEndingSoonItem } from '@/src/backend/services/admin/admin-dashboard-trial-watchlist';
import {
  getAllowedSmsInboxNumbers,
  normalizeSmsInboxPhoneNumber,
} from '@/src/backend/services/sms/sms-inbox-allowlist';

type AdminDeps = {
  jobsRepository?: JobsRepository;
  shopsRepository?: ShopsRepository;
  callLogsRepository?: CallLogsRepository;
  bookingsRepository?: BookingsRepository;
  blogPostsRepository?: BlogPostsRepository;
  contactRequestsRepository?: ContactRequestsRepository;
  demoSessionsRepository?: DemoSessionsRepository;
  webDemoSessionsRepository?: WebDemoSessionsRepository;
  salesPreparedDemosRepository?: SalesPreparedDemosRepository;
  authUsersRepository?: AuthUsersRepository;
  billingCustomersRepository?: BillingCustomersRepository;
  billingSubscriptionsRepository?: BillingSubscriptionsRepository;
  shopOverageChargesRepository?: ShopOverageChargesRepository;
  shopUsageAlertsRepository?: ShopUsageAlertsRepository;
  billingNotificationsRepository?: BillingNotificationsRepository;
  shopAccessStatesRepository?: ShopAccessStatesRepository;
  commercialGoLiveApprovalEventsRepository?: CommercialGoLiveApprovalEventsRepository;
  shopLocationsRepository?: ShopLocationsRepository;
  shopRoutingRulesRepository?: ShopRoutingRulesRepository;
  commercialAccountsRepository?: CommercialAccountsRepository;
  shopActiveCallSessionsRepository?: ShopActiveCallSessionsRepository;
  testCallAttemptsRepository?: TestCallAttemptsRepository;
  forwardingTestSessionsRepository?: ForwardingTestSessionsRepository;
  callbacksRepository?: CallbacksRepository;
  customersRepository?: CustomersRepository;
  outboundMessagesRepository?: OutboundMessagesRepository;
  smsMessagesRepository?: SmsMessagesRepository;
  handoffSessionsRepository?: HandoffSessionsRepository;
  voiceCallLegsRepository?: VoiceCallLegsRepository;
  missedCallsRepository?: MissedCallsRepository;
  shopStaffRepository?: ShopStaffRepository;
  shopStaffServicesRepository?: ShopStaffServicesRepository;
  emailService?: EmailService;
  billingProvider?: BillingProviderAdapter;
};

export function registerAdminRoutes(app: Hono, path: (route: string) => string, deps: AdminDeps): void {
  app.get(path('/admin/system-health/metrics'), async (c) => {
    const limited = await enforceRateLimit(c, RATE_LIMIT_POLICIES.admin_api, 'admin_system_health_metrics');
    if (limited) return limited;
    const sessionResult = await requireSession(c, 'admin');
    if (sessionResult instanceof Response) return sessionResult;
    if (!deps.jobsRepository) {
      return c.json({ ok: false, error: 'admin_dependencies_unavailable' }, 500);
    }

    const snapshot = getMetricsSnapshot();
    const jobStatus = await deps.jobsRepository.getStatusCounts();
    const emailDiagnostics = await collectEmailLifecycleDiagnostics({
      jobsRepository: deps.jobsRepository,
      billingNotificationsRepository: deps.billingNotificationsRepository,
    });
    const responseLatency = durationMetricAggregate(snapshot, 'realtime_response_latency_ms');
    const queueLatency = durationMetricAggregate(snapshot, 'realtime_audio_queue_latency_ms');
    const jitter = durationMetricAggregate(snapshot, 'realtime_audio_jitter_ms');
    const toolcallDuration = durationMetricAggregate(snapshot, 'toolcall_duration_ms');

    return c.json({
      ok: true,
      generatedAt: snapshot.generatedAt,
      realtime: {
        responseLatencyMs: responseLatency,
        queueLatencyMs: queueLatency,
        jitterMs: jitter,
      },
      toolcalls: {
        total: counterMetricTotal(snapshot, 'toolcall_total'),
        queueFailed: counterMetricTotal(snapshot, 'toolcall_queue_failed_total'),
        durationMs: toolcallDuration,
      },
      webhooks: {
        total: counterMetricTotal(snapshot, 'webhook_requests_total'),
        processed: counterMetricTotal(snapshot, 'webhook_requests_total', { outcome: 'processed' }),
        duplicate: counterMetricTotal(snapshot, 'webhook_requests_total', { outcome: 'duplicate' }),
        invalidSignature: counterMetricTotal(snapshot, 'webhook_signature_invalid_total'),
        failed: counterMetricTotal(snapshot, 'webhook_requests_total', { outcome: 'failed' }),
      },
      jobs: {
        queued: jobStatus.queued ?? 0,
        running: jobStatus.running ?? 0,
        leased: jobStatus.leased ?? 0,
        completed: counterMetricTotal(snapshot, 'jobs_completed_total'),
        failed: counterMetricTotal(snapshot, 'jobs_failed_total'),
        deadLetter: counterMetricTotal(snapshot, 'jobs_dead_letter_total'),
      },
      apiStatus: {
        status401: counterMetricTotal(snapshot, 'api_requests_total', { status: '401' }),
        status403: counterMetricTotal(snapshot, 'api_requests_total', { status: '403' }),
        status429: counterMetricTotal(snapshot, 'api_requests_total', { status: '429' }),
        status5xx:
          counterMetricTotal(snapshot, 'api_requests_total', { status: '500' }) +
          counterMetricTotal(snapshot, 'api_requests_total', { status: '502' }) +
          counterMetricTotal(snapshot, 'api_requests_total', { status: '503' }) +
          counterMetricTotal(snapshot, 'api_requests_total', { status: '504' }),
      },
      email: emailDiagnostics,
    });
  });

  app.get(path('/admin/dashboard'), async (c) => {
    const limited = await enforceRateLimit(c, RATE_LIMIT_POLICIES.admin_api, 'admin_dashboard');
    if (limited) return limited;
    const sessionResult = await requireSession(c, 'admin');
    if (sessionResult instanceof Response) return sessionResult;
    if (!deps.shopsRepository || !deps.callLogsRepository) {
      return c.json({ ok: false, error: 'admin_dependencies_unavailable' }, 500);
    }

    const [shops, calls] = await Promise.all([
      deps.shopsRepository.list({ limit: 300 }),
      deps.callLogsRepository.listRecent({ limit: 200 }),
    ]);

    let trialEndingSoon: AdminTrialEndingSoonItem[] = [];
    if (deps.billingSubscriptionsRepository) {
      const shopIds = shops.map((shop) => shop.id);
      const subsByShop = await deps.billingSubscriptionsRepository.findCurrentByShopIds(shopIds);
      trialEndingSoon = buildAdminTrialEndingSoonWatchlist(shops, subsByShop, new Date());
    }

    return c.json({
      ok: true,
      metrics: {
        shopCount: shops.length,
        activeShops: shops.filter((shop) => shop.active).length,
        callCount: calls.length,
        missedCalls: calls.filter((item) => item.outcome === 'missed').length,
      },
      trialEndingSoon,
    });
  });

  app.get(path('/admin/dashboard/charts/:metric'), async (c) => {
    const limited = await enforceRateLimit(c, RATE_LIMIT_POLICIES.admin_chart_query, 'admin_dashboard_chart_metric');
    if (limited) return limited;
    const sessionResult = await requireSession(c, 'admin');
    if (sessionResult instanceof Response) return sessionResult;

    const metricParsed = adminDashboardChartMetricSchema.safeParse(c.req.param('metric'));
    if (!metricParsed.success) {
      return c.json({ ok: false, error: 'invalid_metric' }, 400);
    }
    const metric = metricParsed.data;

    const periodParsed = adminDashboardChartPeriodSchema.safeParse(c.req.query('period') ?? 'week');
    const period: DashboardChartPeriod = periodParsed.success ? periodParsed.data : 'week';
    const now = new Date();
    const spec = getChartRangeSpec(period, now);
    const pageSize = 2500;

    let timestamps: string[] = [];
    let repositoryAvailable = true;

    if (metric === 'calls') {
      if (!deps.callLogsRepository) {
        return c.json({ ok: false, error: 'admin_dependencies_unavailable' }, 500);
      }
      let offset = 0;
      for (;;) {
        const batch = await deps.callLogsRepository.listRecent({
          startedAfter: spec.from,
          startedBefore: spec.to,
          limit: pageSize,
          offset,
        });
        for (const row of batch) {
          if (row.startedAt) timestamps.push(row.startedAt);
        }
        if (batch.length < pageSize) break;
        offset += pageSize;
        if (offset > 250_000) break;
      }
    } else if (metric === 'demo-calls') {
      if (!deps.demoSessionsRepository) {
        repositoryAvailable = false;
      } else {
        let offset = 0;
        for (;;) {
          const batch = await deps.demoSessionsRepository.listAdminDemoCallRuns({
            createdAfter: spec.from,
            createdBefore: spec.to,
            limit: pageSize,
            offset,
          });
          for (const row of batch) {
            timestamps.push(row.runCreatedAt);
          }
          if (batch.length < pageSize) break;
          offset += pageSize;
        }
      }
    } else if (metric === 'leads') {
      if (!deps.contactRequestsRepository) {
        repositoryAvailable = false;
      } else {
        const rows = await deps.contactRequestsRepository.listForAdmin({
          createdAfter: spec.from,
          createdBefore: spec.to,
          status: 'all',
          limit: 10_000,
        });
        timestamps = rows.map((r) => r.createdAt).filter((x): x is string => Boolean(x));
      }
    } else if (metric === 'shops') {
      if (!deps.shopsRepository) {
        return c.json({ ok: false, error: 'admin_dependencies_unavailable' }, 500);
      }
      timestamps = await deps.shopsRepository.listCreatedAtInRange({
        createdAfter: spec.from,
        createdBefore: spec.to,
      });
    } else if (metric === 'web-demos') {
      if (!deps.webDemoSessionsRepository) {
        repositoryAvailable = false;
      } else {
        let offset = 0;
        for (;;) {
          const batch = await deps.webDemoSessionsRepository.listForAdmin({
            startedAfter: spec.from,
            startedBefore: spec.to,
            limit: pageSize,
            offset,
          });
          for (const row of batch) {
            if (row.status !== 'rate_limited') timestamps.push(row.startedAt);
          }
          if (batch.length < pageSize) break;
          offset += pageSize;
          if (offset > 250_000) break;
        }
      }
    }

    const values = aggregateIntoBuckets(spec.labels, timestamps, spec.bucketOf);

    return c.json({
      ok: true,
      metric,
      period,
      from: spec.from.toISOString(),
      to: spec.to.toISOString(),
      labels: spec.labels,
      labelTitles: spec.labelTitles,
      values,
      repositoryAvailable,
    });
  });

  app.get(path('/admin/dashboard/demo-health'), async (c) => {
    const limited = await enforceRateLimit(c, RATE_LIMIT_POLICIES.admin_api, 'admin_demo_health');
    if (limited) return limited;
    const sessionResult = await requireSession(c, 'admin');
    if (sessionResult instanceof Response) return sessionResult;

    if (!deps.webDemoSessionsRepository) {
      return c.json({ ok: false, error: 'admin_dependencies_unavailable' }, 500);
    }

    const now = new Date();
    const todayFrom = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
    const weekFrom = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    const [todayRows, weekRows] = await Promise.all([
      deps.webDemoSessionsRepository.listForAdmin({ startedAfter: todayFrom, startedBefore: now, limit: 5000, offset: 0 }),
      deps.webDemoSessionsRepository.listForAdmin({ startedAfter: weekFrom, startedBefore: now, limit: 10000, offset: 0 }),
    ]);

    function countByStatus(rows: WebDemoSessionAdminRecord[]) {
      const counts = { started: 0, connected: 0, completed: 0, failed: 0, timed_out: 0, rate_limited: 0 };
      for (const row of rows) {
        const key = row.status as keyof typeof counts;
        if (key in counts) counts[key]++;
      }
      return counts;
    }

    const todayCounts = countByStatus(todayRows);
    const weekCounts = countByStatus(weekRows);

    const weekNonRateLimited = weekCounts.started + weekCounts.connected + weekCounts.completed + weekCounts.failed + weekCounts.timed_out;
    const weekCompletionRatePct = weekNonRateLimited > 0
      ? Math.round((weekCounts.completed / weekNonRateLimited) * 100)
      : null;

    const durationsWeek = weekRows.filter((r) => r.durationSeconds !== null).map((r) => r.durationSeconds as number);
    const weekAvgDurationSecs = durationsWeek.length > 0
      ? Math.round(durationsWeek.reduce((a, b) => a + b, 0) / durationsWeek.length)
      : null;

    const verticalCounts = new Map<string, number>();
    for (const row of weekRows) {
      if (row.status === 'rate_limited') continue;
      const slug = row.verticalSlug ?? 'unknown';
      verticalCounts.set(slug, (verticalCounts.get(slug) ?? 0) + 1);
    }
    const byVertical = [...verticalCounts.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([slug, count]) => ({ slug, count }));

    return c.json({
      ok: true,
      today: {
        started: todayCounts.started + todayCounts.connected,
        completed: todayCounts.completed,
        failed: todayCounts.failed,
        timedOut: todayCounts.timed_out,
        rateLimited: todayCounts.rate_limited,
      },
      week: {
        total: weekNonRateLimited,
        completed: weekCounts.completed,
        failed: weekCounts.failed,
        timedOut: weekCounts.timed_out,
        rateLimited: weekCounts.rate_limited,
        completionRatePct: weekCompletionRatePct,
        avgDurationSecs: weekAvgDurationSecs,
        byVertical,
      },
    });
  });

  app.get(path('/admin/shops'), async (c) => {
    const limited = await enforceRateLimit(c, RATE_LIMIT_POLICIES.admin_api, 'admin_shops');
    if (limited) return limited;
    const sessionResult = await requireSession(c, 'admin');
    if (sessionResult instanceof Response) return sessionResult;
    if (!deps.shopsRepository) {
      return c.json({ ok: false, error: 'admin_dependencies_unavailable' }, 500);
    }
    const shops = await deps.shopsRepository.list({ limit: 300 });
    const shopIds = shops.map((shop) => shop.id);
    const sinceTestCalls = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

    const [subsByShop, accessByShop, testCountsByShop] = await Promise.all([
      deps.billingSubscriptionsRepository
        ? deps.billingSubscriptionsRepository.findCurrentByShopIds(shopIds)
        : Promise.resolve(new Map<string, BillingSubscription | null>()),
      deps.shopAccessStatesRepository
        ? deps.shopAccessStatesRepository.findByShopIds(shopIds)
        : Promise.resolve(new Map<string, ShopAccessState | null>()),
      deps.testCallAttemptsRepository
        ? deps.testCallAttemptsRepository.countRecentByShopIds({
            shopIds,
            since: sinceTestCalls,
            type: 'outbound_call_me',
          })
        : Promise.resolve(new Map<string, number>()),
    ]);

    const calls = deps.callLogsRepository ? await deps.callLogsRepository.listRecent({ limit: 500 }) : [];
    const callsByShop = new Map<
      string,
      {
        totalCalls: number;
        latestCallAt?: string;
        latestOutcome?: string;
      }
    >();
    for (const call of calls) {
      const current = callsByShop.get(call.shopId) ?? { totalCalls: 0 };
      current.totalCalls += 1;
      if (!current.latestCallAt || (call.startedAt && call.startedAt > current.latestCallAt)) {
        current.latestCallAt = call.startedAt;
        current.latestOutcome = call.outcome;
      }
      callsByShop.set(call.shopId, current);
    }
    return c.json({
      ok: true,
      shops: shops.map((shop) => ({
        ...toAdminFacingShop(shop),
        totalCalls: callsByShop.get(shop.id)?.totalCalls ?? 0,
        latestCallAt: callsByShop.get(shop.id)?.latestCallAt,
        latestCallOutcome: callsByShop.get(shop.id)?.latestOutcome,
        adminStatus: buildAdminShopStatus({
          shop,
          subscription: subsByShop.get(shop.id) ?? null,
          accessState: accessByShop.get(shop.id) ?? null,
          testCallsUsed: testCountsByShop.get(shop.id) ?? 0,
        }),
      })),
    });
  });

  app.get(path('/admin/billing'), async (c) => {
    const limited = await enforceRateLimit(c, RATE_LIMIT_POLICIES.admin_api, 'admin_billing_get');
    if (limited) return limited;
    const sessionResult = await requireSession(c, 'admin');
    if (sessionResult instanceof Response) return sessionResult;
    if (!deps.billingSubscriptionsRepository || !deps.shopsRepository) {
      return c.json({ ok: false, error: 'billing_dependencies_unavailable' }, 500);
    }

    try {
      // FIX 1 — MRR: paying subscribers only (exclude trialing — $0 collected)
      const payingStatus = new Set<BillingSubscriptionStatus>(['active']);

      // Fetch subscriptions, shops, and charged overage records in parallel.
      // Paddle gross is fetched separately (cached, may be slow on first load).
      const [subscriptions, shops, chargedOverages] = await Promise.all([
        deps.billingSubscriptionsRepository.list({ limit: 500 }),
        deps.shopsRepository.list({ limit: 500 }),
        // FIX 2 — Overage: sum status='charged' rows across all shops
        deps.shopOverageChargesRepository
          ? deps.shopOverageChargesRepository.listCharged({ limit: 2000 }).catch((err: unknown) => {
              logger.warn({ err }, 'admin_billing_overage_charges_fetch_failed');
              return [];
            })
          : Promise.resolve([]),
      ]);

      const shopNameById = new Map(shops.map((shop) => [shop.id, shop.name]));

      // FIX 1 — MRR: active-only (paying) subscriptions
      const payingSubscriptions = subscriptions.filter((s) => payingStatus.has(s.status));
      const trialingSubscriptions = subscriptions.filter((s) => s.status === 'trialing');
      const mrr = Number(
        payingSubscriptions
          .reduce((sum, s) => sum + (s.interval === 'year' ? s.amount / 12 : s.amount), 0)
          .toFixed(2),
      );

      // FIX 2 — Overage revenue: sum all charged overages (amount_cents / 100)
      const overageRevenueCents = chargedOverages.reduce((sum, c) => sum + c.amountCents, 0);
      const overageRevenue = Number((overageRevenueCents / 100).toFixed(2));

      // FIX 3 — Gross collected from Paddle (paginated, 5-min cached)
      const paddleGross = await fetchPaddleGrossCollected();

      return c.json({
        ok: true,
        metrics: {
          subscriptionCount: subscriptions.length,
          // FIX 4 — separate paying vs trialing counts
          payingSubscriptions: payingSubscriptions.length,
          trialingSubscriptions: trialingSubscriptions.length,
          pastDueSubscriptions: subscriptions.filter((s) => s.status === 'past_due').length,
          // FIX 1 — MRR: paying only
          mrr,
          // FIX 2 — Overage revenue: confirmed charged records from DB
          overageRevenue,
          // DB-based total: MRR (paying subscriptions) + confirmed overage charges
          totalCollectedDb: Number((mrr + overageRevenue).toFixed(2)),
          // FIX 3 — Gross collected from Paddle transactions API (null if not configured)
          grossCollectedPaddle: paddleGross?.value ?? null,
          grossCollectedPaddleCachedAt: paddleGross?.cachedAt ?? null,
        },
        subscriptions: subscriptions.map((subscription) => ({
          ...subscription,
          shopName: shopNameById.get(subscription.shopId) ?? 'Unknown shop',
        })),
      });
    } catch (err) {
      logger.error({ err }, 'admin_billing_fetch_failed');
      return c.json({ ok: false, error: 'billing_fetch_failed' }, 500);
    }
  });

  app.post(path('/admin/shops'), async (c) => {
    const csrfBlocked = enforceSameOriginForCookieMutation(c);
    if (csrfBlocked) return csrfBlocked;
    const limited = await enforceRateLimit(c, RATE_LIMIT_POLICIES.admin_mutation, 'admin_create_shop');
    if (limited) return limited;
    const sessionResult = await requireSession(c, 'admin');
    if (sessionResult instanceof Response) return sessionResult;
    if (!deps.shopsRepository) {
      return c.json({ ok: false, error: 'admin_dependencies_unavailable' }, 500);
    }

    const body = await c.req.json().catch(() => null);
    const parsed = adminCreateShopSchema.safeParse(body);
    if (!parsed.success) return c.json({ ok: false, error: 'invalid_payload' }, 400);

    const created = await deps.shopsRepository.create(parsed.data);
    securityAudit({
      action: 'admin_shop_created',
      actorType: 'admin',
      actorId: sessionResult.email,
      ip: getClientIp({ get: (name: string) => c.req.header(name) ?? null }),
      path: c.req.path,
      details: {
        shopId: created.id,
      },
    });
    return c.json({ ok: true, shop: toAdminFacingShop(created) }, 201);
  });

  app.get(path('/admin/shops/:id/calls'), async (c) => {
    const limited = await enforceRateLimit(c, RATE_LIMIT_POLICIES.admin_api, 'admin_shop_calls');
    if (limited) return limited;
    const sessionResult = await requireSession(c, 'admin');
    if (sessionResult instanceof Response) return sessionResult;
    if (!deps.shopsRepository || !deps.callLogsRepository) {
      return c.json({ ok: false, error: 'admin_dependencies_unavailable' }, 500);
    }
    const shopId = parseAdminShopIdParam(c.req.param('id'));
    if (!shopId) return c.json({ ok: false, error: 'invalid_shop_id' }, 400);
    const shop = await deps.shopsRepository.findById(shopId);
    if (!shop) return c.json({ ok: false, error: 'shop_not_found' }, 404);

    const qParsed = adminShopCallsQuerySchema.safeParse({
      callsPage: c.req.query('callsPage'),
      dateFrom: c.req.query('dateFrom'),
      dateTo: c.req.query('dateTo'),
    });
    if (!qParsed.success) return c.json({ ok: false, error: 'invalid_query' }, 400);

    const callsPage = qParsed.data.callsPage ?? 1;
    const callsPageSize = 20;
    const callsOffset = (callsPage - 1) * callsPageSize;

    let range: { startedAfter?: Date; startedBefore?: Date } = {};
    const df = qParsed.data.dateFrom;
    const dt = qParsed.data.dateTo;
    if (df && dt) {
      const startedAfter = new Date(`${df}T00:00:00.000Z`);
      const startedBefore = new Date(`${dt}T23:59:59.999Z`);
      if (startedAfter.getTime() > startedBefore.getTime()) {
        return c.json({ ok: false, error: 'invalid_date_range' }, 400);
      }
      range = { startedAfter, startedBefore };
    } else if (df || dt) {
      return c.json({ ok: false, error: 'invalid_query' }, 400);
    }

    const [recentCalls, callsTotal] = await Promise.all([
      deps.callLogsRepository.listByShop(shopId, {
        limit: callsPageSize,
        offset: callsOffset,
        ...range,
      }),
      deps.callLogsRepository.countByShop(shopId, range),
    ]);

    return c.json({
      ok: true,
      recentCalls,
      callsPagination: { page: callsPage, pageSize: callsPageSize, total: callsTotal },
      filter: { dateFrom: df ?? null, dateTo: dt ?? null },
    });
  });

  app.get(path('/admin/shops/:id/analytics'), async (c) => {
    const limited = await enforceRateLimit(c, RATE_LIMIT_POLICIES.admin_api, 'admin_shop_analytics');
    if (limited) return limited;
    const sessionResult = await requireSession(c, 'admin');
    if (sessionResult instanceof Response) return sessionResult;
    if (!deps.shopsRepository) {
      return c.json({ ok: false, error: 'admin_dependencies_unavailable' }, 500);
    }
    const shopId = parseAdminShopIdParam(c.req.param('id'));
    if (!shopId) return c.json({ ok: false, error: 'invalid_shop_id' }, 400);
    const shop = await deps.shopsRepository.findById(shopId);
    if (!shop) return c.json({ ok: false, error: 'shop_not_found' }, 404);

    const qParsed = adminShopAnalyticsQuerySchema.safeParse({
      dateFrom: c.req.query('dateFrom'),
      dateTo: c.req.query('dateTo'),
    });
    if (!qParsed.success) return c.json({ ok: false, error: 'invalid_query' }, 400);

    const now = new Date();
    let endDay = qParsed.data.dateTo ?? now.toISOString().slice(0, 10);
    let startDay = qParsed.data.dateFrom ?? null;
    if (!startDay) {
      const from = new Date(now);
      from.setUTCDate(from.getUTCDate() - 30);
      startDay = from.toISOString().slice(0, 10);
    }
    const createdAfter = new Date(`${startDay}T00:00:00.000Z`);
    const createdBefore = new Date(`${endDay}T23:59:59.999Z`);
    if (createdAfter.getTime() > createdBefore.getTime()) {
      return c.json({ ok: false, error: 'invalid_date_range' }, 400);
    }

    const bookings = deps.bookingsRepository
      ? await deps.bookingsRepository.listByShop(shopId, {
          limit: 5000,
          createdAfter,
          createdBefore,
        })
      : [];

    const byStatus: Record<string, number> = {};
    for (const b of bookings) {
      const s = b.status || 'unknown';
      byStatus[s] = (byStatus[s] ?? 0) + 1;
    }

    let modifiedCount = 0;
    for (const b of bookings) {
      if (b.updatedAt && b.createdAt && b.updatedAt !== b.createdAt) modifiedCount += 1;
    }

    return c.json({
      ok: true,
      shopId: shop.id,
      shopName: shop.name,
      period: { dateFrom: startDay, dateTo: endDay },
      bookingsInPeriod: bookings.length,
      byStatus,
      bookingsUpdatedAfterCreate: modifiedCount,
      recentBookings: bookings.slice(0, 40),
    });
  });

  app.get(path('/admin/shops/:id'), async (c) => {
    const limited = await enforceRateLimit(c, RATE_LIMIT_POLICIES.admin_api, 'admin_shop_detail');
    if (limited) return limited;
    const sessionResult = await requireSession(c, 'admin');
    if (sessionResult instanceof Response) return sessionResult;
    if (!deps.shopsRepository) {
      return c.json({ ok: false, error: 'admin_dependencies_unavailable' }, 500);
    }
    const shopId = parseAdminShopIdParam(c.req.param('id'));
    if (!shopId) return c.json({ ok: false, error: 'invalid_shop_id' }, 400);

    const shop = await deps.shopsRepository.findById(shopId);
    if (!shop) return c.json({ ok: false, error: 'shop_not_found' }, 404);

    const sinceTestCalls = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const commercialGoLiveApprovalEventsPromise = deps.commercialGoLiveApprovalEventsRepository
      ? deps.commercialGoLiveApprovalEventsRepository.listByShopId(shop.id, 20).catch((error) => {
          console.warn('[admin_shop_detail] commercial approval history unavailable:', error);
          return [];
        })
      : Promise.resolve([]);
    const [subscription, accessState, testCallsUsed, commercialGoLiveApprovalEvents, shopLocations, shopRoutingRules, commercialAccount] = await Promise.all([
      deps.billingSubscriptionsRepository
        ? deps.billingSubscriptionsRepository.findCurrentByShopId(shop.id)
        : Promise.resolve(null),
      deps.shopAccessStatesRepository ? deps.shopAccessStatesRepository.findByShopId(shop.id) : Promise.resolve(null),
      deps.testCallAttemptsRepository
        ? deps.testCallAttemptsRepository.countRecentByShopId({
            shopId: shop.id,
            type: 'outbound_call_me',
            since: sinceTestCalls,
          })
        : Promise.resolve(0),
      commercialGoLiveApprovalEventsPromise,
      deps.shopLocationsRepository ? deps.shopLocationsRepository.listByShopId(shop.id).catch(() => []) : Promise.resolve([]),
      deps.shopRoutingRulesRepository ? deps.shopRoutingRulesRepository.listByShopId(shop.id).catch(() => []) : Promise.resolve([]),
      deps.commercialAccountsRepository ? deps.commercialAccountsRepository.findByShopId(shop.id).catch(() => null) : Promise.resolve(null),
    ]);
    const usage = deps.callLogsRepository
      ? await getShopUsageForPeriod(
          {
            callLogsRepository: deps.callLogsRepository,
            shopActiveCallSessionsRepository: deps.shopActiveCallSessionsRepository,
            billingSubscriptionsRepository: deps.billingSubscriptionsRepository,
          },
          { shop, commercialAccount },
        )
      : null;

    return c.json({
      ok: true,
      shop: toAdminFacingShop(shop),
      commercialGoLiveApprovalEvents,
      shopLocations,
      shopRoutingRules,
      commercialAccount,
      usage,
      adminStatus: buildAdminShopStatus({
        shop,
        subscription,
        accessState,
        testCallsUsed,
      }),
    });
  });

  app.put(path('/admin/shops/:id/plan'), async (c) => {
    const csrfBlocked = enforceSameOriginForCookieMutation(c);
    if (csrfBlocked) return csrfBlocked;
    const limited = await enforceRateLimit(c, RATE_LIMIT_POLICIES.admin_mutation, 'admin_shop_plan_put');
    if (limited) return limited;
    const sessionResult = await requireSession(c, 'admin');
    if (sessionResult instanceof Response) return sessionResult;
    if (!deps.shopsRepository) {
      return c.json({ ok: false, error: 'admin_dependencies_unavailable' }, 500);
    }
    const shopId = parseAdminShopIdParam(c.req.param('id'));
    if (!shopId) return c.json({ ok: false, error: 'invalid_shop_id' }, 400);
    const body = await c.req.json().catch(() => null);
    const parsed = adminUpdatePlanSchema.safeParse(body);
    if (!parsed.success) return c.json({ ok: false, error: 'invalid_payload' }, 400);
    if (parsed.data.plan === undefined && parsed.data.active === undefined) {
      return c.json({ ok: false, error: 'empty_patch' }, 400);
    }

    const updated = await deps.shopsRepository.updatePlanAndActivation(shopId, parsed.data);
    if (!updated) return c.json({ ok: false, error: 'shop_not_found' }, 404);
    securityAudit({
      action: 'admin_shop_plan_updated',
      actorType: 'admin',
      actorId: sessionResult.email,
      ip: getClientIp({ get: (name: string) => c.req.header(name) ?? null }),
      path: c.req.path,
      details: {
        shopId,
        plan: parsed.data.plan ?? null,
        active: parsed.data.active ?? null,
      },
    });
    return c.json({ ok: true, shop: toAdminFacingShop(updated) });
  });

  app.post(path('/admin/shops/:id/approve-commercial-go-live'), async (c) => {
    const csrfBlocked = enforceSameOriginForCookieMutation(c);
    if (csrfBlocked) return csrfBlocked;
    const limited = await enforceRateLimit(c, RATE_LIMIT_POLICIES.admin_mutation, 'admin_shop_approve_commercial_go_live');
    if (limited) return limited;
    const sessionResult = await requireSession(c, 'admin');
    if (sessionResult instanceof Response) return sessionResult;
    if (!deps.shopsRepository || !deps.shopAccessStatesRepository) {
      return c.json({ ok: false, error: 'admin_dependencies_unavailable' }, 500);
    }
    const shopId = parseAdminShopIdParam(c.req.param('id'));
    if (!shopId) return c.json({ ok: false, error: 'invalid_shop_id' }, 400);
    const body = await c.req.json().catch(() => ({}));
    const parsed = adminCommercialGoLiveApprovalSchema.safeParse(body ?? {});
    if (!parsed.success) return c.json({ ok: false, error: 'invalid_payload' }, 400);

    const shop = await deps.shopsRepository.findById(shopId);
    if (!shop) return c.json({ ok: false, error: 'shop_not_found' }, 404);
    const existing = await deps.shopAccessStatesRepository.findByShopId(shop.id);
    if (existing?.commercialGoLiveApprovedAt) {
      return c.json({ ok: true, alreadyApproved: true, accessState: existing });
    }

    const approvedAt = new Date().toISOString();
    const next = await deps.shopAccessStatesRepository.upsert({
      shopId: shop.id,
      commercialGoLiveApprovedAt: approvedAt,
      commercialGoLiveApprovedBy: sessionResult.email,
      commercialGoLiveApprovalNote: parsed.data.note?.trim() || null,
    });
    const approvalEvent = deps.commercialGoLiveApprovalEventsRepository
      ? await deps.commercialGoLiveApprovalEventsRepository
          .create({
            shopId: shop.id,
            eventType: 'approved',
            actorEmail: sessionResult.email,
            note: parsed.data.note?.trim() || null,
            createdAt: approvedAt,
          })
          .catch((error) => {
            console.warn('[admin_shop_approve_commercial_go_live] approval history unavailable:', error);
            return null;
          })
      : null;
    securityAudit({
      action: 'commercial_go_live_approved',
      actorType: 'admin',
      actorId: sessionResult.email,
      ip: getClientIp({ get: (name: string) => c.req.header(name) ?? null }),
      path: c.req.path,
      details: {
        shopId: shop.id,
      },
    });
    return c.json({ ok: true, alreadyApproved: false, accessState: next, approvalEvent: approvalEvent ?? null });
  });

  app.post(path('/admin/shops/:id/verify-forwarding'), async (c) => {
    const csrfBlocked = enforceSameOriginForCookieMutation(c);
    if (csrfBlocked) return csrfBlocked;
    const limited = await enforceRateLimit(c, RATE_LIMIT_POLICIES.admin_mutation, 'admin_shop_verify_forwarding');
    if (limited) return limited;
    const sessionResult = await requireSession(c, 'admin');
    if (sessionResult instanceof Response) return sessionResult;
    if (!deps.shopsRepository || !deps.shopAccessStatesRepository) {
      return c.json({ ok: false, error: 'admin_dependencies_unavailable' }, 500);
    }
    const shopId = parseAdminShopIdParam(c.req.param('id'));
    if (!shopId) return c.json({ ok: false, error: 'invalid_shop_id' }, 400);
    const parsed = adminVerifyForwardingSchema.safeParse(await c.req.json().catch(() => null));
    if (!parsed.success) return c.json({ ok: false, error: 'invalid_payload' }, 400);
    const shop = await deps.shopsRepository.findById(shopId);
    if (!shop) return c.json({ ok: false, error: 'shop_not_found' }, 404);

    const verifiedAt = new Date().toISOString();
    const next = await deps.shopAccessStatesRepository.upsert({
      shopId: shop.id,
      forwardingClaimedAt: verifiedAt,
      forwardingVerifiedAt: verifiedAt,
      forwardingVerifiedSource: 'admin_override',
    });
    securityAudit({
      action: 'forwarding_verified_admin_override',
      actorType: 'admin',
      actorId: sessionResult.email,
      ip: getClientIp({ get: (name: string) => c.req.header(name) ?? null }),
      path: c.req.path,
      details: { shopId: shop.id, reason: parsed.data.reason },
    });
    return c.json({ ok: true, accessState: next });
  });


  app.post(path('/admin/shops/:id/locations'), async (c) => {
    const csrfBlocked = enforceSameOriginForCookieMutation(c);
    if (csrfBlocked) return csrfBlocked;
    const limited = await enforceRateLimit(c, RATE_LIMIT_POLICIES.admin_mutation, 'admin_shop_location_post');
    if (limited) return limited;
    const sessionResult = await requireSession(c, 'admin');
    if (sessionResult instanceof Response) return sessionResult;
    if (!deps.shopsRepository || !deps.shopLocationsRepository) return c.json({ ok: false, error: 'admin_dependencies_unavailable' }, 500);
    const shopId = parseAdminShopIdParam(c.req.param('id'));
    if (!shopId) return c.json({ ok: false, error: 'invalid_shop_id' }, 400);
    const shop = await deps.shopsRepository.findById(shopId);
    if (!shop) return c.json({ ok: false, error: 'shop_not_found' }, 404);
    const parsed = adminShopLocationSchema.safeParse(await c.req.json().catch(() => null));
    if (!parsed.success) return c.json({ ok: false, error: 'invalid_payload' }, 400);
    const location = await deps.shopLocationsRepository.create({ shopId: shop.id, ...parsed.data });
    securityAudit({
      action: 'admin_location_create',
      actorType: 'admin',
      actorId: sessionResult.email,
      ip: getClientIp({ get: (name: string) => c.req.header(name) ?? null }),
      path: c.req.path,
      details: {
        shopId: shop.id,
        locationId: location.id,
        changes: parsed.data,
      },
    });
    return c.json({ ok: true, location });
  });

  app.put(path('/admin/shops/:id/locations/:locationId'), async (c) => {
    const csrfBlocked = enforceSameOriginForCookieMutation(c);
    if (csrfBlocked) return csrfBlocked;
    const limited = await enforceRateLimit(c, RATE_LIMIT_POLICIES.admin_mutation, 'admin_shop_location_put');
    if (limited) return limited;
    const sessionResult = await requireSession(c, 'admin');
    if (sessionResult instanceof Response) return sessionResult;
    if (!deps.shopLocationsRepository) return c.json({ ok: false, error: 'admin_dependencies_unavailable' }, 500);
    const shopId = parseAdminShopIdParam(c.req.param('id'));
    const locationId = parseAdminResourceUuid(c.req.param('locationId'));
    if (!shopId || !locationId) return c.json({ ok: false, error: 'invalid_id' }, 400);
    const parsed = adminShopLocationSchema.partial().safeParse(await c.req.json().catch(() => null));
    if (!parsed.success) return c.json({ ok: false, error: 'invalid_payload' }, 400);
    const location = await deps.shopLocationsRepository.update(shopId, locationId, parsed.data as Parameters<NonNullable<typeof deps.shopLocationsRepository>['update']>[2]);
    if (!location) return c.json({ ok: false, error: 'location_not_found' }, 404);
    securityAudit({
      action: 'admin_location_update',
      actorType: 'admin',
      actorId: sessionResult.email,
      ip: getClientIp({ get: (name: string) => c.req.header(name) ?? null }),
      path: c.req.path,
      details: {
        shopId,
        locationId,
        changes: parsed.data,
      },
    });
    return c.json({ ok: true, location });
  });

  app.post(path('/admin/shops/:id/routing-rules'), async (c) => {
    const csrfBlocked = enforceSameOriginForCookieMutation(c);
    if (csrfBlocked) return csrfBlocked;
    const limited = await enforceRateLimit(c, RATE_LIMIT_POLICIES.admin_mutation, 'admin_shop_routing_rule_post');
    if (limited) return limited;
    const sessionResult = await requireSession(c, 'admin');
    if (sessionResult instanceof Response) return sessionResult;
    if (!deps.shopsRepository || !deps.shopRoutingRulesRepository) return c.json({ ok: false, error: 'admin_dependencies_unavailable' }, 500);
    const shopId = parseAdminShopIdParam(c.req.param('id'));
    if (!shopId) return c.json({ ok: false, error: 'invalid_shop_id' }, 400);
    const shop = await deps.shopsRepository.findById(shopId);
    if (!shop) return c.json({ ok: false, error: 'shop_not_found' }, 404);
    const parsed = adminShopRoutingRuleSchema.safeParse(await c.req.json().catch(() => null));
    if (!parsed.success) return c.json({ ok: false, error: 'invalid_payload' }, 400);
    const rule = await deps.shopRoutingRulesRepository.create({ shopId: shop.id, ...parsed.data });
    securityAudit({
      action: 'admin_routing_rule_create',
      actorType: 'admin',
      actorId: sessionResult.email,
      ip: getClientIp({ get: (name: string) => c.req.header(name) ?? null }),
      path: c.req.path,
      details: {
        shopId: shop.id,
        ruleId: rule.id,
        changes: parsed.data,
      },
    });
    return c.json({ ok: true, rule });
  });

  app.put(path('/admin/shops/:id/routing-rules/:ruleId'), async (c) => {
    const csrfBlocked = enforceSameOriginForCookieMutation(c);
    if (csrfBlocked) return csrfBlocked;
    const limited = await enforceRateLimit(c, RATE_LIMIT_POLICIES.admin_mutation, 'admin_shop_routing_rule_put');
    if (limited) return limited;
    const sessionResult = await requireSession(c, 'admin');
    if (sessionResult instanceof Response) return sessionResult;
    if (!deps.shopRoutingRulesRepository) return c.json({ ok: false, error: 'admin_dependencies_unavailable' }, 500);
    const shopId = parseAdminShopIdParam(c.req.param('id'));
    const ruleId = parseAdminResourceUuid(c.req.param('ruleId'));
    if (!shopId || !ruleId) return c.json({ ok: false, error: 'invalid_id' }, 400);
    const parsed = adminShopRoutingRuleSchema.partial().safeParse(await c.req.json().catch(() => null));
    if (!parsed.success) return c.json({ ok: false, error: 'invalid_payload' }, 400);
    const rule = await deps.shopRoutingRulesRepository.update(shopId, ruleId, parsed.data);
    if (!rule) return c.json({ ok: false, error: 'routing_rule_not_found' }, 404);
    securityAudit({
      action: 'admin_routing_rule_update',
      actorType: 'admin',
      actorId: sessionResult.email,
      ip: getClientIp({ get: (name: string) => c.req.header(name) ?? null }),
      path: c.req.path,
      details: {
        shopId,
        ruleId,
        changes: parsed.data,
      },
    });
    return c.json({ ok: true, rule });
  });

  app.put(path('/admin/shops/:id/commercial-account'), async (c) => {
    const csrfBlocked = enforceSameOriginForCookieMutation(c);
    if (csrfBlocked) return csrfBlocked;
    const limited = await enforceRateLimit(c, RATE_LIMIT_POLICIES.admin_mutation, 'admin_shop_commercial_account_put');
    if (limited) return limited;
    const sessionResult = await requireSession(c, 'admin');
    if (sessionResult instanceof Response) return sessionResult;
    if (!deps.shopsRepository || !deps.commercialAccountsRepository) return c.json({ ok: false, error: 'admin_dependencies_unavailable' }, 500);
    const shopId = parseAdminShopIdParam(c.req.param('id'));
    if (!shopId) return c.json({ ok: false, error: 'invalid_shop_id' }, 400);
    const shop = await deps.shopsRepository.findById(shopId);
    if (!shop) return c.json({ ok: false, error: 'shop_not_found' }, 404);
    const parsed = adminCommercialAccountSchema.safeParse(await c.req.json().catch(() => null));
    if (!parsed.success) return c.json({ ok: false, error: 'invalid_payload' }, 400);
    const account = await deps.commercialAccountsRepository.upsert({ shopId: shop.id, ...parsed.data });
    securityAudit({
      action: 'admin_commercial_account_update',
      actorType: 'admin',
      actorId: sessionResult.email,
      ip: getClientIp({ get: (name: string) => c.req.header(name) ?? null }),
      path: c.req.path,
      details: {
        shopId: shop.id,
        changes: parsed.data,
      },
    });
    return c.json({ ok: true, commercialAccount: account });
  });

  app.put(path('/admin/shops/:id/settings'), async (c) => {
    const csrfBlocked = enforceSameOriginForCookieMutation(c);
    if (csrfBlocked) return csrfBlocked;
    const limited = await enforceRateLimit(c, RATE_LIMIT_POLICIES.admin_mutation, 'admin_shop_settings_put');
    if (limited) return limited;
    const sessionResult = await requireSession(c, 'admin');
    if (sessionResult instanceof Response) return sessionResult;
    if (!deps.shopsRepository) {
      return c.json({ ok: false, error: 'admin_dependencies_unavailable' }, 500);
    }
    const shopId = parseAdminShopIdParam(c.req.param('id'));
    if (!shopId) return c.json({ ok: false, error: 'invalid_shop_id' }, 400);
    const body = await c.req.json().catch(() => null);
    const parsed = adminShopSettingsUpdateSchema.safeParse(body);
    if (!parsed.success) return c.json({ ok: false, error: 'invalid_payload' }, 400);

    const updated = await deps.shopsRepository.updateUserSettings(shopId, parsed.data);
    if (!updated) return c.json({ ok: false, error: 'shop_not_found' }, 404);
    securityAudit({
      action: 'admin_shop_settings_updated',
      actorType: 'admin',
      actorId: sessionResult.email,
      ip: getClientIp({ get: (name: string) => c.req.header(name) ?? null }),
      path: c.req.path,
      details: {
        shopId,
      },
    });
    return c.json({ ok: true, shop: toAdminFacingShop(updated) });
  });

  app.put(path('/admin/shops/:id/config'), async (c) => {
    const csrfBlocked = enforceSameOriginForCookieMutation(c);
    if (csrfBlocked) return csrfBlocked;
    const limited = await enforceRateLimit(c, RATE_LIMIT_POLICIES.admin_mutation, 'admin_shop_config_put');
    if (limited) return limited;
    const sessionResult = await requireSession(c, 'admin');
    if (sessionResult instanceof Response) return sessionResult;
    if (!deps.shopsRepository) {
      return c.json({ ok: false, error: 'admin_dependencies_unavailable' }, 500);
    }
    const shopId = parseAdminShopIdParam(c.req.param('id'));
    if (!shopId) return c.json({ ok: false, error: 'invalid_shop_id' }, 400);
    const body = await c.req.json().catch(() => null);
    const parsed = adminShopDynamicConfigSchema.safeParse(body);
    if (!parsed.success) return c.json({ ok: false, error: 'invalid_payload' }, 400);

    const updated = await deps.shopsRepository.updateDynamicConfig(shopId, parsed.data);
    if (!updated) return c.json({ ok: false, error: 'shop_not_found' }, 404);
    securityAudit({
      action: 'admin_shop_dynamic_config_updated',
      actorType: 'admin',
      actorId: sessionResult.email,
      ip: getClientIp({ get: (name: string) => c.req.header(name) ?? null }),
      path: c.req.path,
      details: {
        shopId,
        keys: Object.keys(parsed.data),
      },
    });
    return c.json({ ok: true, shop: toAdminFacingShop(updated) });
  });

  app.get(path('/admin/calls'), async (c) => {
    const limited = await enforceRateLimit(c, RATE_LIMIT_POLICIES.admin_api, 'admin_calls');
    if (limited) return limited;
    const sessionResult = await requireSession(c, 'admin');
    if (sessionResult instanceof Response) return sessionResult;
    const callLogsRepository = deps.callLogsRepository;
    if (!callLogsRepository) {
      return c.json({ ok: false, error: 'admin_dependencies_unavailable' }, 500);
    }
    const parsed = adminCallsListQuerySchema.safeParse({
      shopId: c.req.query('shopId'),
      dateFrom: c.req.query('dateFrom'),
      dateTo: c.req.query('dateTo'),
      page: c.req.query('page'),
    });
    if (!parsed.success) {
      return c.json({ ok: false, error: 'invalid_query' }, 400);
    }
    const shopId = parsed.data.shopId;
    const dateFrom = parsed.data.dateFrom;
    const dateTo = parsed.data.dateTo;
    const page = parsed.data.page ?? 1;
    const pageSize = ADMIN_CALL_LIST_PAGE_SIZE;
    const offset = (page - 1) * pageSize;

    let rangeParams: { startedAfter?: Date; startedBefore?: Date } = {};
    if (dateFrom && dateTo) {
      const startedAfter = new Date(`${dateFrom}T00:00:00.000Z`);
      const startedBefore = new Date(`${dateTo}T23:59:59.999Z`);
      if (startedAfter.getTime() > startedBefore.getTime()) {
        return c.json({ ok: false, error: 'invalid_date_range' }, 400);
      }
      rangeParams = { startedAfter, startedBefore };
    } else if (dateFrom || dateTo) {
      return c.json({ ok: false, error: 'invalid_query' }, 400);
    }

    const countArgs = rangeParams;
    const listPageArgs = { limit: pageSize, offset, ...rangeParams };
    const chartSampleArgs = { limit: ADMIN_CALL_CHART_SAMPLE, offset: 0, ...rangeParams };

    const countFn = (extra?: { outcome?: string; transcriptStatus?: string }) =>
      shopId
        ? callLogsRepository.countByShop(shopId, { ...countArgs, ...extra })
        : callLogsRepository.countRecent({ ...countArgs, ...extra });

    const [
      total,
      booked,
      missed,
      readyTranscript,
      calls,
      chartSource,
      shops,
    ] = await Promise.all([
      countFn(),
      countFn({ outcome: 'booked' }),
      countFn({ outcome: 'missed' }),
      countFn({ transcriptStatus: 'completed' }),
      shopId ? callLogsRepository.listByShop(shopId, listPageArgs) : callLogsRepository.listRecent(listPageArgs),
      shopId ? callLogsRepository.listByShop(shopId, chartSampleArgs) : callLogsRepository.listRecent(chartSampleArgs),
      deps.shopsRepository ? deps.shopsRepository.list({ limit: 500 }) : Promise.resolve([]),
    ]);

    const shopNameById = new Map(shops.map((s) => [s.id, s.name]));
    const chartDaily = buildAdminCallChartDaily(chartSource);
    const chartTruncated = total > ADMIN_CALL_CHART_SAMPLE;

    return c.json({
      ok: true,
      calls: calls.map((call) => ({
        ...call,
        shopName: shopNameById.get(call.shopId) ?? call.shopId,
      })),
      summary: {
        total,
        booked,
        missed,
        readyTranscript,
        chartSampleSize: chartSource.length,
        chartTruncated,
      },
      chartDaily,
      pagination: { page, pageSize, total },
      filter: {
        shopId: shopId || null,
        shopName: shopId ? (shopNameById.get(shopId) ?? null) : null,
        dateFrom: dateFrom ?? null,
        dateTo: dateTo ?? null,
      },
    });
  });

  app.get(path('/admin/sms'), async (c) => {
    const limited = await enforceRateLimit(c, RATE_LIMIT_POLICIES.admin_api, 'admin_sms');
    if (limited) return limited;
    const sessionResult = await requireSession(c, 'admin');
    if (sessionResult instanceof Response) return sessionResult;
    const smsMessagesRepository = deps.smsMessagesRepository;
    if (!smsMessagesRepository) {
      return c.json({ ok: false, error: 'admin_dependencies_unavailable' }, 500);
    }
    const parsed = adminSmsListQuerySchema.safeParse({
      q: c.req.query('q'),
      toNumber: c.req.query('toNumber'),
      read: c.req.query('read'),
      dateFrom: c.req.query('dateFrom'),
      dateTo: c.req.query('dateTo'),
      page: c.req.query('page'),
      limit: c.req.query('limit'),
    });
    if (!parsed.success) {
      return c.json({ ok: false, error: 'invalid_query' }, 400);
    }

    const allowedNumbers = getAllowedSmsInboxNumbers();
    const page = parsed.data.page ?? 1;
    const pageSize = parsed.data.limit ?? ADMIN_SMS_LIST_PAGE_SIZE;
    const requestedToNumber = parsed.data.toNumber ? normalizeSmsInboxPhoneNumber(parsed.data.toNumber) : null;
    if (parsed.data.toNumber && !requestedToNumber) {
      return c.json({ ok: false, error: 'invalid_to_number' }, 400);
    }

    let dateFrom: Date | null = null;
    let dateTo: Date | null = null;
    if (parsed.data.dateFrom) dateFrom = new Date(`${parsed.data.dateFrom}T00:00:00.000Z`);
    if (parsed.data.dateTo) dateTo = new Date(`${parsed.data.dateTo}T23:59:59.999Z`);
    if (dateFrom && dateTo && dateFrom.getTime() > dateTo.getTime()) {
      return c.json({ ok: false, error: 'invalid_date_range' }, 400);
    }

    if (allowedNumbers.length === 0 || (requestedToNumber && !allowedNumbers.includes(requestedToNumber))) {
      return c.json({
        ok: true,
        items: [],
        allowedNumbers,
        inboxConfigured: allowedNumbers.length > 0,
        pagination: { page, pageSize, total: 0 },
        filter: {
          q: parsed.data.q ?? null,
          toNumber: requestedToNumber,
          read: parsed.data.read,
          dateFrom: parsed.data.dateFrom ?? null,
          dateTo: parsed.data.dateTo ?? null,
        },
      });
    }

    const result = await smsMessagesRepository.listAdminSmsMessages({
      allowedToNumbers: allowedNumbers,
      q: parsed.data.q ?? null,
      toNumber: requestedToNumber,
      read: parsed.data.read,
      dateFrom,
      dateTo,
      page,
      limit: pageSize,
    });

    return c.json({
      ok: true,
      items: result.items,
      allowedNumbers,
      inboxConfigured: true,
      pagination: { page, pageSize, total: result.total },
      filter: {
        q: parsed.data.q ?? null,
        toNumber: requestedToNumber,
        read: parsed.data.read,
        dateFrom: parsed.data.dateFrom ?? null,
        dateTo: parsed.data.dateTo ?? null,
      },
    });
  });

  app.get(path('/admin/sms/:id'), async (c) => {
    const limited = await enforceRateLimit(c, RATE_LIMIT_POLICIES.admin_api, 'admin_sms_detail');
    if (limited) return limited;
    const sessionResult = await requireSession(c, 'admin');
    if (sessionResult instanceof Response) return sessionResult;
    if (!deps.smsMessagesRepository) {
      return c.json({ ok: false, error: 'admin_dependencies_unavailable' }, 500);
    }
    const id = parseAdminResourceUuid(c.req.param('id'));
    if (!id) return c.json({ ok: false, error: 'invalid_sms_message_id' }, 400);

    const message = await deps.smsMessagesRepository.getAdminSmsMessageById(id, getAllowedSmsInboxNumbers());
    if (!message) return c.json({ ok: false, error: 'sms_message_not_found' }, 404);
    return c.json({ ok: true, message });
  });

  app.post(path('/admin/sms/:id/read'), async (c) => {
    const csrfBlocked = enforceSameOriginForCookieMutation(c);
    if (csrfBlocked) return csrfBlocked;
    const limited = await enforceRateLimit(c, RATE_LIMIT_POLICIES.admin_mutation, 'admin_sms_read');
    if (limited) return limited;
    const sessionResult = await requireSession(c, 'admin');
    if (sessionResult instanceof Response) return sessionResult;
    if (!deps.smsMessagesRepository) {
      return c.json({ ok: false, error: 'admin_dependencies_unavailable' }, 500);
    }
    const id = parseAdminResourceUuid(c.req.param('id'));
    if (!id) return c.json({ ok: false, error: 'invalid_sms_message_id' }, 400);

    const message = await deps.smsMessagesRepository.markSmsMessageRead(id, getAllowedSmsInboxNumbers());
    if (!message) return c.json({ ok: false, error: 'sms_message_not_found' }, 404);
    return c.json({ ok: true, message });
  });

  app.get(path('/admin/demo-calls'), async (c) => {
    const limited = await enforceRateLimit(c, RATE_LIMIT_POLICIES.admin_api, 'admin_demo_calls');
    if (limited) return limited;
    const sessionResult = await requireSession(c, 'admin');
    if (sessionResult instanceof Response) return sessionResult;
    if (!deps.demoSessionsRepository || !deps.callLogsRepository) {
      return c.json({ ok: false, error: 'admin_dependencies_unavailable' }, 500);
    }
    const parsed = adminDemoCallsListQuerySchema.safeParse({
      dateFrom: c.req.query('dateFrom'),
      dateTo: c.req.query('dateTo'),
      page: c.req.query('page'),
    });
    if (!parsed.success) {
      return c.json({ ok: false, error: 'invalid_query' }, 400);
    }
    const result = await buildAdminDemoCallsListResult(
      { demoSessionsRepository: deps.demoSessionsRepository, callLogsRepository: deps.callLogsRepository },
      parsed.data,
    );
    if (!result.ok) return c.json({ ok: false, error: result.error }, result.status);
    return c.json(result.json);
  });

  app.get(path('/admin/demos/phone'), async (c) => {
    const limited = await enforceRateLimit(c, RATE_LIMIT_POLICIES.admin_api, 'admin_demos_phone');
    if (limited) return limited;
    const sessionResult = await requireSession(c, 'admin');
    if (sessionResult instanceof Response) return sessionResult;
    if (!deps.demoSessionsRepository || !deps.callLogsRepository) {
      return c.json({ ok: false, error: 'admin_dependencies_unavailable' }, 500);
    }
    const parsed = adminDemoCallsListQuerySchema.safeParse({
      dateFrom: c.req.query('dateFrom'),
      dateTo: c.req.query('dateTo'),
      page: c.req.query('page'),
    });
    if (!parsed.success) {
      return c.json({ ok: false, error: 'invalid_query' }, 400);
    }
    const result = await buildAdminDemoCallsListResult(
      { demoSessionsRepository: deps.demoSessionsRepository, callLogsRepository: deps.callLogsRepository },
      parsed.data,
      { providerNotEquals: 'marketing_demo_web' },
    );
    if (!result.ok) return c.json({ ok: false, error: result.error }, result.status);
    return c.json(result.json);
  });

  app.get(path('/admin/demos/web'), async (c) => {
    const limited = await enforceRateLimit(c, RATE_LIMIT_POLICIES.admin_api, 'admin_demos_web');
    if (limited) return limited;
    const sessionResult = await requireSession(c, 'admin');
    if (sessionResult instanceof Response) return sessionResult;
    if (!deps.demoSessionsRepository || !deps.webDemoSessionsRepository || !deps.callLogsRepository) {
      return c.json({ ok: false, error: 'admin_dependencies_unavailable' }, 500);
    }
    const parsed = adminWebDemosListQuerySchema.safeParse({
      dateFrom: c.req.query('dateFrom'),
      dateTo: c.req.query('dateTo'),
      page: c.req.query('page'),
      vertical: c.req.query('vertical'),
      status: c.req.query('status'),
      country: c.req.query('country'),
      search: c.req.query('search'),
    });
    if (!parsed.success) {
      return c.json({ ok: false, error: 'invalid_query' }, 400);
    }

    const env = getEnv();
    const now = new Date();
    const endDay = parsed.data.dateTo ?? now.toISOString().slice(0, 10);
    let startDay = parsed.data.dateFrom ?? null;
    if (!startDay) {
      const from = new Date(now);
      from.setUTCDate(from.getUTCDate() - 30);
      startDay = from.toISOString().slice(0, 10);
    }
    const createdAfter = new Date(`${startDay}T00:00:00.000Z`);
    const createdBefore = new Date(`${endDay}T23:59:59.999Z`);
    if (createdAfter.getTime() > createdBefore.getTime()) {
      return c.json({ ok: false, error: 'invalid_date_range' }, 400);
    }

    const page = parsed.data.page ?? 1;
    const pageSize = ADMIN_DEMO_LIST_PAGE_SIZE;

    const verticalFilter = parsed.data.vertical?.trim() || undefined;
    const statusFilter = parsed.data.status;
    const countryFilter = parsed.data.country?.trim() || undefined;
    const searchFilter = parsed.data.search?.trim() || undefined;

    const [livekitRows, directRows] = await Promise.all([
      deps.demoSessionsRepository.listAdminDemoCallRuns({
        createdAfter,
        createdBefore,
        providerEquals: 'marketing_demo_web',
        limit: ADMIN_WEB_DEMO_MERGE_CAP,
        offset: 0,
      }),
      deps.webDemoSessionsRepository.listForAdmin({
        startedAfter: createdAfter,
        startedBefore: createdBefore,
        verticalSlug: verticalFilter,
        status: statusFilter,
        country: countryFilter,
        search: searchFilter,
        limit: ADMIN_WEB_DEMO_MERGE_CAP,
        offset: 0,
      }),
    ]);

    const truncatedMerge =
      livekitRows.length >= ADMIN_WEB_DEMO_MERGE_CAP || directRows.length >= ADMIN_WEB_DEMO_MERGE_CAP;

    const transcriptMeta = await deps.callLogsRepository.listTranscriptMetaByShopAndRequestIds({
      shopId: env.PUBLIC_DEMO_SHOP_ID,
      requestIds: livekitRows.map((r) => r.requestId),
    });

    type UnifiedWebDemoRow = {
      sortAt: string;
      kind: 'livekit_web' | 'direct_realtime';
      livekitRequestId: string | null;
      webDemoRowId: string | null;
      publicSessionId: string;
      ip: string | null;
      country: string | null;
      durationSeconds: number | null;
      businessName: string | null;
      verticalSlug: string;
      adminStatus: WebDemoSessionStatus;
      browser: string | null;
      deviceType: string | null;
      userAgent: string | null;
      transcriptAvailable: boolean;
      importedSiteUrl: string | null;
    };

    const unified: UnifiedWebDemoRow[] = [];

    for (const row of livekitRows) {
      const adminStatus = liveKitDemoRunToWebAdminStatus(row.runStatus, row.sessionStatus);
      const enriched = {
        verticalSlug: row.verticalSlug,
        adminStatus,
        country: effectiveDemoClientCountry(row.clientCountry, row.callbackPhone),
        businessName: row.businessName,
        publicSessionId: row.publicSessionId,
        livekitRequestId: row.requestId,
      };
      if (
        !unifiedWebDemoRowMatchesFilters(enriched, {
          vertical: verticalFilter,
          status: statusFilter,
          country: countryFilter,
          search: searchFilter,
        })
      ) {
        continue;
      }
      const meta = transcriptMeta.get(row.requestId);
      unified.push({
        sortAt: row.runCreatedAt,
        kind: 'livekit_web',
        livekitRequestId: row.requestId,
        webDemoRowId: null,
        publicSessionId: row.publicSessionId,
        ip: row.clientIp,
        country: enriched.country,
        durationSeconds: demoCallDurationSeconds(row),
        businessName: row.businessName,
        verticalSlug: row.verticalSlug,
        adminStatus,
        browser: null,
        deviceType: null,
        userAgent: null,
        transcriptAvailable: meta?.hasTranscriptText ?? false,
        importedSiteUrl: null,
      });
    }

    for (const row of directRows) {
      const transcriptAvailable = row.transcript != null && formatWebDemoTranscriptForAdmin(row.transcript) != null;
      unified.push({
        sortAt: row.startedAt,
        kind: 'direct_realtime',
        livekitRequestId: row.requestId,
        webDemoRowId: row.id,
        publicSessionId: row.publicSessionId,
        ip: row.ipAddress,
        country: row.country,
        durationSeconds: row.durationSeconds,
        businessName: row.businessName,
        verticalSlug: row.verticalSlug ?? '—',
        adminStatus: row.status,
        browser: row.browser,
        deviceType: row.deviceType,
        userAgent: row.userAgent,
        transcriptAvailable,
        importedSiteUrl: row.importedSiteUrl ?? null,
      });
    }

    unified.sort((a, b) => b.sortAt.localeCompare(a.sortAt));
    const total = unified.length;
    const offset = (page - 1) * pageSize;
    const pageRows = unified.slice(offset, offset + pageSize);

    return c.json({
      ok: true,
      sessions: pageRows.map((r) => ({
        kind: r.kind,
        startedAt: r.sortAt,
        sessionId: r.publicSessionId,
        requestId: r.livekitRequestId,
        webDemoRowId: r.webDemoRowId,
        ip: r.ip,
        country: r.country,
        durationSeconds: r.durationSeconds,
        businessName: r.businessName,
        verticalSlug: r.verticalSlug,
        status: r.adminStatus,
        browser: r.browser,
        deviceType: r.deviceType,
        userAgent: r.userAgent,
        transcriptAvailable: r.transcriptAvailable,
        importedSiteUrl: r.importedSiteUrl,
      })),
      pagination: { page, pageSize, total },
      filter: {
        dateFrom: startDay,
        dateTo: endDay,
        vertical: verticalFilter ?? null,
        status: statusFilter ?? null,
        country: countryFilter ?? null,
        search: searchFilter ?? null,
      },
      truncatedMerge,
    });
  });

  app.get(path('/admin/demos/web/:id'), async (c) => {
    const limited = await enforceRateLimit(c, RATE_LIMIT_POLICIES.admin_api, 'admin_demos_web_detail');
    if (limited) return limited;
    const sessionResult = await requireSession(c, 'admin');
    if (sessionResult instanceof Response) return sessionResult;
    if (!deps.webDemoSessionsRepository) {
      return c.json({ ok: false, error: 'admin_dependencies_unavailable' }, 500);
    }
    const id = parseAdminUuidParam(c.req.param('id'));
    if (!id) return c.json({ ok: false, error: 'invalid_id' }, 400);
    const row = await deps.webDemoSessionsRepository.findById(id);
    if (!row) return c.json({ ok: false, error: 'not_found' }, 404);
    return c.json({
      ok: true,
      session: {
        id: row.id,
        sessionId: row.publicSessionId,
        requestId: row.requestId,
        verticalSlug: row.verticalSlug,
        businessName: row.businessName,
        demoSource: row.demoSource,
        status: row.status,
        ip: row.ipAddress,
        country: row.country,
        browser: row.browser,
        deviceType: row.deviceType,
        userAgent: row.userAgent,
        startedAt: row.startedAt,
        connectedAt: row.connectedAt,
        endedAt: row.endedAt,
        durationSeconds: row.durationSeconds,
        summary: row.summary,
        errorCode: row.errorCode,
        errorMessage: row.errorMessage,
        hasTranscript: row.transcript != null && formatWebDemoTranscriptForAdmin(row.transcript) != null,
      },
    });
  });

  app.get(path('/admin/demos/web/:id/transcript'), async (c) => {
    const limited = await enforceRateLimit(c, RATE_LIMIT_POLICIES.admin_demo_transcript_read, 'admin_demos_web_transcript');
    if (limited) return limited;
    const sessionResult = await requireSession(c, 'admin');
    if (sessionResult instanceof Response) return sessionResult;
    if (!deps.webDemoSessionsRepository) {
      return c.json({ ok: false, error: 'admin_dependencies_unavailable' }, 500);
    }
    const id = parseAdminUuidParam(c.req.param('id'));
    if (!id) return c.json({ ok: false, error: 'invalid_id' }, 400);
    const row = await deps.webDemoSessionsRepository.findById(id);
    if (!row) return c.json({ ok: false, error: 'not_found' }, 404);
    securityAudit({
      action: 'admin_web_demo_transcript_viewed',
      actorType: 'admin',
      actorId: sessionResult.email,
      ip: getClientIp({ get: (name: string) => c.req.header(name) ?? null }),
      path: c.req.path,
      details: { webDemoSessionId: id },
    });
    const transcriptText = formatWebDemoTranscriptForAdmin(row.transcript);
    return c.json({
      ok: true,
      sessionId: row.publicSessionId,
      requestId: row.requestId,
      status: row.status,
      transcriptText,
    });
  });

  app.get(path('/admin/demo-calls/:requestId/transcript'), async (c) => {
    const limited = await enforceRateLimit(c, RATE_LIMIT_POLICIES.admin_demo_transcript_read, 'admin_demo_calls_transcript');
    if (limited) return limited;
    const sessionResult = await requireSession(c, 'admin');
    if (sessionResult instanceof Response) return sessionResult;
    if (!deps.demoSessionsRepository && !deps.callLogsRepository) {
      return c.json({ ok: false, error: 'admin_dependencies_unavailable' }, 500);
    }
    const requestId = c.req.param('requestId')?.trim() ?? '';
    if (!requestId.startsWith('demo-') || requestId.length > 120) {
      return c.json({ ok: false, error: 'invalid_request_id' }, 400);
    }

    // Phone / SIP demo transcript lives on the demo_call_runs row (demos are isolated from
    // production call_logs). Fall back to call_logs for legacy LiveKit web demos.
    const callRun = deps.demoSessionsRepository
      ? await deps.demoSessionsRepository.findCallRunByRequestId(requestId)
      : null;
    let transcriptText = callRun ? formatWebDemoTranscriptForAdmin(callRun.transcript) : null;
    let transcriptStatus = callRun?.transcriptStatus ?? null;
    let startedAt = callRun?.startedAt ?? null;
    let endedAt = callRun?.endedAt ?? null;

    if (!transcriptText && deps.callLogsRepository) {
      const env = getEnv();
      const legacyRow = await deps.callLogsRepository.findTranscriptByShopAndRequestId({
        shopId: env.PUBLIC_DEMO_SHOP_ID,
        requestId,
      });
      if (legacyRow) {
        transcriptText = legacyRow.transcriptText ?? null;
        transcriptStatus = legacyRow.transcriptStatus ?? transcriptStatus;
        startedAt = legacyRow.startedAt ?? startedAt;
        endedAt = legacyRow.endedAt ?? endedAt;
      }
    }

    if (!callRun && !transcriptText) {
      return c.json({ ok: false, error: 'transcript_not_found' }, 404);
    }
    securityAudit({
      action: 'admin_demo_transcript_viewed',
      actorType: 'admin',
      actorId: sessionResult.email,
      ip: getClientIp({ get: (name: string) => c.req.header(name) ?? null }),
      path: c.req.path,
      details: { requestId },
    });
    return c.json({
      ok: true,
      requestId,
      transcriptStatus,
      transcriptText,
      startedAt,
      endedAt,
    });
  });

  app.get(path('/admin/leads'), async (c) => {
    const limited = await enforceRateLimit(c, RATE_LIMIT_POLICIES.admin_api, 'admin_leads');
    if (limited) return limited;
    const sessionResult = await requireSession(c, 'admin');
    if (sessionResult instanceof Response) return sessionResult;
    if (!deps.contactRequestsRepository) {
      return c.json({ ok: false, error: 'admin_dependencies_unavailable' }, 500);
    }
    const parsed = adminLeadsListQuerySchema.safeParse({
      limit: c.req.query('limit'),
      status: c.req.query('status'),
      intent: c.req.query('intent'),
      query: c.req.query('query'),
    });
    if (!parsed.success) {
      return c.json({ ok: false, error: 'invalid_query' }, 400);
    }

    const leads = await deps.contactRequestsRepository.listForAdmin({
      limit: parsed.data.limit,
      status: parsed.data.status,
      intent: parsed.data.intent,
      query: parsed.data.query,
    });

    const byStatus = new Map<ContactRequestStatus, number>();
    for (const lead of leads) {
      byStatus.set(lead.status, (byStatus.get(lead.status) ?? 0) + 1);
    }

    return c.json({
      ok: true,
      leads,
      filters: {
        status: parsed.data.status ?? 'all',
        intent: parsed.data.intent ?? 'all',
        query: parsed.data.query ?? '',
      },
      metrics: {
        total: leads.length,
        new: byStatus.get('new') ?? 0,
        contacted: byStatus.get('contacted') ?? 0,
        qualified: byStatus.get('qualified') ?? 0,
        closed: byStatus.get('closed') ?? 0,
        spam: byStatus.get('spam') ?? 0,
      },
    });
  });

  app.put(path('/admin/leads/:id/status'), async (c) => {
    const csrfBlocked = enforceSameOriginForCookieMutation(c);
    if (csrfBlocked) return csrfBlocked;
    const limited = await enforceRateLimit(c, RATE_LIMIT_POLICIES.admin_mutation, 'admin_lead_status_put');
    if (limited) return limited;
    const sessionResult = await requireSession(c, 'admin');
    if (sessionResult instanceof Response) return sessionResult;
    if (!deps.contactRequestsRepository) {
      return c.json({ ok: false, error: 'admin_dependencies_unavailable' }, 500);
    }
    const leadId = parseAdminResourceUuid(c.req.param('id'));
    if (!leadId) return c.json({ ok: false, error: 'invalid_lead_id' }, 400);

    const body = await c.req.json().catch(() => null);
    const parsed = adminLeadStatusUpdateSchema.safeParse(body);
    if (!parsed.success) return c.json({ ok: false, error: 'invalid_payload' }, 400);

    const updated = await deps.contactRequestsRepository.updateStatus(leadId, {
      status: parsed.data.status,
      notes: parsed.data.notes,
      handledBy: sessionResult.email,
    });
    if (!updated) return c.json({ ok: false, error: 'lead_not_found' }, 404);

    securityAudit({
      action: 'admin_contact_request_status_updated',
      actorType: 'admin',
      actorId: sessionResult.email,
      ip: getClientIp({ get: (name: string) => c.req.header(name) ?? null }),
      path: c.req.path,
      details: {
        leadId,
        status: parsed.data.status,
      },
    });

    return c.json({ ok: true, lead: updated });
  });

  app.get(path('/admin/users'), async (c) => {
    const limited = await enforceRateLimit(c, RATE_LIMIT_POLICIES.admin_api, 'admin_users_list');
    if (limited) return limited;
    const sessionResult = await requireSession(c, 'admin');
    if (sessionResult instanceof Response) return sessionResult;
    if (!deps.authUsersRepository) {
      return c.json({ ok: false, error: 'admin_dependencies_unavailable' }, 500);
    }
    const users = await deps.authUsersRepository.listForAdmin({ limit: 500 });
    const shops = deps.shopsRepository ? await deps.shopsRepository.list({ limit: 1000 }).catch(() => []) : [];
    const shopsById = new Map(shops.map((shop) => [shop.id, shop]));
    const usersWithShop = users.map((user) => {
      const shop = user.shopId ? shopsById.get(user.shopId) : null;
      return {
        ...user,
        shopName: shop?.name ?? null,
        shopBrandSlug: shop?.brand_slug ?? null,
      };
    });
    const activeAdmins = usersWithShop.filter((u) => u.role === 'admin' && u.active);
    const mfaEnabled = usersWithShop.filter((u) => u.mfaEnabled).length;
    const stats = {
      total: usersWithShop.length,
      adminTotal: usersWithShop.filter((u) => u.role === 'admin').length,
      activeAdminCount: activeAdmins.length,
      mfaEnabledCount: mfaEnabled,
      mfaPercent: usersWithShop.length ? Math.round((mfaEnabled / usersWithShop.length) * 100) : 0,
    };
    return c.json({ ok: true, users: usersWithShop, stats });
  });

  app.patch(path('/admin/users/:id'), async (c) => {
    const csrfBlocked = enforceSameOriginForCookieMutation(c);
    if (csrfBlocked) return csrfBlocked;
    const limited = await enforceRateLimit(c, RATE_LIMIT_POLICIES.admin_mutation, 'admin_user_patch');
    if (limited) return limited;
    const sessionResult = await requireSession(c, 'admin');
    if (sessionResult instanceof Response) return sessionResult;
    if (!deps.authUsersRepository) {
      return c.json({ ok: false, error: 'admin_dependencies_unavailable' }, 500);
    }
    const userId = parseAdminResourceUuid(c.req.param('id'));
    if (!userId) return c.json({ ok: false, error: 'invalid_user_id' }, 400);
    const body = await c.req.json().catch(() => null);
    const parsed = adminUserPatchSchema.safeParse(body);
    if (!parsed.success) return c.json({ ok: false, error: 'invalid_payload' }, 400);

    const existing = await deps.authUsersRepository.findById(userId);
    if (!existing) return c.json({ ok: false, error: 'user_not_found' }, 404);

    const isAdminSeat = existing.role === 'admin' && existing.active;
    const willLoseAdminSeat =
      (parsed.data.role === 'user' && existing.role === 'admin') ||
      (parsed.data.active === false && existing.role === 'admin');

    if (isAdminSeat && willLoseAdminSeat) {
      const directory = await deps.authUsersRepository.listForAdmin({ limit: 500 });
      const otherActiveAdmins = directory.filter(
        (u) => u.id !== userId && u.role === 'admin' && u.active,
      );
      if (otherActiveAdmins.length === 0) {
        return c.json({ ok: false, error: 'last_active_admin' }, 400);
      }
    }

    const updated = await deps.authUsersRepository.updateUserAdmin(userId, {
      role: parsed.data.role,
      active: parsed.data.active,
    });
    if (!updated) return c.json({ ok: false, error: 'user_not_found' }, 404);

    securityAudit({
      action: 'admin_user_updated',
      actorType: 'admin',
      actorId: sessionResult.email,
      ip: getClientIp({ get: (name: string) => c.req.header(name) ?? null }),
      path: c.req.path,
      details: {
        targetUserId: userId,
        patch: parsed.data,
      },
    });

    return c.json({ ok: true, user: updated });
  });

  app.post(path('/admin/users/:id/password'), async (c) => {
    const csrfBlocked = enforceSameOriginForCookieMutation(c);
    if (csrfBlocked) return csrfBlocked;
    const limited = await enforceRateLimit(c, RATE_LIMIT_POLICIES.admin_mutation, 'admin_user_password');
    if (limited) return limited;
    const sessionResult = await requireSession(c, 'admin');
    if (sessionResult instanceof Response) return sessionResult;
    const actorLimited = await enforceRateLimitWithIdentity(
      c,
      RATE_LIMIT_POLICIES.admin_user_password_set_by_actor,
      `pw:${sessionResult.email.toLowerCase()}`,
    );
    if (actorLimited) return actorLimited;
    if (!deps.authUsersRepository) {
      return c.json({ ok: false, error: 'admin_dependencies_unavailable' }, 500);
    }
    const userId = parseAdminResourceUuid(c.req.param('id'));
    if (!userId) return c.json({ ok: false, error: 'invalid_user_id' }, 400);
    const body = await c.req.json().catch(() => null);
    const parsed = adminUserSetPasswordSchema.safeParse(body);
    if (!parsed.success) return c.json({ ok: false, error: 'invalid_payload' }, 400);

    const existing = await deps.authUsersRepository.findById(userId);
    if (!existing) return c.json({ ok: false, error: 'user_not_found' }, 404);

    await deps.authUsersRepository.updatePasswordHash(userId, hashPassword(parsed.data.newPassword));

    securityAudit({
      action: 'admin_user_password_set',
      actorType: 'admin',
      actorId: sessionResult.email,
      ip: getClientIp({ get: (name: string) => c.req.header(name) ?? null }),
      path: c.req.path,
      details: {
        targetUserId: userId,
        targetEmail: existing.email,
      },
    });

    return c.json({ ok: true });
  });

  app.post(path('/admin/users/invite'), async (c) => {
    const csrfBlocked = enforceSameOriginForCookieMutation(c);
    if (csrfBlocked) return csrfBlocked;
    const limited = await enforceRateLimit(c, RATE_LIMIT_POLICIES.admin_mutation, 'admin_invite');
    if (limited) return limited;
    const sessionResult = await requireSession(c, 'admin');
    if (sessionResult instanceof Response) return sessionResult;
    const actorLimited = await enforceRateLimitWithIdentity(
      c,
      RATE_LIMIT_POLICIES.admin_user_invite_by_actor,
      `invite:${sessionResult.email.toLowerCase()}`,
    );
    if (actorLimited) return actorLimited;
    if (!deps.authUsersRepository) {
      return c.json({ ok: false, error: 'admin_dependencies_unavailable' }, 500);
    }
    const body = await c.req.json().catch(() => null);
    const parsed = adminInviteSchema.safeParse(body);
    if (!parsed.success) return c.json({ ok: false, error: 'invalid_payload' }, 400);

    const email = parsed.data.email.toLowerCase();
    const existing = await deps.authUsersRepository.findByEmail(email);
    if (existing) {
      return c.json({ ok: false, error: 'email_already_exists' }, 409);
    }

    const bootstrapPassword = randomBytes(24).toString('hex');
    const created = await deps.authUsersRepository.create({
      email,
      role: 'admin',
      shopId: parsed.data.shopId ?? null,
      passwordHash: hashPassword(bootstrapPassword),
      active: true,
      mfaEnabled: false,
    });

    const resetToken = `${randomUUID()}${randomBytes(12).toString('hex')}`;
    await deps.authUsersRepository.createPasswordResetToken({
      userId: created.id,
      tokenHash: hashPasswordResetToken(resetToken),
      expiresAt: new Date(Date.now() + 24 * 60 * 60_000),
    });
    securityAudit({
      action: 'admin_user_invited',
      actorType: 'admin',
      actorId: sessionResult.email,
      ip: getClientIp({ get: (name: string) => c.req.header(name) ?? null }),
      path: c.req.path,
      details: {
        invitedEmail: email,
        invitedUserId: created.id,
      },
    });

    return c.json({
      ok: true,
      invited: true,
      email,
      role: created.role,
      ...(process.env.NODE_ENV !== 'production' ? { resetToken } : {}),
    });
  });
}
