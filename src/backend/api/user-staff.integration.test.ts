import test from 'node:test';
import assert from 'node:assert/strict';

import { createBackendApp } from '@/src/backend/api/app';
import { InMemoryAuthUsersRepository } from '@/src/backend/adapters/memory/auth-users-repository';
import { InMemoryProviderEventsRepository } from '@/src/backend/adapters/memory/provider-events-repository';
import { InMemoryShopsRepository } from '@/src/backend/adapters/memory/shops-repository';
import {
  InMemoryShopStaffRepository,
  InMemoryShopStaffServicesRepository,
} from '@/src/backend/adapters/memory/shop-staff-repository';
import { __resetRateLimitMemoryStoreForTests } from '@/src/backend/security/rate-limit';
import { applyRequiredTestEnv } from '@/src/backend/test-helpers/env';

applyRequiredTestEnv({
  USER_AUTH_EMAIL: 'staff-user@ringbooker.local',
  USER_AUTH_PASSWORD: 'change_me_user_password',
  USER_AUTH_SHOP_ID: 'demo-shop',
});

test.beforeEach(() => {
  __resetRateLimitMemoryStoreForTests();
});

function createStaffTestApp() {
  const shopsRepository = new InMemoryShopsRepository();
  const shopStaffRepository = new InMemoryShopStaffRepository();
  const shopStaffServicesRepository = new InMemoryShopStaffServicesRepository();
  const app = createBackendApp({
    providerEventsRepository: new InMemoryProviderEventsRepository(),
    shopsRepository,
    authUsersRepository: new InMemoryAuthUsersRepository(),
    shopStaffRepository,
    shopStaffServicesRepository,
  });
  return { app, shopsRepository, shopStaffRepository, shopStaffServicesRepository };
}

async function loginUser(app: ReturnType<typeof createBackendApp>) {
  const response = await app.request('/auth/user/login', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      origin: 'http://localhost:3000',
    },
    body: JSON.stringify({
      email: 'staff-user@ringbooker.local',
      password: 'change_me_user_password',
    }),
  });
  assert.equal(response.status, 200);
  const cookie = response.headers.get('set-cookie')?.split(';')[0];
  assert.ok(cookie);
  return cookie;
}

type StaffMember = {
  id: string;
  name: string;
  role: string | null;
  specialties: string[];
  active: boolean;
  allServices: boolean;
  serviceIds: string[];
};

test('user staff CRUD: list, create, update, assign services, delete', async () => {
  const { app } = createStaffTestApp();
  const cookie = await loginUser(app);

  // Initially empty
  const empty = await app.request('/user/staff', { headers: { cookie } });
  assert.equal(empty.status, 200);
  const emptyBody = (await empty.json()) as { ok: boolean; staff: StaffMember[] };
  assert.equal(emptyBody.ok, true);
  assert.deepEqual(emptyBody.staff, []);

  // Create
  const created = await app.request('/user/staff', {
    method: 'POST',
    headers: { cookie, 'content-type': 'application/json' },
    body: JSON.stringify({ name: 'Maya Stylist', role: 'Senior Stylist', specialties: ['Color'] }),
  });
  assert.equal(created.status, 200);
  const createdBody = (await created.json()) as { ok: boolean; staff: StaffMember };
  assert.equal(createdBody.ok, true);
  assert.equal(createdBody.staff.name, 'Maya Stylist');
  assert.equal(createdBody.staff.role, 'Senior Stylist');
  assert.deepEqual(createdBody.staff.specialties, ['Color']);
  assert.equal(createdBody.staff.allServices, true);
  const staffId = createdBody.staff.id;
  assert.ok(staffId);

  // List shows the created member
  const listed = await app.request('/user/staff', { headers: { cookie } });
  const listedBody = (await listed.json()) as { staff: StaffMember[] };
  assert.equal(listedBody.staff.length, 1);
  assert.equal(listedBody.staff[0]?.id, staffId);

  // Update
  const patched = await app.request(`/user/staff/${staffId}`, {
    method: 'PATCH',
    headers: { cookie, 'content-type': 'application/json' },
    body: JSON.stringify({ name: 'Maya Renamed', active: false }),
  });
  assert.equal(patched.status, 200);
  const patchedBody = (await patched.json()) as { staff: StaffMember };
  assert.equal(patchedBody.staff.name, 'Maya Renamed');
  assert.equal(patchedBody.staff.active, false);

  // Assign services (allServices: true path keeps it simple, no catalog ids needed)
  const services = await app.request(`/user/staff/${staffId}/services`, {
    method: 'PUT',
    headers: { cookie, 'content-type': 'application/json' },
    body: JSON.stringify({ allServices: true }),
  });
  assert.equal(services.status, 200);
  const servicesBody = (await services.json()) as { ok: boolean; allServices: boolean; serviceIds: string[] };
  assert.equal(servicesBody.ok, true);
  assert.equal(servicesBody.allServices, true);
  assert.deepEqual(servicesBody.serviceIds, []);

  // Invalid service ids are rejected when not assigning all services
  const invalid = await app.request(`/user/staff/${staffId}/services`, {
    method: 'PUT',
    headers: { cookie, 'content-type': 'application/json' },
    body: JSON.stringify({ allServices: false, serviceIds: ['11111111-1111-4111-8111-111111111111'] }),
  });
  assert.equal(invalid.status, 400);
  const invalidBody = (await invalid.json()) as { error: string };
  assert.equal(invalidBody.error, 'invalid_service_ids');

  // Delete
  const deleted = await app.request(`/user/staff/${staffId}`, {
    method: 'DELETE',
    headers: { cookie, 'content-type': 'application/json' },
  });
  assert.equal(deleted.status, 200);
  const deletedBody = (await deleted.json()) as { ok: boolean; success: boolean };
  assert.equal(deletedBody.success, true);

  // List empty again
  const afterDelete = await app.request('/user/staff', { headers: { cookie } });
  const afterDeleteBody = (await afterDelete.json()) as { staff: StaffMember[] };
  assert.deepEqual(afterDeleteBody.staff, []);
});

test('user staff update/delete return 404 for unknown id', async () => {
  const { app } = createStaffTestApp();
  const cookie = await loginUser(app);

  const patch = await app.request('/user/staff/does-not-exist', {
    method: 'PATCH',
    headers: { cookie, 'content-type': 'application/json' },
    body: JSON.stringify({ name: 'Nope' }),
  });
  assert.equal(patch.status, 404);

  const del = await app.request('/user/staff/does-not-exist', {
    method: 'DELETE',
    headers: { cookie, 'content-type': 'application/json' },
  });
  assert.equal(del.status, 404);
});
