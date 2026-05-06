# Onboarding / Go-Live Production Rollout Checklist

Scope: post-P0 security rollout for signup -> onboarding -> payment -> forwarding number -> forwarding test -> live answering.

Rules:
- Do not provision forwarding numbers before payment is valid and the user explicitly starts go-live.
- Do not enable live answering until payment, onboarding, forwarding number, and forwarding verification/manual confirmation are complete.
- Use Call Control as the automatic forwarding verification path.
- TeXML must not mutate forwarding verification.

## A. Migration Checklist

Apply migrations in order:

1. `0031_forwarding_setup_verification.sql`
2. `0032_forwarding_test_sessions.sql`
3. `0033_forwarding_number_provisioning_lock.sql`
4. `0035_commercial_go_live_approval.sql`

Staging checks before production:

```sql
-- 0031: forwarding verification columns
SELECT
  column_name,
  data_type
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'shop_access_states'
  AND column_name IN (
    'forwarding_setup_verified_at',
    'forwarding_setup_verified_via'
  )
ORDER BY column_name;

-- 0032: forwarding test sessions table
SELECT
  table_name
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name = 'forwarding_test_sessions';

SELECT
  indexname,
  indexdef
FROM pg_indexes
WHERE schemaname = 'public'
  AND tablename = 'forwarding_test_sessions'
  AND indexname IN (
    'idx_forwarding_test_sessions_shop_created',
    'idx_forwarding_test_sessions_shop_pending_expires'
  )
ORDER BY indexname;

-- 0033: provisioning lock columns
SELECT
  column_name,
  data_type,
  column_default
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'shops'
  AND column_name IN (
    'forwarding_number_status',
    'forwarding_number_provisioning_started_at',
    'forwarding_number_provider_order_id',
    'forwarding_number_last_error'
  )
ORDER BY column_name;

-- 0033: unique partial index on shops.telnyx_number
SELECT
  indexname,
  indexdef
FROM pg_indexes
WHERE schemaname = 'public'
  AND tablename = 'shops'
  AND indexname = 'idx_shops_telnyx_number_unique';

-- 0035: commercial approval columns
SELECT
  column_name,
  data_type
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'shop_access_states'
  AND column_name IN (
    'commercial_go_live_approved_at',
    'commercial_go_live_approved_by',
    'commercial_go_live_approval_note'
  )
ORDER BY column_name;
```

Expected:
- `shop_access_states.forwarding_setup_verified_at` exists.
- `shop_access_states.forwarding_setup_verified_via` exists.
- `forwarding_test_sessions` exists.
- Both forwarding test indexes exist.
- Four provisioning lock columns exist on `shops`.
- `idx_shops_telnyx_number_unique` exists and includes `WHERE (telnyx_number IS NOT NULL)`.
- Three commercial approval columns exist on `shop_access_states`.

## B. Legacy Live Shop Audit

Run read-only audit first:

```sql
-- scripts/audit-shop-access-live-without-forwarding-verification.sql
SELECT
  sas.shop_id,
  s.name AS shop_name,
  s.phone_number,
  s.telnyx_number,
  s.plan,
  s.active,
  sas.live_calls_enabled,
  sas.go_live_at,
  sas.forwarding_setup_verified_at,
  sas.forwarding_setup_verified_via,
  sas.updated_at AS shop_access_states_updated_at
FROM shop_access_states sas
INNER JOIN shops s ON s.id = sas.shop_id
WHERE sas.live_calls_enabled = TRUE
  AND sas.forwarding_setup_verified_at IS NULL
ORDER BY sas.go_live_at NULLS LAST, s.name ASC;
```

Interpretation:
- Zero rows: no legacy live backfill needed.
- Rows with `telnyx_number IS NOT NULL`: eligible for optional legacy backfill after review.
- Rows with missing `telnyx_number`: investigate manually; do not backfill automatically.

## C. Optional Legacy Backfill

Use only after audit review.

Script:

```sql
-- scripts/backfill-forwarding-verification-legacy-live.sql
BEGIN;

-- Before
SELECT
  sas.shop_id,
  s.name AS shop_name,
  s.telnyx_number,
  sas.go_live_at,
  sas.forwarding_setup_verified_at,
  sas.forwarding_setup_verified_via
FROM shop_access_states sas
INNER JOIN shops s ON s.id = sas.shop_id
WHERE sas.live_calls_enabled = TRUE
  AND sas.forwarding_setup_verified_at IS NULL
  AND s.telnyx_number IS NOT NULL
  AND length(trim(s.telnyx_number)) > 0;

UPDATE shop_access_states sas
SET
  forwarding_setup_verified_at = COALESCE(sas.go_live_at, sas.updated_at, now()),
  forwarding_setup_verified_via = 'legacy_live',
  updated_at = now()
FROM shops s
WHERE sas.shop_id = s.id
  AND sas.live_calls_enabled = TRUE
  AND sas.forwarding_setup_verified_at IS NULL
  AND s.telnyx_number IS NOT NULL
  AND length(trim(s.telnyx_number)) > 0;

-- After
SELECT
  sas.shop_id,
  s.name AS shop_name,
  s.telnyx_number,
  sas.go_live_at,
  sas.forwarding_setup_verified_at,
  sas.forwarding_setup_verified_via
FROM shop_access_states sas
INNER JOIN shops s ON s.id = sas.shop_id
WHERE sas.live_calls_enabled = TRUE
  AND sas.forwarding_setup_verified_at IS NULL;

ROLLBACK;
-- COMMIT;
```

Default is `ROLLBACK`. To apply, review output, then change the final lines to:

```sql
-- ROLLBACK;
COMMIT;
```

## D. Staging Smoke Checklist

TeXML:
- Send fake unsigned `POST /telnyx/texml/inbound` with `To=<shop telnyx_number>` while a forwarding test is pending.
- Confirm `forwarding_test_sessions.status` remains `pending`.
- Confirm `shop_access_states.forwarding_setup_verified_at` remains null.
- Call `GET /telnyx/texml/inbound`; expect `405`.

Call Control forwarding verification:
- Start forwarding test from UI/API.
- Place a real Telnyx signed inbound Call Control call to the shop forwarding number.
- Confirm `forwarding_test_sessions.status = 'passed'`.
- Confirm `forwarding_setup_verified_via = 'inbound_test_call'`.

Call-me:
- POST `/user/test-calls/call-me` with `{ "phoneNumber": "+1..." }`; expect `400 invalid_payload`.
- Clear or invalidate `shop.user_phone`; expect `422 phone_number_required`.
- With valid `shop.user_phone`, confirm outbound call uses `RINGBOOKER_OUTBOUND_CALLER_ID` or `TELNYX_OUTBOUND_CALLER_ID`.
- Confirm no number provisioning call happens during call-me.

Provision forwarding number:
- Add valid payment method.
- Double-click/two-tab call `POST /user/phone-numbers/provision-forwarding-number`.
- Confirm only one Telnyx order is created.
- Confirm second request returns existing number or `409 forwarding_number_provisioning_in_progress`.
- Confirm `shop.phone_number` remains unchanged.
- Confirm `shops.telnyx_number` set once.

Manual confirmation:
- No payment method: expect `402 payment_method_required`.
- Expired trial: expect `409 trial_expired`.
- Incomplete onboarding: expect `409 onboarding_incomplete`.
- Missing forwarding number: expect `409 forwarding_number_required`.
- Valid state with `confirmForwardingReady: true`: expect verification via `manual_confirmation` and audit event.

Enable live:
- Before verification: expect `409 forwarding_verification_required`.
- After valid payment + onboarding + forwarding number + verification: expect success.
- After payment becomes failed/past_due: inbound live call should be blocked by `canReceiveLiveCalls`.

Commercial / Custom approval:
- Set a shop to `plan = 'enterprise'` with otherwise valid payment/onboarding/forwarding state.
- Before admin approval, confirm these endpoints return `403 commercial_approval_required`:
  - `POST /user/phone-numbers/provision-forwarding-number`
  - `POST /user/go-live/start-forwarding-test`
  - `POST /user/go-live/confirm-forwarding-setup`
  - `POST /user/go-live/enable`
- Approve via admin shop detail or `POST /admin/shops/:id/approve-commercial-go-live`.
- Confirm the same endpoints proceed to their normal next gate after approval.
- Confirm `/user/dashboard`, `/user/billing`, `/user/nav-state`, and `/user/go-live/status` expose commercial approval state only to the authenticated shop owner.

Live inbound:
- With `live_calls_enabled=false`: signed inbound should not start live AI.
- With `live_calls_enabled=true` and `canReceiveLiveCalls=true`: signed inbound should bridge to AI.

## E. Direct Forwarding-Number Policy

Current behavior:
- A direct call to the RingBooker technical forwarding number can pass connectivity verification if it arrives through signed Call Control while a pending forwarding test exists.

Product copy requirement:
- Instructions must clearly say: "Call your current business number from another phone and let it forward to RingBooker."
- Do not tell customers to share or publish the RingBooker forwarding number.
- Do not describe the forwarding number as a new client-facing number.

Launch decision:
- Acceptable for launch if treated as a connectivity proof plus explicit UI copy.
- If stricter proof is required, implementation needs carrier/Telnyx metadata that proves the call arrived through carrier forwarding, or a second manual attestation step.

## F. Release Number / Orphan Cleanup Follow-Up

Implemented:
- `PhoneProvisioningService.releaseNumber()` exists for Telnyx provisioning compensation.
- Telnyx adapter releases by `providerNumberId` with `DELETE /phone_numbers/{id}` when available.
- If no provider number id is available, it creates a Telnyx bulk delete job with `POST /phone_numbers/jobs/delete_phone_numbers`.
- Provisioning flow calls `releaseNumber()` when Telnyx ordering succeeds but persisting `shops.telnyx_number` fails.

Remaining operational TODO:
- Run `scripts/report-forwarding-number-orphans.sql` weekly during the first production rollout.
- The script is report-only and flags shops where:
  - `forwarding_number_status = 'failed'`
  - `forwarding_number_provider_order_id IS NOT NULL`
  - `telnyx_number IS NULL`
- Do not auto-release without operator review because provider order ids may refer to already-compensated releases.
- A future scheduled job can email this report to ops once real-world volume justifies automation.
- Add orphan provisioning cleanup/reconciliation job:
  - Find shops with `forwarding_number_status='failed'`.
  - Find rows with `forwarding_number_provider_order_id IS NOT NULL` but `telnyx_number IS NULL`.
  - Reconcile against Telnyx inventory.
  - Release or flag orphan numbers for manual cleanup.

## G. Go / No-Go Checklist

Go only if all are true:

- Migrations `0031`, `0032`, `0033` applied in staging.
- Production migration plan preserves order `0031 -> 0032 -> 0033`.
- Unique partial index on `shops.telnyx_number` verified.
- Legacy live shop audit returns zero rows or reviewed rows are backfilled/accepted.
- Fake TeXML cannot verify forwarding.
- GET TeXML returns `405`.
- Signed Call Control verifies forwarding.
- Call-me rejects arbitrary `phoneNumber`.
- Double-click provisioning creates one number only.
- Manual confirmation gates pass/fail correctly.
- Enable live is blocked until verification.
- Live inbound is blocked when payment fails/past_due.
- Global deployment gate is not blocked by unrelated `tsc` failures.

No-go if any are true:

- `0033` not applied.
- Legacy live shops remain enabled without verification and without explicit acceptance.
- TeXML can mutate forwarding verification.
- Call-me can call arbitrary user-provided phone numbers.
- Provisioning can create multiple Telnyx numbers for one shop under concurrent requests.
- `canReceiveLiveCalls=false` still allows live AI bridge.
