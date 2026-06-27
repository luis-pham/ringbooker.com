import type { Hono } from 'hono';

import { isCapabilityAllowed } from '@/src/backend/domain/shop-plan-capabilities';
import type {
  ShopsRepository,
  ShopStaffRepository,
  ShopStaffServicesRepository,
} from '@/src/backend/ports/repositories';
import {
  enforceRateLimit,
  normalizedStaffCreateSchema,
  normalizedStaffUpdateSchema,
  planFeatureLockedJson,
  RATE_LIMIT_POLICIES,
  requireSession,
  staffServiceAssignmentSchema,
  toUserFacingStaff,
} from '../app-shared';

type UserStaffDeps = {
  shopsRepository?: ShopsRepository;
  shopStaffRepository?: ShopStaffRepository;
  shopStaffServicesRepository?: ShopStaffServicesRepository;
};

export function registerUserStaffRoutes(
  app: Hono,
  path: (route: string) => string,
  deps: UserStaffDeps,
) {
  app.get(path('/user/staff'), async (c) => {
    const limited = await enforceRateLimit(c, RATE_LIMIT_POLICIES.user_api, 'user_staff_get');
    if (limited) return limited;
    const sessionResult = await requireSession(c, 'user');
    if (sessionResult instanceof Response) return sessionResult;
    if (!deps.shopsRepository || !deps.shopStaffRepository || !deps.shopStaffServicesRepository) {
      return c.json({ ok: false, error: 'user_dependencies_unavailable' }, 500);
    }

    const shop = await deps.shopsRepository.findById(sessionResult.shopId ?? '');
    if (!shop) return c.json({ ok: false, error: 'shop_not_found' }, 404);
    if (!isCapabilityAllowed(shop.plan, 'edit_staff')) {
      return planFeatureLockedJson(c, 'edit_staff');
    }

    const [staff, mappings] = await Promise.all([
      deps.shopStaffRepository.findByShopId(shop.id),
      deps.shopStaffServicesRepository.listByShopId(shop.id),
    ]);

    return c.json({
      ok: true,
      staff: staff.map((member) => toUserFacingStaff(member, mappings)),
    });
  });

  app.post(path('/user/staff'), async (c) => {
    const limited = await enforceRateLimit(c, RATE_LIMIT_POLICIES.user_api, 'user_staff_create');
    if (limited) return limited;
    const sessionResult = await requireSession(c, 'user');
    if (sessionResult instanceof Response) return sessionResult;
    if (!deps.shopsRepository || !deps.shopStaffRepository || !deps.shopStaffServicesRepository) {
      return c.json({ ok: false, error: 'user_dependencies_unavailable' }, 500);
    }

    const shop = await deps.shopsRepository.findById(sessionResult.shopId ?? '');
    if (!shop) return c.json({ ok: false, error: 'shop_not_found' }, 404);
    if (!isCapabilityAllowed(shop.plan, 'edit_staff')) {
      return planFeatureLockedJson(c, 'edit_staff');
    }

    const body = await c.req.json().catch(() => null);
    const parsed = normalizedStaffCreateSchema.safeParse(body);
    if (!parsed.success) {
      return c.json({ ok: false, error: 'invalid_input', details: parsed.error.issues }, 400);
    }

    const { allServices, serviceIds: rawServiceIds, ...profile } = parsed.data;
    const serviceIds = [...new Set(rawServiceIds)];
    if (!allServices) {
      const catalog = await deps.shopsRepository.findServiceCatalogByShopId(shop.id);
      const validServiceIds = new Set((catalog?.services ?? []).map((service) => service.id));
      const invalidIds = serviceIds.filter((id) => !validServiceIds.has(id));
      if (invalidIds.length > 0) {
        return c.json({ ok: false, error: 'invalid_service_ids', invalidIds }, 400);
      }
    }

    const created = await deps.shopStaffRepository.create({
      shopId: shop.id,
      ...profile,
      allServices,
    });
    if (!allServices) {
      await deps.shopStaffServicesRepository.replaceMappingsForStaff(shop.id, created.id, serviceIds);
    }
    const mappings = await deps.shopStaffServicesRepository.listByShopId(shop.id);

    return c.json({
      ok: true,
      staff: toUserFacingStaff(created, mappings),
    });
  });

  app.patch(path('/user/staff/:id'), async (c) => {
    const limited = await enforceRateLimit(c, RATE_LIMIT_POLICIES.user_api, 'user_staff_update');
    if (limited) return limited;
    const sessionResult = await requireSession(c, 'user');
    if (sessionResult instanceof Response) return sessionResult;
    if (!deps.shopsRepository || !deps.shopStaffRepository || !deps.shopStaffServicesRepository) {
      return c.json({ ok: false, error: 'user_dependencies_unavailable' }, 500);
    }

    const shop = await deps.shopsRepository.findById(sessionResult.shopId ?? '');
    if (!shop) return c.json({ ok: false, error: 'shop_not_found' }, 404);
    if (!isCapabilityAllowed(shop.plan, 'edit_staff')) {
      return planFeatureLockedJson(c, 'edit_staff');
    }

    const staffId = c.req.param('id') ?? '';
    if (!staffId) return c.json({ ok: false, error: 'not_found' }, 404);
    const existing = await deps.shopStaffRepository.findById(staffId);
    if (!existing || existing.shopId !== shop.id) {
      return c.json({ ok: false, error: 'not_found' }, 404);
    }

    const body = await c.req.json().catch(() => null);
    const parsed = normalizedStaffUpdateSchema.safeParse(body);
    if (!parsed.success) {
      return c.json({ ok: false, error: 'invalid_input', details: parsed.error.issues }, 400);
    }

    const updated = await deps.shopStaffRepository.update(staffId, parsed.data);
    const mappings = await deps.shopStaffServicesRepository.listByShopId(shop.id);
    return c.json({
      ok: true,
      staff: toUserFacingStaff(updated, mappings),
    });
  });

  app.delete(path('/user/staff/:id'), async (c) => {
    const limited = await enforceRateLimit(c, RATE_LIMIT_POLICIES.user_api, 'user_staff_delete');
    if (limited) return limited;
    const sessionResult = await requireSession(c, 'user');
    if (sessionResult instanceof Response) return sessionResult;
    if (!deps.shopsRepository || !deps.shopStaffRepository || !deps.shopStaffServicesRepository) {
      return c.json({ ok: false, error: 'user_dependencies_unavailable' }, 500);
    }

    const shop = await deps.shopsRepository.findById(sessionResult.shopId ?? '');
    if (!shop) return c.json({ ok: false, error: 'shop_not_found' }, 404);
    if (!isCapabilityAllowed(shop.plan, 'edit_staff')) {
      return planFeatureLockedJson(c, 'edit_staff');
    }

    const staffId = c.req.param('id') ?? '';
    if (!staffId) return c.json({ ok: false, error: 'not_found' }, 404);
    const existing = await deps.shopStaffRepository.findById(staffId);
    if (!existing || existing.shopId !== shop.id) {
      return c.json({ ok: false, error: 'not_found' }, 404);
    }

    await deps.shopStaffServicesRepository.replaceMappingsForStaff(shop.id, staffId, []);
    await deps.shopStaffRepository.deleteById(staffId);
    return c.json({ ok: true, success: true });
  });

  app.put(path('/user/staff/:id/services'), async (c) => {
    const limited = await enforceRateLimit(c, RATE_LIMIT_POLICIES.user_api, 'user_staff_services_update');
    if (limited) return limited;
    const sessionResult = await requireSession(c, 'user');
    if (sessionResult instanceof Response) return sessionResult;
    if (!deps.shopsRepository || !deps.shopStaffRepository || !deps.shopStaffServicesRepository) {
      return c.json({ ok: false, error: 'user_dependencies_unavailable' }, 500);
    }

    const shop = await deps.shopsRepository.findById(sessionResult.shopId ?? '');
    if (!shop) return c.json({ ok: false, error: 'shop_not_found' }, 404);
    if (!isCapabilityAllowed(shop.plan, 'edit_staff')) {
      return planFeatureLockedJson(c, 'edit_staff');
    }

    const staffId = c.req.param('id') ?? '';
    if (!staffId) return c.json({ ok: false, error: 'not_found' }, 404);
    const existing = await deps.shopStaffRepository.findById(staffId);
    if (!existing || existing.shopId !== shop.id) {
      return c.json({ ok: false, error: 'not_found' }, 404);
    }

    const body = await c.req.json().catch(() => null);
    const parsed = staffServiceAssignmentSchema.safeParse(body);
    if (!parsed.success) {
      return c.json({ ok: false, error: 'invalid_input', details: parsed.error.issues }, 400);
    }

    const serviceIds = [...new Set(parsed.data.serviceIds)];
    if (!parsed.data.allServices) {
      const catalog = await deps.shopsRepository.findServiceCatalogByShopId(shop.id);
      const validServiceIds = new Set((catalog?.services ?? []).map((service) => service.id));
      const invalidIds = serviceIds.filter((id) => !validServiceIds.has(id));
      if (invalidIds.length > 0) {
        return c.json({ ok: false, error: 'invalid_service_ids', invalidIds }, 400);
      }
    }

    const updated = await deps.shopStaffRepository.update(staffId, {
      allServices: parsed.data.allServices,
    });
    if (!parsed.data.allServices) {
      await deps.shopStaffServicesRepository.replaceMappingsForStaff(shop.id, staffId, serviceIds);
    }
    const mappings = await deps.shopStaffServicesRepository.listByShopId(shop.id);

    return c.json({
      ok: true,
      success: true,
      staff: toUserFacingStaff(updated, mappings),
      allServices: parsed.data.allServices,
      serviceIds: parsed.data.allServices ? [] : serviceIds,
    });
  });
}
