# Mindbody Integration

Last updated: 2026-05-14

## Overview

RingBooker supports a minimal, production-safe Mindbody connection for shops that have approved Mindbody API access. The current implementation stores Mindbody credentials in provider-neutral integration storage, fetches services and staff, performs best-effort availability checks, and keeps appointment creation request-only. Direct Mindbody appointment writes are deliberately deferred until the write contract, permissions, and site-specific mappings are verified.

The integration does not auto-confirm a booking unless a future Mindbody write implementation successfully creates the appointment. If Mindbody is unavailable, not configured, or returns an error, RingBooker falls back to the existing booking request flow and owner notification.

## Official Docs Referenced

Only official Mindbody developer documentation was used:

- Mindbody Developer API endpoint overview: https://developers.mindbodyonline.com/Resources/Endpoints
- Mindbody Developer FAQ: https://developers.mindbodyonline.com/resources/faqs
- Mindbody Webhooks API documentation: https://developers.mindbodyonline.com/WebhooksDocumentation
- Mindbody Consumer API authentication examples: https://developers.mindbodyonline.com/ConsumerDocumentation
- Mindbody Affiliate API authentication examples: https://developers.mindbodyonline.com/AffiliateDocumentation

Important constraints from the official docs:

- Mindbody API use requires a developer account and business/site access activation.
- API requests require an `API-Key` header.
- Mindbody requires API calls to come from backend servers, not browser/mobile clients.
- Webhooks also require `API-Key` and `User-Agent` headers and have event types for appointment booking created/updated/cancelled.
- Rate limits vary by endpoint and are defined by Mindbody when an API key is issued.

## Current Status

Production-safe, request-only for booking creation.

Supported now:

- Connect/disconnect Mindbody credentials from the dashboard.
- Fetch services and staff where API access allows.
- Best-effort availability checks.
- Fallback booking URL storage.
- Booking request fallback with customer request-received SMS and owner alert when eligible.

Not enabled now:

- Direct appointment creation in Mindbody.
- Appointment update/reschedule/cancel in Mindbody.
- Mindbody webhook ingestion.
- Client creation/search.

## Required Credentials And Env Vars

Shop-level credentials are stored in `shops.integration_credentials_encrypted`. Legacy Mindbody payloads previously stored in `shops.google_cal_credentials_encrypted` are read as a fallback and migrated by `0055_shop_integration_credentials.sql`.

```json
{
  "provider": "mindbody",
  "siteId": "12345",
  "apiKey": "secret",
  "sourceName": "RingBooker",
  "locationId": "1",
  "sessionTypeId": "17",
  "staffId": "5",
  "bookingUrl": "https://clients.mindbodyonline.com/..."
}
```

Optional environment fallbacks:

- `MINDBODY_API_BASE_URL` defaults to `https://api.mindbodyonline.com/public/v6`
- `MINDBODY_API_KEY`
- `MINDBODY_SITE_ID`
- `MINDBODY_SOURCE_NAME`
- `MINDBODY_STAFF_TOKEN`
- `MINDBODY_LOCATION_ID`
- `MINDBODY_SESSION_TYPE_ID`
- `MINDBODY_STAFF_ID`
- `MINDBODY_BOOKING_URL`
- `MINDBODY_TIMEOUT_MS`
- `MINDBODY_WRITE_CONTRACT_VERIFIED` defaults to off. This is intentionally not a normal launch flag; do not enable it until Mindbody appointment write request/response bodies, permissions, idempotency behavior, client mapping, service/session mapping, staff/location mapping, and failure modes are verified with approved credentials.

## Setup Steps

1. Create or use an approved Mindbody developer account.
2. Activate access to the Mindbody business/site.
3. Create an API key in the Mindbody developer portal.
4. In RingBooker, open `User Panel -> Integrations -> Mindbody`.
5. Enter Site ID and API key.
6. Optionally enter source name, location ID, session type ID, staff ID, and a booking URL fallback.
7. Save.
8. Use provider options or logs to verify services/staff can be fetched.

## Data Model Changes

Migration added: `src/backend/db/migrations/0055_shop_integration_credentials.sql`.

Mindbody uses provider-neutral integration storage:

- `shops.integration_credentials_encrypted` stores the Mindbody credential JSON.
- `shops.google_cal_credentials_encrypted` remains for Google/Square legacy calendar providers and as read-only fallback for old Mindbody payloads.
- `shops.booking_method = 'app'`
- `shops.selected_integration = 'mindbody'`
- `shops.booking_url` optionally stores a fallback URL.

Existing booking request behavior remains unchanged.

## API Endpoints Used

Implemented client calls:

- `GET /sale/services`
- `GET /staff/staff`
- `GET /appointment/availability`

Headers sent by the backend client:

- `API-Key`
- `SiteId`
- `User-Agent`
- `Authorization` only when a staff token is configured

RingBooker user API routes:

- `POST /api/backend/user/calendar/providers/mindbody/connect`
- `POST /api/backend/user/calendar/providers/mindbody/disconnect`
- `GET /api/backend/user/calendar/providers`
- `GET /api/backend/user/calendar/providers/mindbody/options`

## Booking Flow

Current production-safe behavior:

1. AI captures caller request.
2. RingBooker checks availability if Mindbody credentials are configured.
3. If availability is unavailable or the API errors, RingBooker does not promise a confirmed appointment.
4. `createBooking()` returns a request-only result unless future verified write support is implemented. `MINDBODY_WRITE_CONTRACT_VERIFIED=true` alone must not be treated as production-ready booking creation.
5. Owner notification and booking request fallback continue through the existing RingBooker flow.

The AI must not say an appointment is confirmed unless a future Mindbody write implementation returns a successful appointment ID.

## Reschedule And Cancel Flow

Reschedule and cancel are intentionally deferred in this phase.

The provider methods currently throw a clear unsupported-write error. Existing RingBooker request handling remains the fallback. Do not add request bodies for these operations until verified against official Mindbody documentation and approved credentials.

## Webhook Support

Deferred.

Official Mindbody Webhooks include appointment booking created, updated, and cancelled events. They require subscription setup, `API-Key`, `User-Agent`, and signature validation. RingBooker does not register or process Mindbody webhooks in this phase.

## Error Handling

- Every Mindbody API call logs provider, shop ID, method, path, status, and duration.
- API keys and tokens are never logged.
- Auth failures and API errors surface as `mindbody_request_failed` or `mindbody_request_error`.
- Availability API errors return unavailable instead of confirmed.
- Booking write is disabled and returns request-only fallback. The UI labels current booking mode as “capture request only.”

## Limitations

- Appointment create/update/cancel is not implemented.
- Client creation/search and payment/package handling are not implemented.
- Service-to-session mappings are not auto-created.
- Webhooks are documented but not implemented.
- Official interactive endpoint request bodies may require an authenticated Mindbody developer portal session, so write APIs remain feature-flagged until verified with partner credentials.

## Testing Instructions

Run targeted tests:

```bash
npx tsx --test src/backend/services/booking-providers/mindbody.test.ts
npx tsx --test src/backend/api/booking-link-settings.test.ts
```

Run typecheck:

```bash
npx tsc --noEmit --incremental false
```

## Deployment Checklist

1. Confirm production has approved Mindbody API access.
2. Add optional env fallbacks if using account-level credentials.
3. Keep `MINDBODY_WRITE_CONTRACT_VERIFIED` unset. Enabling future write support requires code changes plus verified API contracts and mappings; do not use this flag as a shortcut.
4. Connect a test shop from the Integrations page.
5. Verify services/staff options load.
6. Verify failed availability/booking still creates a RingBooker booking request.
7. Monitor logs for `mindbody_api_request_ok`, `mindbody_api_request_failed`, and `mindbody_check_availability_failed`.

## Future Improvements

- Implement staff login/token flow if required by appointment writes.
- Add service/session/staff mapping UI.
- Add client lookup/create flow.
- Implement appointment create/update/cancel after request bodies are verified with approved credentials, including tests that prove RingBooker only returns `confirmed=true` after Mindbody returns a real appointment ID/status.
- Add Mindbody webhook subscription management and webhook ingestion.
- Persist imported Mindbody service/staff snapshots for faster prompt building.
