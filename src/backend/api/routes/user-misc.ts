import { randomUUID } from 'node:crypto';

import type { Hono } from 'hono';

import { getEnv } from '@/src/backend/config/env';
import {
  buildApplyPatchForSuggestions,
  pendingSuggestionsFromImport,
  secondarySummary,
  validateSuggestionPayload,
} from '@/src/backend/domain/business-knowledge-suggestions';
import { mergeImportedServicesIntoCatalog } from '@/src/backend/domain/service-catalog';
import { isShopSetupWizardComplete } from '@/src/backend/domain/shop-onboarding';
import { logger } from '@/src/backend/observability/logger';
import type {
  AuthUsersRepository,
  BillingSubscriptionsRepository,
  BookingsRepository,
  BusinessKnowledgeSuggestionsRepository,
  CallLogsRepository,
  CommercialAccountsRepository,
  ShopAccessStatesRepository,
  ShopActiveCallSessionsRepository,
  ShopsRepository,
  TestCallAttemptsRepository,
} from '@/src/backend/ports/repositories';
import {
  getShopBillingAccess,
  isBillingTrialStillValid,
  type BillingBlockReason,
  type ShopBillingAccess,
} from '@/src/backend/services/billing/access';
import { resolveGoLiveDashboardPrimaryCta } from '@/src/backend/services/billing/go-live-dashboard';
import { getShopUsageForPeriod } from '@/src/backend/services/usage/shop-usage';
import {
  buildDashboardOverviewRail,
  resolveCalendarBookingStatus,
  shopHasConfiguredBusinessHours,
  shopHasConfiguredServices,
} from '@/src/backend/services/user/dashboard-overview-rail';
import {
  buildUserPortalNotifications,
  type UserPortalNotificationsUsageInput,
} from '@/src/backend/services/user/user-portal-notifications';
import { importWebsiteWithCache } from '@/src/backend/services/website-import/cache';
import { websiteImportErrorMessage } from '@/src/backend/services/website-import/error-messages';
import { importWebsiteForOnboarding } from '@/src/backend/services/website-import/importer';
import {
  acquireWebsiteImportLlmBudget,
  applyBusinessKnowledgeSuggestionsSchema,
  enforceRateLimit,
  enforceSameOriginForCookieMutation,
  importWebsiteSchema,
  RATE_LIMIT_POLICIES,
  readWebsiteSchema,
  requireSession,
  suggestionIdListSchema,
  toUserFacingServiceCatalog,
  WEBSITE_IMPORT_BUDGET_MS,
} from '../app-shared';

type UserMiscDeps = {
  shopsRepository?: ShopsRepository;
  bookingsRepository?: BookingsRepository;
  callLogsRepository?: CallLogsRepository;
  authUsersRepository?: AuthUsersRepository;
  commercialAccountsRepository?: CommercialAccountsRepository;
  shopActiveCallSessionsRepository?: ShopActiveCallSessionsRepository;
  billingSubscriptionsRepository?: BillingSubscriptionsRepository;
  shopAccessStatesRepository?: ShopAccessStatesRepository;
  testCallAttemptsRepository?: TestCallAttemptsRepository;
  businessKnowledgeSuggestionsRepository?: BusinessKnowledgeSuggestionsRepository;
};

export function registerUserMiscRoutes(
  app: Hono,
  path: (route: string) => string,
  deps: UserMiscDeps,
) {
  app.get(path('/user/dashboard'), async (c) => {
    const limited = await enforceRateLimit(c, RATE_LIMIT_POLICIES.user_api, 'user_dashboard');
    if (limited) return limited;
    const sessionResult = await requireSession(c, 'user');
    if (sessionResult instanceof Response) return sessionResult;
    if (!deps.shopsRepository || !deps.bookingsRepository || !deps.callLogsRepository) {
      return c.json({ ok: false, error: 'user_dependencies_unavailable' }, 500);
    }

    const shop = await deps.shopsRepository.findById(sessionResult.shopId ?? '');
    if (!shop) return c.json({ ok: false, error: 'shop_not_found' }, 404);
    const sessionAuthUser = deps.authUsersRepository
      ? await deps.authUsersRepository.findByEmail(sessionResult.email).catch(() => null)
      : null;
    const sessionEmailVerified = Boolean(sessionAuthUser?.emailVerifiedAt ?? sessionResult.emailVerified);
    const [bookingCount, callCount, missedCalls, commercialAccount, recentCallRows] = await Promise.all([
      deps.bookingsRepository.countByShop(shop.id),
      deps.callLogsRepository.countByShop(shop.id, {}),
      deps.callLogsRepository.countByShop(shop.id, { outcome: 'missed' }),
      deps.commercialAccountsRepository ? deps.commercialAccountsRepository.findByShopId(shop.id).catch(() => null) : Promise.resolve(null),
      deps.callLogsRepository.listByShop(shop.id, { limit: 3 }),
    ]);
    let usage: Awaited<ReturnType<typeof getShopUsageForPeriod>> | null = null;
    let usageTimedOut = false;
    let usageTimeout: ReturnType<typeof setTimeout> | null = null;
    const usageTimeoutPromise = new Promise<null>((resolve) => {
      usageTimeout = setTimeout(() => {
        usageTimedOut = true;
        logger.warn({ shopId: shop.id }, 'user_dashboard_usage_timeout');
        resolve(null);
      }, 2500);
    });
    usage = await Promise.race([
      getShopUsageForPeriod(
        {
          callLogsRepository: deps.callLogsRepository,
          shopActiveCallSessionsRepository: deps.shopActiveCallSessionsRepository,
          billingSubscriptionsRepository: deps.billingSubscriptionsRepository,
        },
        { shop, commercialAccount },
      ).catch((err) => {
        logger.warn({ err, shopId: shop.id }, 'user_dashboard_usage_unavailable');
        return null;
      }),
      usageTimeoutPromise,
    ]);
    if (!usageTimedOut && usageTimeout) clearTimeout(usageTimeout);

    let goLive: {
      liveCallsEnabled: boolean;
      primaryCta: ReturnType<typeof resolveGoLiveDashboardPrimaryCta>;
      forwardingSetupVerified: boolean;
      forwardingConfigured: boolean;
      hasForwardingNumber: boolean;
      paymentMethodValid: boolean;
      subscriptionActiveLike: boolean;
      billingTrialing: boolean;
      emailVerified: boolean;
      blockReason: BillingBlockReason;
      commercialGoLiveApproved: boolean;
      commercialApprovalRequired: boolean;
      billing: {
        subscriptionStatus: NonNullable<ShopBillingAccess['subscriptionStatus']> | 'none';
        paymentMethodStatus: ShopBillingAccess['paymentMethodStatus'];
      };
    } | null = null;

    if (deps.billingSubscriptionsRepository && deps.shopAccessStatesRepository) {
      const access = await getShopBillingAccess(
        {
          shopsRepository: deps.shopsRepository,
          billingSubscriptionsRepository: deps.billingSubscriptionsRepository,
          shopAccessStatesRepository: deps.shopAccessStatesRepository,
          testCallAttemptsRepository: deps.testCallAttemptsRepository,
        },
        { shopId: shop.id },
      );
      const subscription = await deps.billingSubscriptionsRepository.findCurrentByShopId(shop.id);
      const accessState = await deps.shopAccessStatesRepository.findByShopId(shop.id);
      const forwardingVerified = Boolean((accessState?.forwardingVerifiedAt ?? accessState?.forwardingSetupVerifiedAt)?.trim());
      const forwardingConfigured = Boolean(accessState?.forwardingClaimedAt?.trim());
      const now = new Date();
      const commercialApprovalRequired = access.blockReason === 'commercial_approval_required';
      goLive = {
        liveCallsEnabled: access.liveCallsEnabled,
        primaryCta: commercialApprovalRequired ? null : resolveGoLiveDashboardPrimaryCta({
          liveCallsEnabled: access.liveCallsEnabled,
          subscription,
          paymentMethodStatus: access.paymentMethodStatus,
          hasForwardingNumber: access.hasForwardingNumber,
          forwardingSetupVerified: forwardingVerified,
          now,
        }),
        forwardingSetupVerified: forwardingVerified,
        forwardingConfigured,
        hasForwardingNumber: access.hasForwardingNumber,
        paymentMethodValid: access.paymentMethodStatus === 'valid',
        subscriptionActiveLike:
          subscription?.status === 'active' || (subscription ? isBillingTrialStillValid(subscription, now) : false),
        billingTrialing: Boolean(
          subscription?.status === 'trialing' && subscription && isBillingTrialStillValid(subscription, now),
        ),
        emailVerified: sessionEmailVerified,
        blockReason: access.blockReason,
        commercialGoLiveApproved: access.commercialGoLiveApproved,
        commercialApprovalRequired,
        billing: {
          subscriptionStatus: subscription?.status ?? 'none',
          paymentMethodStatus: access.paymentMethodStatus,
        },
      };
    }

    const onboardingRequired = !isShopSetupWizardComplete(shop);
    const recentCalls = recentCallRows.map((row) => ({
      requestId: row.requestId,
      startedAt: row.startedAt,
      callerPhone: row.callerPhone,
      outcome: row.outcome,
      subtitle: row.summaryServiceRequest ?? null,
    }));

    const overviewRail = buildDashboardOverviewRail({
      shop,
      onboardingRequired,
      goLive,
      usage: usage
        ? {
            nearCapturedCallerLimit: usage.nearCapturedCallerLimit,
            overCapturedCallerLimit: usage.overCapturedCallerLimit,
          }
        : null,
      recentCalls,
      totalCallCount: callCount,
    });

    const calendarBooking = resolveCalendarBookingStatus(shop);
    const overviewSnapshot = {
      hasServices: shopHasConfiguredServices(shop),
      hasHours: shopHasConfiguredBusinessHours(shop),
      integrationConnected: calendarBooking.ready,
      integrationLabel: calendarBooking.detail,
    };

    return c.json({
      ok: true,
      shop: {
        id: shop.id,
        name: shop.name,
        phone_number: shop.phone_number,
        address: shop.address ?? null,
        timezone: shop.timezone,
        plan: shop.plan,
        active: shop.active,
        allow_transfers: shop.allow_transfers,
        handoff_phone: shop.handoff_phone ?? null,
      },
      onboardingRequired,
      onboardingCompleted: isShopSetupWizardComplete(shop),
      metrics: {
        bookingCount,
        callCount,
        missedCalls,
      },
      usage,
      goLive,
      overviewRail,
      overviewSnapshot,
    });
  });

  app.get(path('/user/notifications'), async (c) => {
    const limited = await enforceRateLimit(c, RATE_LIMIT_POLICIES.user_api, 'user_notifications');
    if (limited) return limited;
    const sessionResult = await requireSession(c, 'user');
    if (sessionResult instanceof Response) return sessionResult;
    if (!deps.shopsRepository) {
      return c.json({ ok: false, error: 'user_dependencies_unavailable' }, 500);
    }

    const shop = await deps.shopsRepository.findById(sessionResult.shopId ?? '');
    if (!shop) return c.json({ ok: false, error: 'shop_not_found' }, 404);

    if (
      !deps.billingSubscriptionsRepository ||
      !deps.shopAccessStatesRepository ||
      !deps.testCallAttemptsRepository
    ) {
      return c.json({ ok: true, notifications: [] });
    }

    const now = new Date();
    const subscription = await deps.billingSubscriptionsRepository.findCurrentByShopId(shop.id);
    const access = await getShopBillingAccess(
      {
        shopsRepository: deps.shopsRepository,
        billingSubscriptionsRepository: deps.billingSubscriptionsRepository,
        shopAccessStatesRepository: deps.shopAccessStatesRepository,
        testCallAttemptsRepository: deps.testCallAttemptsRepository,
      },
      { shopId: shop.id },
    );

    let usage: UserPortalNotificationsUsageInput = null;
    if (deps.callLogsRepository) {
      const commercialAccount = deps.commercialAccountsRepository
        ? await deps.commercialAccountsRepository.findByShopId(shop.id).catch(() => null)
        : null;
      const usageRow = await getShopUsageForPeriod(
        {
          callLogsRepository: deps.callLogsRepository,
          shopActiveCallSessionsRepository: deps.shopActiveCallSessionsRepository,
          billingSubscriptionsRepository: deps.billingSubscriptionsRepository,
        },
        { shop, commercialAccount },
      ).catch(() => null);
      if (usageRow) {
        usage = {
          nearCapturedCallerLimit: usageRow.nearCapturedCallerLimit,
          overCapturedCallerLimit: usageRow.overCapturedCallerLimit,
          capturedCallersUsed: usageRow.capturedCallersUsed,
          capturedCallersLimit: usageRow.capturedCallersLimit,
        };
      }
    }

    const notifications = buildUserPortalNotifications({
      access,
      subscription,
      usage,
      now,
      shopTimezone: shop.timezone,
    });

    return c.json({ ok: true, notifications });
  });

  app.get(path('/user/onboarding-status'), async (c) => {
    const limited = await enforceRateLimit(c, RATE_LIMIT_POLICIES.user_api, 'user_onboarding_status');
    if (limited) return limited;
    const sessionResult = await requireSession(c, 'user');
    if (sessionResult instanceof Response) return sessionResult;
    if (!deps.shopsRepository) {
      return c.json({ ok: false, error: 'user_dependencies_unavailable' }, 500);
    }

    const shop = await deps.shopsRepository.findById(sessionResult.shopId ?? '');
    if (!shop) return c.json({ ok: false, error: 'shop_not_found' }, 404);

    let paymentMethodStatus: ShopBillingAccess['paymentMethodStatus'] = 'none';
    let liveCallsEnabled = false;
    let forwardingSetupVerified = false;
    if (deps.billingSubscriptionsRepository && deps.shopAccessStatesRepository) {
      const access = await getShopBillingAccess(
        {
          shopsRepository: deps.shopsRepository,
          billingSubscriptionsRepository: deps.billingSubscriptionsRepository,
          shopAccessStatesRepository: deps.shopAccessStatesRepository,
          testCallAttemptsRepository: deps.testCallAttemptsRepository,
        },
        { shopId: shop.id },
      );
      paymentMethodStatus = access.paymentMethodStatus;
      liveCallsEnabled = access.liveCallsEnabled;
      forwardingSetupVerified = access.forwardingSetupVerified;
    }

    const onboardingCompleted = isShopSetupWizardComplete(shop);
    const serviceCatalogEnabled = getEnv().SERVICE_CATALOG_ENABLED;

    return c.json({
      ok: true,
      onboardingRequired: !onboardingCompleted,
      onboardingCompleted,
      liveCallsEnabled,
      forwardingSetupVerified,
      paymentMethodStatus,
      serviceCatalogEnabled,
      shop: {
        id: shop.id,
        name: shop.name,
        vertical: shop.vertical ?? null,
        vertical_detail: shop.vertical_detail ?? null,
        phone_number: shop.phone_number,
        user_name: shop.user_name ?? '',
        user_phone: shop.user_phone ?? '',
        timezone: shop.timezone,
        cancel_policy: shop.cancel_policy,
        services: shop.services,
        service_catalog: serviceCatalogEnabled ? toUserFacingServiceCatalog(shop.service_catalog) : null,
        hours: shop.hours,
        languages: shop.languages ?? ['en'],
        website_url: shop.website_url ?? '',
        address: shop.address ?? null,
        booking_url: shop.booking_url ?? '',
        booking_method: shop.booking_method ?? null,
        selected_integration: shop.selected_integration ?? null,
        current_onboarding_step: shop.current_onboarding_step ?? 1,
        setup_method: shop.setup_method ?? null,
        forwarding_type: shop.forwarding_type ?? 'no_answer',
        forwarding_carrier: shop.forwarding_carrier ?? null,
        forwarding_country: shop.forwarding_country ?? 'us',
        telnyx_number: shop.telnyx_number ?? '',
        plan: shop.plan,
      },
    });
  });

  app.post(path('/user/onboarding/import-website'), async (c) => {
    const csrfBlocked = enforceSameOriginForCookieMutation(c);
    if (csrfBlocked) return csrfBlocked;
    const limited = await enforceRateLimit(c, RATE_LIMIT_POLICIES.user_website_import, 'user_onboarding_import_website');
    if (limited) return limited;
    const sessionResult = await requireSession(c, 'user');
    if (sessionResult instanceof Response) return sessionResult;
    if (!deps.shopsRepository) {
      return c.json({ ok: false, error: 'user_dependencies_unavailable' }, 500);
    }

    const body = await c.req.json().catch(() => null);
    const parsed = importWebsiteSchema.safeParse(body);
    if (!parsed.success) return c.json({ ok: false, error: 'invalid_payload' }, 400);

    const shop = await deps.shopsRepository.findById(sessionResult.shopId ?? '');
    if (!shop) return c.json({ ok: false, error: 'shop_not_found' }, 404);
    if (!getEnv().WEBSITE_IMPORT_ENABLED) {
      return c.json({ ok: false, error: 'website_import_disabled' }, 503);
    }

    try {
      const env = getEnv();
      const result = await importWebsiteWithCache({ url: parsed.data.url, qualityBudgetMs: WEBSITE_IMPORT_BUDGET_MS }, () =>
        importWebsiteForOnboarding({ url: parsed.data.url }, {
          // `googlePlacesApiKey` option name unchanged in importer.ts — value now points at Serper (google-places.ts calls Serper internally).
          googlePlacesApiKey: env.SERPER_API_KEY,
          llmEnabled: env.WEBSITE_IMPORT_LLM_ENABLED,
          openAiApiKey: env.OPENAI_API_KEY,
          llmModel: env.WEBSITE_IMPORT_LLM_MODEL,
          llmMaxTokens: env.WEBSITE_IMPORT_LLM_MAX_TOKENS,
          serviceRetryEnabled: env.WEBSITE_IMPORT_SERVICE_RETRY_ENABLED,
          serviceRetryModel: env.WEBSITE_IMPORT_SERVICE_RETRY_MODEL,
          difficultFallbackModel: env.WEBSITE_IMPORT_DIFFICULT_FALLBACK_MODEL,
          serviceRetryMaxPages: env.WEBSITE_IMPORT_SERVICE_RETRY_MAX_PAGES,
          serviceRetryTimeoutMs: env.WEBSITE_IMPORT_SERVICE_RETRY_TIMEOUT_MS,
          serviceRetryMinServiceCount: env.WEBSITE_IMPORT_SERVICE_RETRY_MIN_SERVICE_COUNT,
          policyRetryEnabled: env.WEBSITE_IMPORT_POLICY_RETRY_ENABLED,
          policyRetryModel: env.WEBSITE_IMPORT_POLICY_RETRY_MODEL,
          policyRetryFallbackModel: env.WEBSITE_IMPORT_POLICY_RETRY_FALLBACK_MODEL,
          policyRetryMaxPages: env.WEBSITE_IMPORT_POLICY_RETRY_MAX_PAGES,
          policyRetryTimeoutMs: env.WEBSITE_IMPORT_POLICY_RETRY_TIMEOUT_MS,
          policyRetryMinPolicyCount: env.WEBSITE_IMPORT_POLICY_RETRY_MIN_POLICY_COUNT,
          debugLog: env.WEBSITE_IMPORT_DEBUG_LOG,
          debugSaveText: env.WEBSITE_IMPORT_DEBUG_SAVE_TEXT,
          maxBytes: env.WEBSITE_IMPORT_MAX_BYTES,
          renderEndpoint: env.WEBSITE_IMPORT_RENDER_URL,
          renderApiKey: env.WEBSITE_IMPORT_RENDER_API_KEY,
          acquireLlmBudget: acquireWebsiteImportLlmBudget,
          deadlineMs: WEBSITE_IMPORT_BUDGET_MS,
        }),
      );
      if (result.diagnostics.warnings.length > 0) {
        logger.info({ shopId: shop.id, warnings: [...new Set([...result.diagnostics.warnings, ...result.suggestions.warnings])], selectedPageCount: result.diagnostics.selectedPages.length }, 'website_import_completed_with_warnings');
      }
      // Analytics for how often each source is pasted and how often each Maps failure mode fires.
      logger.info({ shopId: shop.id, sourceType: result.suggestions.sourceType, errorCode: result.errorCode ?? null }, 'website_import_classified');
      // Persist country_code when Google Places resolves it — used for Telnyx provisioning and SMS sender selection.
      const importedCountry = result.suggestions.country?.toUpperCase() ?? null;
      if (importedCountry && importedCountry !== (shop.country_code ?? 'US')) {
        await deps.shopsRepository.updateUserSettings(shop.id, { country_code: importedCountry }).catch(() => undefined);
      }
      const secondaryCreates = pendingSuggestionsFromImport(result.suggestions);
      if (secondaryCreates.length > 0 && deps.businessKnowledgeSuggestionsRepository) {
        try {
          await deps.businessKnowledgeSuggestionsRepository.createPendingSuggestions(shop.id, result.suggestions.sourceUrl, secondaryCreates);
        } catch (err) {
          logger.warn({ err, shopId: shop.id, suggestionCount: secondaryCreates.length }, 'business_knowledge_suggestions_persist_failed');
        }
      }
      return c.json({
        ok: result.ok,
        suggestions: result.suggestions,
        secondarySuggestionsSummary: secondarySummary(result.suggestions),
        warnings: [...new Set([...result.diagnostics.warnings, ...result.suggestions.warnings])],
        ...(result.errorCode ? { error: result.errorCode, message: websiteImportErrorMessage(result.errorCode) } : {}),
      });
    } catch (err) {
      logger.warn({ err, shopId: shop.id }, 'website_import_failed');
      return c.json({
        ok: false,
        error: 'website_import_failed',
        message: 'We could not read that website right now. You can continue manually.',
      }, 200);
    }
  });

  app.get(path('/user/business-knowledge/suggestions'), async (c) => {
    const limited = await enforceRateLimit(c, RATE_LIMIT_POLICIES.user_api, 'user_business_knowledge_suggestions_get');
    if (limited) return limited;
    const sessionResult = await requireSession(c, 'user');
    if (sessionResult instanceof Response) return sessionResult;
    if (!deps.businessKnowledgeSuggestionsRepository) return c.json({ ok: false, error: 'suggestions_repository_unavailable' }, 500);
    const suggestions = await deps.businessKnowledgeSuggestionsRepository.listPendingSuggestions(sessionResult.shopId ?? '');
    const counts = suggestions.reduce<Record<string, number>>((acc, item) => {
      acc[item.suggestionType] = (acc[item.suggestionType] ?? 0) + 1;
      return acc;
    }, {});
    return c.json({
      ok: true,
      suggestions: suggestions.map((item) => ({
        id: item.id,
        sourceUrl: item.sourceUrl,
        suggestionType: item.suggestionType,
        payload: item.payload,
        confidence: item.confidence,
        source: item.source,
        evidenceSnippet: item.evidenceSnippet,
        createdAt: item.createdAt,
      })),
      counts,
    });
  });

  app.post(path('/user/business-knowledge/suggestions/apply'), async (c) => {
    const csrfBlocked = enforceSameOriginForCookieMutation(c);
    if (csrfBlocked) return csrfBlocked;
    const limited = await enforceRateLimit(c, RATE_LIMIT_POLICIES.user_api, 'user_business_knowledge_suggestions_apply');
    if (limited) return limited;
    const sessionResult = await requireSession(c, 'user');
    if (sessionResult instanceof Response) return sessionResult;
    if (!deps.businessKnowledgeSuggestionsRepository || !deps.shopsRepository) return c.json({ ok: false, error: 'suggestions_dependencies_unavailable' }, 500);
    const body = await c.req.json().catch(() => null);
    const parsed = applyBusinessKnowledgeSuggestionsSchema.safeParse(body);
    if (!parsed.success) return c.json({ ok: false, error: 'invalid_payload' }, 400);
    const shop = await deps.shopsRepository.findById(sessionResult.shopId ?? '');
    if (!shop) return c.json({ ok: false, error: 'shop_not_found' }, 404);
    const ids = [...new Set(parsed.data.suggestionIds)];
    const suggestions = await deps.businessKnowledgeSuggestionsRepository.findByIds(shop.id, ids);
    if (suggestions.length !== ids.length) return c.json({ ok: false, error: 'suggestion_not_found' }, 404);
    if (suggestions.some((item) => item.status !== 'pending')) return c.json({ ok: false, error: 'suggestion_not_pending' }, 400);
    for (const [id, payload] of Object.entries(parsed.data.editedPayloads ?? {})) {
      const suggestion = suggestions.find((item) => item.id === id);
      if (!suggestion) return c.json({ ok: false, error: 'invalid_edited_payload' }, 400);
      if (!validateSuggestionPayload(suggestion.suggestionType, payload)) return c.json({ ok: false, error: 'invalid_edited_payload' }, 400);
    }
    const patch = buildApplyPatchForSuggestions(shop, suggestions, parsed.data.editedPayloads);
    if (patch) {
      const updated = await deps.shopsRepository.updateUserSettings(shop.id, patch);
      if (!updated) return c.json({ ok: false, error: 'shop_not_found' }, 404);
    }
    const applied = await deps.businessKnowledgeSuggestionsRepository.markApplied(shop.id, ids);
    return c.json({ ok: true, appliedCount: applied.length });
  });

  app.post(path('/user/business-knowledge/suggestions/dismiss'), async (c) => {
    const csrfBlocked = enforceSameOriginForCookieMutation(c);
    if (csrfBlocked) return csrfBlocked;
    const limited = await enforceRateLimit(c, RATE_LIMIT_POLICIES.user_api, 'user_business_knowledge_suggestions_dismiss');
    if (limited) return limited;
    const sessionResult = await requireSession(c, 'user');
    if (sessionResult instanceof Response) return sessionResult;
    if (!deps.businessKnowledgeSuggestionsRepository) return c.json({ ok: false, error: 'suggestions_repository_unavailable' }, 500);
    const body = await c.req.json().catch(() => null);
    const parsed = suggestionIdListSchema.safeParse(body);
    if (!parsed.success) return c.json({ ok: false, error: 'invalid_payload' }, 400);
    const ids = [...new Set(parsed.data.suggestionIds)];
    const suggestions = await deps.businessKnowledgeSuggestionsRepository.findByIds(sessionResult.shopId ?? '', ids);
    if (suggestions.length !== ids.length) return c.json({ ok: false, error: 'suggestion_not_found' }, 404);
    if (suggestions.some((item) => item.status !== 'pending')) return c.json({ ok: false, error: 'suggestion_not_pending' }, 400);
    const dismissed = await deps.businessKnowledgeSuggestionsRepository.markDismissed(sessionResult.shopId ?? '', ids);
    return c.json({ ok: true, dismissedCount: dismissed.length });
  });

  // Legacy mutating website import endpoint. Do not use this for onboarding review:
  // `/user/onboarding/import-website` is the suggestions-only flow that waits for user confirmation.
  app.post(path('/user/read-website'), async (c) => {
    const csrfBlocked = enforceSameOriginForCookieMutation(c);
    if (csrfBlocked) return csrfBlocked;
    const limited = await enforceRateLimit(c, RATE_LIMIT_POLICIES.user_api, 'user_read_website');
    if (limited) return limited;
    const sessionResult = await requireSession(c, 'user');
    if (sessionResult instanceof Response) return sessionResult;
    if (!deps.shopsRepository) {
      return c.json({ ok: false, error: 'user_dependencies_unavailable' }, 500);
    }

    const body = await c.req.json().catch(() => null);
    const parsed = readWebsiteSchema.safeParse(body);
    if (!parsed.success) return c.json({ ok: false, error: 'invalid_payload' }, 400);

    const shop = await deps.shopsRepository.findById(sessionResult.shopId ?? '');
    if (!shop) return c.json({ ok: false, error: 'shop_not_found' }, 404);
    const serviceCatalogEnabled = getEnv().SERVICE_CATALOG_ENABLED;

    const updated = await deps.shopsRepository.updateUserSettings(sessionResult.shopId ?? '', {
      website_url: parsed.data.url,
    });
    if (!updated) return c.json({ ok: false, error: 'shop_not_found' }, 404);

    let servicesFound = 0;
    if (serviceCatalogEnabled && parsed.data.services?.length) {
      const currentCatalog = await deps.shopsRepository.findServiceCatalogByShopId(shop.id);
      const merged = mergeImportedServicesIntoCatalog({
        shopId: shop.id,
        currentCatalog,
        importedServices: parsed.data.services,
        vertical: shop.vertical,
        idForCategory: () => randomUUID(),
        idForService: () => randomUUID(),
      });
      servicesFound = merged.addedCount;
      if (servicesFound > 0) {
        await deps.shopsRepository.saveServiceCatalog(shop.id, merged.catalog);
      }
    }

    return c.json({
      ok: true,
      success: true,
      servicesFound,
      imported: servicesFound > 0,
      todo: !serviceCatalogEnabled && parsed.data.services?.length ? 'service_catalog_disabled' : parsed.data.services?.length ? undefined : 'website_scraping_not_implemented',
    });
  });
}
