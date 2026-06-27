import type { Hono } from 'hono';

import { getCountryConfig } from '@/lib/countries/config';
import { normalizePhoneForStorage } from '@/lib/phone-number';
import { getEnv } from '@/src/backend/config/env';
import {
  CAPABILITY_LABELS,
  CAPABILITY_MIN_PLAN,
  getShopPlanCapabilities,
} from '@/src/backend/domain/shop-plan-capabilities';
import { logger } from '@/src/backend/observability/logger';
import type {
  AuthUsersRepository,
  BillingSubscriptionsRepository,
  ShopAccessStatesRepository,
  ShopsRepository,
  TestCallAttemptsRepository,
} from '@/src/backend/ports/repositories';
import { securityAudit } from '@/src/backend/security/audit-log';
import { hashPassword, verifyPassword } from '@/src/backend/security/password';
import {
  computeShowGoLiveSettingsTab,
  enforceRateLimit,
  enforceSameOriginForCookieMutation,
  getClientIp,
  normalizeHttpsBookingUrl,
  normalizeServiceCatalogForShop,
  RATE_LIMIT_POLICIES,
  requireSession,
  splitUserSettingsPatchByPlan,
  toUserFacingShop,
  USER_SETTING_FIELD_CAPABILITIES,
  userPasswordChangeSchema,
  userSettingsDuplicateConflict,
  userSettingsUpdateSchema,
} from '../app-shared';

type UserSettingsDeps = {
  shopsRepository?: ShopsRepository;
  shopAccessStatesRepository?: ShopAccessStatesRepository;
  billingSubscriptionsRepository?: BillingSubscriptionsRepository;
  testCallAttemptsRepository?: TestCallAttemptsRepository;
  authUsersRepository?: AuthUsersRepository;
};

export function registerUserSettingsRoutes(
  app: Hono,
  path: (route: string) => string,
  deps: UserSettingsDeps,
) {
  app.get(path('/user/settings'), async (c) => {
    const limited = await enforceRateLimit(c, RATE_LIMIT_POLICIES.user_api, 'user_settings_get');
    if (limited) return limited;
    const sessionResult = await requireSession(c, 'user');
    if (sessionResult instanceof Response) return sessionResult;
    if (!deps.shopsRepository) {
      return c.json({ ok: false, error: 'user_dependencies_unavailable' }, 500);
    }

    const shop = await deps.shopsRepository.findById(sessionResult.shopId ?? '');
    if (!shop) return c.json({ ok: false, error: 'shop_not_found' }, 404);
    const serviceCatalogEnabled = getEnv().SERVICE_CATALOG_ENABLED;
    const showGoLiveSettingsTab = await computeShowGoLiveSettingsTab({
      shop,
      shopsRepository: deps.shopsRepository,
      shopAccessStatesRepository: deps.shopAccessStatesRepository,
      billingSubscriptionsRepository: deps.billingSubscriptionsRepository,
      testCallAttemptsRepository: deps.testCallAttemptsRepository,
    });
    return c.json({
      ok: true,
      shop: serviceCatalogEnabled ? toUserFacingShop(shop) : { ...toUserFacingShop(shop), service_catalog: null },
      capabilities: getShopPlanCapabilities(shop.plan),
      capabilityLabels: CAPABILITY_LABELS,
      capabilityMinPlans: CAPABILITY_MIN_PLAN,
      showGoLiveSettingsTab,
      serviceCatalogEnabled,
    });
  });

  app.put(path('/user/settings'), async (c) => {
    const csrfBlocked = enforceSameOriginForCookieMutation(c);
    if (csrfBlocked) return csrfBlocked;
    const limited = await enforceRateLimit(c, RATE_LIMIT_POLICIES.user_api, 'user_settings_put');
    if (limited) return limited;
    const sessionResult = await requireSession(c, 'user');
    if (sessionResult instanceof Response) return sessionResult;
    if (!deps.shopsRepository) {
      return c.json({ ok: false, error: 'user_dependencies_unavailable' }, 500);
    }

    const body = await c.req.json().catch(() => null);
    const parsed = userSettingsUpdateSchema.safeParse(body);
    if (!parsed.success) {
      return c.json(
        {
          ok: false,
          error: 'invalid_payload',
          fields: Object.keys(parsed.error.flatten().fieldErrors),
        },
        400,
      );
    }
    const settingsPatch = { ...parsed.data };
    if (settingsPatch.email === '') {
      settingsPatch.email = null;
    } else if (typeof settingsPatch.email === 'string') {
      settingsPatch.email = settingsPatch.email.trim().toLowerCase();
    }
    if (settingsPatch.booking_url !== undefined && settingsPatch.booking_url !== null) {
      const bookingUrl = normalizeHttpsBookingUrl(settingsPatch.booking_url);
      if (!bookingUrl) {
        return c.json({ ok: false, error: 'bookingUrl must be a valid https URL', fields: ['booking_url'] }, 400);
      }
      settingsPatch.booking_url = bookingUrl;
    }

    const shop = await deps.shopsRepository.findById(sessionResult.shopId ?? '');
    if (!shop) return c.json({ ok: false, error: 'shop_not_found' }, 404);

    if (settingsPatch.handoff_phone != null) {
      const cc = shop.country_code ?? 'US';
      const normalized = normalizePhoneForStorage(settingsPatch.handoff_phone, cc);
      const countryConfig = getCountryConfig(cc);
      if (!normalized || !normalized.startsWith(countryConfig.phonePrefix)) {
        return c.json(
          { ok: false, error: 'invalid_handoff_phone', fields: ['handoff_phone'] },
          400,
        );
      }
      if (shop.telnyx_number && normalized === normalizePhoneForStorage(shop.telnyx_number, cc)) {
        return c.json(
          { ok: false, error: 'handoff_phone_loop', fields: ['handoff_phone'] },
          400,
        );
      }
    }

    const serviceCatalogPatch = settingsPatch.service_catalog;
    const serviceCatalogEnabled = getEnv().SERVICE_CATALOG_ENABLED;
    if (serviceCatalogPatch && !serviceCatalogEnabled) {
      return c.json({ ok: false, error: 'service_catalog_disabled' }, 503);
    }
    const { basicPatch, dynamicPatch, disallowedFields } = splitUserSettingsPatchByPlan(shop, settingsPatch);
    if (disallowedFields.length > 0) {
      return c.json(
        {
          ok: false,
          error: 'plan_feature_locked',
          fields: disallowedFields,
          requirements: Object.fromEntries(
            disallowedFields.map((field) => [
              field,
              {
                capability: USER_SETTING_FIELD_CAPABILITIES[field],
                label: CAPABILITY_LABELS[USER_SETTING_FIELD_CAPABILITIES[field]],
                minPlan: CAPABILITY_MIN_PLAN[USER_SETTING_FIELD_CAPABILITIES[field]],
              },
            ]),
          ),
        },
        403,
      );
    }

    const hasBasicPatch = Object.keys(basicPatch).some((key) => key !== 'service_catalog');
    const hasDynamicPatch = Object.keys(dynamicPatch).length > 0;
    if (!hasBasicPatch && !hasDynamicPatch && !serviceCatalogPatch) {
      return c.json({ ok: false, error: 'no_changes' }, 400);
    }

    let updated = shop;
    try {
      if (hasBasicPatch) {
        const basicUpdated = await deps.shopsRepository.updateUserSettings(sessionResult.shopId ?? '', basicPatch);
        if (!basicUpdated) return c.json({ ok: false, error: 'shop_not_found' }, 404);
        updated = basicUpdated;
      }
      if (hasDynamicPatch) {
        const dynamicUpdated = await deps.shopsRepository.updateDynamicConfig(sessionResult.shopId ?? '', dynamicPatch);
        if (!dynamicUpdated) return c.json({ ok: false, error: 'shop_not_found' }, 404);
        updated = dynamicUpdated;
      }
      if (serviceCatalogPatch) {
        const savedCatalog = await deps.shopsRepository.saveServiceCatalog(
          shop.id,
          normalizeServiceCatalogForShop(shop.id, serviceCatalogPatch),
        );
        if (!savedCatalog) return c.json({ ok: false, error: 'shop_not_found' }, 404);
        const reloaded = await deps.shopsRepository.findById(shop.id);
        if (!reloaded) return c.json({ ok: false, error: 'shop_not_found' }, 404);
        updated = reloaded;
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      const duplicateConflict = userSettingsDuplicateConflict(message);
      if (duplicateConflict) {
        return c.json(
          {
            ok: false,
            error: duplicateConflict.error,
            fields: duplicateConflict.fields,
          },
          409,
        );
      }
      logger.error({ err: error, shopId: sessionResult.shopId ?? null }, 'user_settings_update_failed');
      return c.json({ ok: false, error: 'user_dependencies_unavailable' }, 500);
    }

    const showGoLiveSettingsTab = await computeShowGoLiveSettingsTab({
      shop: updated,
      shopsRepository: deps.shopsRepository,
      shopAccessStatesRepository: deps.shopAccessStatesRepository,
      billingSubscriptionsRepository: deps.billingSubscriptionsRepository,
      testCallAttemptsRepository: deps.testCallAttemptsRepository,
    });

    // Warn (non-blocking) when handoff_phone matches the business line (possible forwarding loop via carrier).
    const handoffPhoneWarnings: string[] = [];
    const savedHandoffPhone = updated.handoff_phone?.trim();
    if (savedHandoffPhone && 'handoff_phone' in settingsPatch) {
      const cc = updated.country_code ?? 'US';
      if (updated.phone_number && normalizePhoneForStorage(savedHandoffPhone, cc) === normalizePhoneForStorage(updated.phone_number, cc)) {
        handoffPhoneWarnings.push('matches_business_line');
      }
    }

    return c.json({
      ok: true,
      shop: serviceCatalogEnabled ? toUserFacingShop(updated) : { ...toUserFacingShop(updated), service_catalog: null },
      capabilities: getShopPlanCapabilities(updated.plan),
      capabilityLabels: CAPABILITY_LABELS,
      capabilityMinPlans: CAPABILITY_MIN_PLAN,
      showGoLiveSettingsTab,
      serviceCatalogEnabled,
      ...(handoffPhoneWarnings.length > 0 ? { warnings: handoffPhoneWarnings } : {}),
    });
  });

  app.put(path('/user/password'), async (c) => {
    const csrfBlocked = enforceSameOriginForCookieMutation(c);
    if (csrfBlocked) return csrfBlocked;
    const limited = await enforceRateLimit(c, RATE_LIMIT_POLICIES.user_api, 'user_password_put');
    if (limited) return limited;
    const sessionResult = await requireSession(c, 'user');
    if (sessionResult instanceof Response) return sessionResult;
    if (!deps.authUsersRepository) {
      return c.json({ ok: false, error: 'user_dependencies_unavailable' }, 500);
    }

    const body = await c.req.json().catch(() => null);
    const parsed = userPasswordChangeSchema.safeParse(body);
    if (!parsed.success) {
      return c.json({ ok: false, error: 'invalid_payload' }, 400);
    }

    if (parsed.data.newPassword === parsed.data.currentPassword) {
      return c.json({ ok: false, error: 'password_unchanged' }, 400);
    }

    const email = sessionResult.email.toLowerCase();
    const authUser = await deps.authUsersRepository.findByEmail(email);
    if (!authUser || authUser.role !== 'user' || !authUser.active) {
      return c.json({ ok: false, error: 'user_not_found' }, 404);
    }

    if (!verifyPassword(parsed.data.currentPassword, authUser.passwordHash)) {
      securityAudit({
        action: 'user_password_change_denied',
        actorType: 'user',
        actorId: email,
        ip: getClientIp({ get: (name: string) => c.req.header(name) ?? null }),
        path: c.req.path,
        details: { reason: 'invalid_current_password' },
      });
      return c.json({ ok: false, error: 'invalid_current_password' }, 400);
    }

    await deps.authUsersRepository.updatePasswordHash(authUser.id, hashPassword(parsed.data.newPassword));

    securityAudit({
      action: 'user_password_changed',
      actorType: 'user',
      actorId: email,
      ip: getClientIp({ get: (name: string) => c.req.header(name) ?? null }),
      path: c.req.path,
    });

    return c.json({ ok: true });
  });
}
