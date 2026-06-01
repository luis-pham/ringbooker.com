import test from 'node:test';
import assert from 'node:assert/strict';

import { checkAvailabilityTool } from '@/src/agent/tools/check-availability';
import type { AgentToolContext } from '@/src/agent/tools/types';
import type { Shop } from '@/src/backend/domain/types';

function createShop(patch: Partial<Shop> = {}): Shop {
  return {
    id: 'shop-check-availability',
    name: 'Test Salon',
    phone_number: '+17145550000',
    user_phone: '+17145550001',
    timezone: 'America/Los_Angeles',
    services: [{ name: 'Haircut', duration_min: 45, price: 45 }],
    hours: {},
    cancel_policy: '24 hours',
    booking_url: null,
    allow_transfers: true,
    allow_callbacks: true,
    send_reminder_sms: false,
    send_review_request_sms: false,
    send_missed_call_followup_sms: true,
    plan: 'starter',
    active: true,
    ...patch,
  };
}

function createContext(params?: {
  shop?: Partial<Shop>;
  findTeamMemberByName?: (name: string) => Promise<string | null>;
  checkAvailability?: AgentToolContext['calendarProvider']['checkAvailability'];
}) {
  const availabilityInputs: unknown[] = [];
  const ctx: AgentToolContext = {
    shop: createShop(params?.shop),
    callerPhone: '+15551234567',
    requestId: 'req-check-availability-test',
    roomName: 'room-check-availability-test',
    calendarProvider: {
      shop: createShop(params?.shop),
      findTeamMemberByName: params?.findTeamMemberByName,
      checkAvailability: async (input) => {
        availabilityInputs.push(input);
        if (params?.checkAvailability) return params.checkAvailability(input);
        return { available: true };
      },
      createBooking: async () => ({ bookingId: 'unused', confirmed: true }),
      cancelBooking: async () => {},
      rescheduleBooking: async () => ({ bookingId: 'unused', confirmed: true }),
    },
    jobsRepository: {} as AgentToolContext['jobsRepository'],
    bookingsRepository: {} as AgentToolContext['bookingsRepository'],
    callbacksRepository: {} as AgentToolContext['callbacksRepository'],
    shopsRepository: {} as AgentToolContext['shopsRepository'],
    telephonyService: {} as AgentToolContext['telephonyService'],
    availabilityCheck: { latest: null },
  };
  return { ctx, availabilityInputs };
}

test('checkAvailabilityTool rejects requested time outside configured business hours', async () => {
  const harness = createContext({
    shop: {
      hours: {
        monday: { open: '09:00', close: '17:00' },
      },
    },
  });

  const result = await checkAvailabilityTool(harness.ctx, {
    date: '2099-01-05',
    time: '05:00',
    service: 'Haircut',
  });

  assert.equal('available' in result ? result.available : undefined, false);
  assert.match('message' in result && typeof result.message === 'string' ? result.message : '', /outside the shop business hours/);
  assert.equal(harness.availabilityInputs.length, 0);
});

test('checkAvailabilityTool uses canonical service duration before provider call', async () => {
  const harness = createContext({
    shop: {
      service_catalog: {
        categories: [
          {
            id: 'cat-hair',
            shopId: 'shop-check-availability',
            name: 'Hair',
            sortOrder: 0,
            active: true,
          },
        ],
        services: [
          {
            id: 'svc-balayage',
            shopId: 'shop-check-availability',
            categoryId: 'cat-hair',
            name: 'Balayage Color',
            durationText: '120 min',
            durationMinutes: 120,
            priceAmount: 180,
            priceCurrency: 'USD',
            priceType: 'from',
            bookable: true,
            active: true,
            sortOrder: 0,
            aliases: ['balayage'],
            variants: [],
          },
        ],
      },
    },
  });

  const result = await checkAvailabilityTool(harness.ctx, {
    date: '2099-01-05',
    time: '10:00',
    service: 'balayage',
  });

  assert.deepEqual(result, { available: true });
  assert.equal((harness.availabilityInputs[0] as { durationMin?: number })?.durationMin, 120);
});

test('checkAvailabilityTool caches staff resolution without returning raw team member IDs', async () => {
  const harness = createContext({
    findTeamMemberByName: async (name) => {
      assert.equal(name, 'Jessica');
      return 'TM_JESSICA';
    },
    checkAvailability: async () => ({
      available: true,
      message: "Jessica isn't available at that time, but Marcus is.",
      requestedStaffUnavailable: true,
      requestedStaffName: 'Jessica',
      fallbackStaffName: 'Marcus',
      suggestions: [{ date: '2099-01-05', time: '10:00', techName: 'Marcus' }],
      staffResolution: {
        resolvedTeamMemberId: 'TM_MARCUS',
        resolvedTeamMemberName: 'Marcus',
        requestedTeamMemberId: 'TM_JESSICA',
        requestedTeamMemberName: 'Jessica',
        requestedStaffUnavailable: true,
        fallbackTeamMemberId: 'TM_MARCUS',
        fallbackTeamMemberName: 'Marcus',
        serviceVariationId: 'SV_HAIRCUT',
        locationId: 'LOC_TEST',
      },
    }),
  });

  const result = await checkAvailabilityTool(harness.ctx, {
    date: '2099-01-05',
    time: '10:00',
    service: 'Haircut',
    techName: 'Jessica',
  });

  assert.equal('requestedStaffUnavailable' in result ? result.requestedStaffUnavailable : false, true);
  assert.equal('fallbackStaffName' in result ? result.fallbackStaffName : undefined, 'Marcus');
  assert.equal(JSON.stringify(result).includes('TM_'), false);
  assert.equal(harness.ctx.availabilityCheck?.latest?.resolvedTeamMemberId, 'TM_MARCUS');
  assert.equal(harness.ctx.availabilityCheck?.latest?.requestedTeamMemberId, 'TM_JESSICA');
  assert.equal((harness.availabilityInputs[0] as { teamMemberId?: string })?.teamMemberId, 'TM_JESSICA');
});
