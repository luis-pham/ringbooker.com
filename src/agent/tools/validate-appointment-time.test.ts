import test from 'node:test';
import assert from 'node:assert/strict';

import { validateAppointmentTimeTool } from '@/src/agent/tools/validate-appointment-time';
import type { AgentToolContext } from '@/src/agent/tools/types';
import type { Shop } from '@/src/backend/domain/types';

function createContext(hours: Shop['hours']): AgentToolContext {
  const shop: Shop = {
    id: 'shop-time-validation',
    name: 'Avalon Salon and Spa',
    phone_number: '+17145550000',
    user_phone: '+17145550001',
    timezone: 'America/Los_Angeles',
    services: [{ name: 'Facial', duration_min: 60, price: 199 }],
    hours,
    cancel_policy: '24 hours',
    booking_url: null,
    allow_transfers: true,
    allow_callbacks: false,
    send_reminder_sms: false,
    send_review_request_sms: false,
    send_missed_call_followup_sms: true,
    plan: 'professional',
    active: true,
  };

  return {
    shop,
    callerPhone: '+15551234567',
    requestId: 'req-time-validation',
    roomName: 'room-time-validation',
    calendarProvider: {} as AgentToolContext['calendarProvider'],
    jobsRepository: {} as AgentToolContext['jobsRepository'],
    bookingsRepository: {} as AgentToolContext['bookingsRepository'],
    callbacksRepository: {} as AgentToolContext['callbacksRepository'],
    shopsRepository: {} as AgentToolContext['shopsRepository'],
    telephonyService: {} as AgentToolContext['telephonyService'],
    appointmentTimeValidation: { latest: null },
  };
}

test('accepts a future appointment within business hours without applying an inferred booking window', async () => {
  const ctx = createContext({ monday: { open: '09:00', close: '17:00' } });

  const result = await validateAppointmentTimeTool(ctx, {
    date: '2099-01-05',
    time: '10:00',
  });

  assert.equal('valid' in result ? result.valid : undefined, true);
  assert.equal('date' in result ? result.date : undefined, '2099-01-05');
  assert.equal('time' in result ? result.time : undefined, '10:00');
  assert.equal('reason' in result ? result.reason : undefined, 'within_business_hours');
  assert.equal(ctx.appointmentTimeValidation?.latest?.date, '2099-01-05');
  assert.equal(ctx.appointmentTimeValidation?.latest?.valid, true);
  assert.match('messageForAi' in result ? result.messageForAi : '', /without describing the date as too far in the future/);
});

test('rejects an appointment outside configured business hours immediately', async () => {
  const ctx = createContext({ monday: { open: '09:00', close: '17:00' } });

  const result = await validateAppointmentTimeTool(ctx, {
    date: '2099-01-05',
    time: '20:00',
  });

  assert.equal('valid' in result ? result.valid : undefined, false);
  assert.equal('reason' in result ? result.reason : undefined, 'outside_business_hours');
  assert.equal(ctx.appointmentTimeValidation?.latest?.valid, false);
  assert.match('messageForAi' in result ? result.messageForAi : '', /outside our business hours/);
});

test('allows request capture without an hours decision when business hours are not configured', async () => {
  const ctx = createContext({});

  const result = await validateAppointmentTimeTool(ctx, {
    date: '2099-01-05',
    time: '10:00',
  });

  assert.equal('valid' in result ? result.valid : undefined, true);
  assert.equal('reason' in result ? result.reason : undefined, 'business_hours_not_configured');
});

test('rejects a date in the past even when it falls inside configured business hours', async () => {
  const ctx = createContext({ monday: { open: '09:00', close: '17:00' } });

  const result = await validateAppointmentTimeTool(ctx, {
    date: '2000-01-03',
    time: '10:00',
  });

  assert.equal('valid' in result ? result.valid : undefined, false);
  assert.equal('reason' in result ? result.reason : undefined, 'past_datetime');
  assert.match('messageForAi' in result ? result.messageForAi : '', /already passed/);
});
