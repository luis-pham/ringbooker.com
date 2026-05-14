# Square Appointments Booking Provider

Last updated: 2026-05-14

## Overview

Square Appointments is a RingBooker booking provider. It is no longer treated as a calendar-only integration in the backend architecture.

The legacy route IDs and provider ID remain `square_appointments` for compatibility with existing shops, OAuth callbacks, settings screens, and tests.

## Architecture

Implementation lives at:

- `src/backend/services/booking-providers/square.ts`

Backward-compatible import path:

- `src/backend/services/calendar/square-appointments.ts`

Shared provider shape:

- `src/backend/services/booking-providers/types.ts`

Provider catalog compatibility export:

- `src/backend/services/booking-providers/provider-catalog.ts`

## Capabilities

Square Appointments supports:

- Service/catalog sync via Square catalog service variations.
- Staff/team member sync via Square team members.
- Availability checks via Square Bookings availability search.
- Direct booking creation via Square Bookings API.
- Reschedule/update booking via Square Bookings API.
- Cancel booking via Square Bookings API.
- Customer lookup/create via Square Customers API.

Not implemented:

- Square webhook synchronization.

## Booking Flow Safety

RingBooker marks a booking `confirmed=true` only after Square booking creation succeeds and returns a booking ID.

If Square API fails, token refresh fails, customer creation fails, availability is uncertain, or the booking response is incomplete:

- RingBooker creates a normal booking request.
- `confirmed=false`.
- `provider_status=provider_failed`.
- Customer SMS uses booking-request copy, not confirmed appointment copy.
- Owner alert is queued where eligible.

## Credentials

Square credentials are still stored in the existing connection payload for compatibility:

```json
{
  "provider": "square_appointments",
  "access_token": "...",
  "refresh_token": "...",
  "expires_at": "...",
  "merchant_id": "...",
  "location_id": "...",
  "service_variation_id": "...",
  "team_member_id": "..."
}
```

Future cleanup can migrate Square credentials to `shops.integration_credentials_encrypted`, but this refactor preserves current behavior and avoids breaking connected shops.

## Dashboard Copy

The Integrations UI describes Square as a booking provider:

- Services/catalog sync: available.
- Staff sync: available.
- Availability check: available after mapping.
- Direct appointment creation: enabled after location/service mapping.
- Current behavior: direct booking with fallback.

## Compatibility

Kept stable:

- Provider ID: `square_appointments`
- OAuth start route
- OAuth callback route
- Options/configure/disconnect routes
- Existing Google Calendar provider behavior
- Existing booking tool behavior for successful Square bookings

Changed:

- Square implementation file moved to booking provider structure.
- Provider catalog type for Square is `booking_provider`.
- Booking tool now falls back to a pending request when provider booking creation throws.

## Tests

Run:

```bash
npx tsc --noEmit --incremental false
npx tsx --test src/agent/tools/create-booking.test.ts src/agent/tools/cancel-booking.test.ts src/agent/tools/reschedule-booking.test.ts src/backend/api/user-calendar-providers.integration.test.ts src/backend/services/calendar/provider-catalog.integration.test.ts
```

## Remaining Cleanup

- Move Square OAuth helper naming from `calendar/provider-connections` to booking-provider terminology.
- Optionally migrate Square credential storage to provider-neutral `integration_credentials_encrypted`.
- Add Square webhook support if needed.
