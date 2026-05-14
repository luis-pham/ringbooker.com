# Acuity Scheduling Integration

Last updated: 2026-05-14

## Overview

RingBooker supports a production-safe Acuity Scheduling integration for:

- Storing Acuity credentials server-side.
- Fetching appointment types.
- Fetching calendars.
- Checking availability for a mapped appointment type.
- Creating an Acuity appointment when direct booking is explicitly enabled and Acuity returns an appointment ID.
- Falling back to RingBooker booking requests when Acuity is unavailable, rejects a booking, or direct booking is disabled.

RingBooker must never tell a caller an appointment is confirmed unless Acuity appointment creation succeeds.

## Official Documentation Referenced

- Quick Start and Basic Auth: https://developers.acuityscheduling.com/docs/quick-start
- OAuth2: https://developers.acuityscheduling.com/docs/oauth2
- Appointment types: https://developers.acuityscheduling.com/reference/appointment-types
- Calendars: https://developers.acuityscheduling.com/reference/get-calendars
- Availability dates: https://developers.acuityscheduling.com/reference/get-availability-dates
- Availability times: https://developers.acuityscheduling.com/reference/get-availability-times
- Availability check-times: https://developers.acuityscheduling.com/reference/availability-check-times
- Create appointment: https://developers.acuityscheduling.com/reference/post-appointments
- Update appointment details: https://developers.acuityscheduling.com/reference/put-appointments-id
- Reschedule appointment: https://developers.acuityscheduling.com/reference/put-appointments-id-reschedule
- Cancel appointment: https://developers.acuityscheduling.com/reference/put-appointments-id-cancel
- Webhooks: https://developers.acuityscheduling.com/docs/webhooks
- Dynamic webhooks: https://developers.acuityscheduling.com/page/webhooks-webhooks-webhooks

## Current Implementation Status

Supported:

- Basic Auth credentials: Acuity User ID + API key.
- OAuth access-token credential shape is supported in storage and client auth, but the dashboard OAuth connect flow is not implemented yet.
- Appointment type sync.
- Calendar sync.
- Availability check using `/availability/check-times` and suggestions from `/availability/times`.
- Direct appointment creation using `POST /appointments`, gated by `ACUITY_DIRECT_BOOKING_ENABLED=true` and an `appointmentTypeId`.
- Request fallback when direct booking is disabled or Acuity returns an error.
- Reschedule and cancel client methods for Acuity appointment IDs when direct booking is enabled.

Deferred:

- Full OAuth connect UI.
- Dynamic webhook provisioning.
- Per-service appointment type mapping UI.
- Per-provider customer/client matching beyond appointment creation payload.
- Provider appointment status columns on RingBooker booking records.

## Required Credentials and Env Vars

Dashboard fields:

- `userId`: Acuity numeric User ID.
- `apiKey`: Acuity API key.
- `appointmentTypeId`: Acuity appointment type ID used for RingBooker bookings.
- `calendarId`: Optional Acuity calendar ID.
- `timezone`: Optional IANA timezone.
- `bookingUrl`: Optional fallback booking URL.

Environment variables:

- `ACUITY_API_BASE_URL`: Optional, defaults to `https://acuityscheduling.com/api/v1`.
- `ACUITY_TIMEOUT_MS`: Optional API timeout, defaults to `12000`.
- `ACUITY_USER_ID`: Optional fallback User ID.
- `ACUITY_API_KEY`: Optional fallback API key.
- `ACUITY_ACCESS_TOKEN`: Optional OAuth bearer token fallback.
- `ACUITY_APPOINTMENT_TYPE_ID`: Optional fallback appointment type mapping.
- `ACUITY_CALENDAR_ID`: Optional fallback calendar mapping.
- `ACUITY_TIMEZONE`: Optional fallback timezone.
- `ACUITY_BOOKING_URL`: Optional fallback booking URL.
- `ACUITY_DIRECT_BOOKING_ENABLED`: Must be `true` before direct Acuity appointment creation is attempted.

## Data Model Changes

The integration uses the provider-neutral `shops.integration_credentials_encrypted` column introduced for booking provider credentials. Stored payload shape:

```json
{
  "provider": "acuity",
  "userId": "12345678",
  "apiKey": "secret",
  "accessToken": "optional-oauth-token",
  "appointmentTypeId": "100",
  "calendarId": "200",
  "timezone": "America/Chicago",
  "bookingUrl": "https://your-business.as.me/"
}
```

Secrets must not be logged. Current local storage is JSON in the same repository path used by existing credentials; production should keep this column encrypted at rest.

Booking records also store provider outcome metadata:

- `bookings.provider`: e.g. `acuity`.
- `bookings.provider_status`: e.g. `confirmed` or `fallback_request`.
- `bookings.provider_error_reason`: short non-secret error reason when provider booking falls back.
- `bookings.calendar_event_id`: Acuity appointment ID when direct booking succeeds.

## API Endpoints Used

RingBooker backend routes:

- `POST /api/backend/user/calendar/providers/acuity/connect`
- `POST /api/backend/user/calendar/providers/acuity/disconnect`
- `GET /api/backend/user/calendar/providers/acuity/options`
- `GET /api/backend/user/calendar/providers`

Acuity endpoints:

- `GET /appointment-types`
- `GET /calendars`
- `POST /availability/check-times`
- `GET /availability/times`
- `POST /appointments`
- `PUT /appointments/{id}/reschedule`
- `PUT /appointments/{id}/cancel`

## Appointment Type and Calendar Mapping

Current mapping is account-level:

- `appointmentTypeId` maps RingBooker booking requests to one Acuity appointment type.
- `calendarId` is optional. If omitted, Acuity may auto-select an available calendar.
- Agent-selected team member IDs can override `calendarId` when the provider resolves a calendar/team member match.

Future work should add per-service mapping:

- RingBooker service ID -> Acuity appointment type ID.
- RingBooker staff/provider ID -> Acuity calendar ID.

## Availability Flow

1. RingBooker requires an Acuity appointment type ID.
2. For a requested date/time, RingBooker calls `/availability/check-times`.
3. If Acuity returns valid/available, RingBooker treats the slot as available.
4. If unavailable, RingBooker calls `/availability/times` for suggestions.
5. If Acuity returns an error, RingBooker does not mark the slot available.

## Booking Creation Flow

1. The AI captures service, date, time, caller phone, and optional caller name.
2. RingBooker checks availability.
3. If `ACUITY_DIRECT_BOOKING_ENABLED=true` and `appointmentTypeId` exists, RingBooker calls `POST /appointments`.
4. RingBooker marks the booking confirmed only if Acuity returns an appointment ID.
5. RingBooker stores the Acuity appointment ID as the calendar event ID.
6. If Acuity fails or returns no appointment ID, RingBooker creates a normal booking request with `confirmed=false`.

The customer confirmation SMS uses the confirmed template only after step 4 succeeds. Fallback requests use the booking-request-received copy.

## Reschedule and Cancel Flow

Implemented client methods:

- `PUT /appointments/{id}/reschedule`
- `PUT /appointments/{id}/cancel`

They are only called when direct booking is enabled and a stored Acuity appointment ID is available. Otherwise RingBooker should keep using its request/follow-up flow.

## Webhook Support

Not implemented in this phase.

Official docs support static and dynamic webhooks for appointment scheduled, rescheduled, canceled, changed, and order completed events. Webhook notifications should be verified with `x-acuity-signature` using HMAC-SHA256 over the request body and the API key.

## Fallback Behavior

Fallback is mandatory.

RingBooker creates a normal booking request when:

- Acuity credentials are missing or invalid.
- Appointment type mapping is missing.
- Availability is unavailable or uncertain.
- `POST /appointments` returns a validation/API error.
- `ACUITY_DIRECT_BOOKING_ENABLED` is not `true`.

Fallback booking requests are not confirmed appointments. Owner alerts still run where eligible.

## Error Handling and Logging

Structured logs include:

- `provider=acuity`
- `shopId` or `shop_id`
- HTTP method/path/status/duration for Acuity API calls
- connect/disconnect/sync status
- error kind for failures

Do not log:

- API keys
- OAuth tokens
- full caller PII beyond what existing booking flow already stores

## Testing Instructions

Run:

```bash
npx tsc --noEmit --incremental false
npx tsx --test src/backend/services/booking-providers/acuity.test.ts src/backend/api/booking-link-settings.test.ts src/agent/tools/create-booking.test.ts src/backend/jobs/runner.test.ts
```

Provider tests mock Acuity API responses. Local development does not require live Acuity credentials.

## Deployment Checklist

- Apply migration for `shops.integration_credentials_encrypted` if not already applied.
- Set `ACUITY_DIRECT_BOOKING_ENABLED=false` initially.
- Connect a test Acuity account in the dashboard.
- Confirm `/calendar/providers/acuity/options` returns appointment types and calendars.
- Configure appointment type ID and optional calendar ID.
- Test availability with known available and unavailable slots.
- Enable `ACUITY_DIRECT_BOOKING_ENABLED=true` only after end-to-end test bookings succeed.
- Confirm fallback creates pending booking requests when Acuity rejects a slot.
- Confirm customer SMS copy does not claim confirmation on fallback.
- Monitor `acuity_api_request_failed` and `acuity_create_booking_failed_fallback` logs after launch.

## Limitations

- OAuth connect UI is deferred.
- Mapping is account-level, not per service/staff.
- Webhook sync is deferred.
- Direct booking requires a generic RingBooker email placeholder unless a caller email is captured elsewhere.

## Future Improvements

- Acuity OAuth connect flow.
- Per-service and per-staff mapping UI.
- Dynamic webhook registration and signature verification route.
- Provider status/error fields on booking requests.
- Caller email capture before direct provider booking.
- Better Acuity intake form field mapping.
