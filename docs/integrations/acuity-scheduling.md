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
- Per-service mapping: RingBooker service name -> Acuity appointment type ID.
- Per-staff mapping: RingBooker staff/provider name -> Acuity calendar ID.
- Default Acuity calendar ID.
- Direct appointment creation using `POST /appointments`, gated by `ACUITY_DIRECT_BOOKING_ENABLED=true`, service mapping, and calendar/default-calendar mapping.
- Request fallback when direct booking is disabled or Acuity returns an error.
- Reschedule and cancel client methods for Acuity appointment IDs when direct booking is enabled.

Deferred:

- Full OAuth connect UI.
- Dynamic webhook provisioning.
- Per-provider customer/client matching beyond appointment creation payload.
- Acuity intake form custom-field mapping.

## Required Credentials and Env Vars

Dashboard fields:

- `userId`: Acuity numeric User ID.
- `apiKey`: Acuity API key.
- `serviceMappings`: RingBooker service name -> Acuity appointment type ID.
- `staffMappings`: Optional RingBooker staff/provider name -> Acuity calendar ID.
- `defaultCalendarId`: Required default Acuity calendar ID for direct booking.
- `appointmentTypeId`: Legacy fallback appointment type field for availability/admin use. Direct booking still requires service mappings.
- `calendarId`: Legacy calendar field. Stored as/defaults to `defaultCalendarId`.
- `requiresCallerEmail`: Optional. When true, direct booking falls back unless the caller email is captured.
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
- `ACUITY_DEFAULT_CALENDAR_ID`: Optional fallback default calendar mapping.
- `ACUITY_REQUIRES_CALLER_EMAIL`: Optional. Set `true` only if the Acuity account requires caller email for appointment creation.
- `ACUITY_TIMEZONE`: Optional fallback timezone.
- `ACUITY_BOOKING_URL`: Optional fallback booking URL.
- `ACUITY_DIRECT_BOOKING_ENABLED`: Defaults to disabled. Must be exactly `true` before direct Acuity appointment creation is attempted.

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
  "defaultCalendarId": "200",
  "serviceMappings": {
    "haircut": "100",
    "hair color": "101"
  },
  "staffMappings": {
    "alex": "200",
    "jamie": "201"
  },
  "requiresCallerEmail": false,
  "timezone": "America/Chicago",
  "bookingUrl": "https://your-business.as.me/"
}
```

Secrets must not be logged. Current local storage is JSON in the same repository path used by existing credentials; production should keep this column encrypted at rest.

Booking records also store provider outcome metadata:

- `bookings.provider`: e.g. `acuity`.
- `bookings.provider_status`: one of `request_only`, `provider_confirmed`, `provider_failed`, `provider_unavailable`, `provider_disabled`, `missing_mapping`.
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

Current mapping is explicit and required for direct booking:

- RingBooker service name -> Acuity appointment type ID.
- RingBooker staff/provider name -> Acuity calendar ID.
- Default Acuity calendar ID.

Direct booking is blocked with `provider_status=missing_mapping` when:

- No service mapping matches the caller's requested service.
- No matched staff calendar and no default Acuity calendar exist.

If staff mapping is missing but default calendar exists, RingBooker uses the default Acuity calendar.

## Availability Flow

1. RingBooker requires an Acuity appointment type ID.
2. For a requested date/time, RingBooker calls `/availability/check-times`.
3. If Acuity returns valid/available, RingBooker treats the slot as available.
4. If unavailable, RingBooker calls `/availability/times` for suggestions.
5. If Acuity returns an error, RingBooker does not mark the slot available.

## Booking Creation Flow

1. The AI captures service, date, time, caller phone, and optional caller name.
2. RingBooker checks availability.
3. RingBooker resolves the requested service to an Acuity appointment type ID.
4. RingBooker resolves the requested staff/provider to an Acuity calendar ID or uses the default calendar.
5. If email is required and no caller email was captured, RingBooker creates a normal booking request with `confirmed=false`.
6. If `ACUITY_DIRECT_BOOKING_ENABLED=true` and mappings are complete, RingBooker checks `/availability/check-times`.
7. RingBooker calls `POST /appointments` only after the slot is available.
8. RingBooker marks the booking confirmed only if Acuity returns an appointment ID.
9. RingBooker stores the Acuity appointment ID as the calendar event ID.
10. If mapping, availability, or creation fails, RingBooker creates a normal booking request with `confirmed=false`.

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
- Default calendar/staff calendar mapping is missing.
- Caller email is required by Acuity/account settings but was not captured.
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
- Configure RingBooker service -> Acuity appointment type ID mappings.
- Configure a default Acuity calendar ID and optional staff -> calendar ID mappings.
- If the Acuity account requires customer email, enable the email-required setting and validate fallback when no email is available.
- Test availability with known available and unavailable slots.
- Enable `ACUITY_DIRECT_BOOKING_ENABLED=true` only after end-to-end test bookings succeed.
- Confirm fallback creates pending booking requests when Acuity rejects a slot.
- Confirm customer SMS copy does not claim confirmation on fallback.
- Confirm provider statuses:
  - `provider_confirmed` only after Acuity returns an appointment ID.
  - `provider_disabled` when the direct-booking flag is off.
  - `missing_mapping` when service/calendar mapping is missing.
  - `provider_unavailable` when Acuity says the slot is unavailable.
  - `provider_failed` when Acuity errors during creation.
  - `request_only` for request-only fallback such as missing required email.
- Monitor `acuity_api_request_failed` and `acuity_create_booking_failed_fallback` logs after launch.

## Limitations

- OAuth connect UI is deferred.
- Webhook sync is deferred.
- Caller email is optional unless the Acuity account requires it; if required and missing, RingBooker falls back to request-only.

## Future Improvements

- Acuity OAuth connect flow.
- Dynamic webhook registration and signature verification route.
- Richer caller email capture in the AI flow.
- Better Acuity intake form field mapping.
