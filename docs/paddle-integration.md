# Paddle Integration Setup

This document describes how RingBooker connects to Paddle Billing for sandbox and production checkout.

## Current architecture

RingBooker uses one Paddle Billing integration for both sandbox and production.

```text
User clicks Add payment method
→ POST /api/backend/user/billing/checkout
→ Backend creates a Paddle transaction
→ Paddle redirects to /checkout/paddle?_ptxn=...
→ /checkout/paddle loads Paddle.js and opens checkout
→ Paddle webhook confirms billing state
→ RingBooker keeps live answering disabled until billing + go-live checks pass
```

Important rules:

- Frontend never sends Paddle price IDs.
- Frontend only sends `plan` and `billing_interval` when needed.
- Backend maps plan + interval to Paddle price IDs from env.
- Checkout success in the browser does **not** enable live answering.
- Only verified Paddle webhook state can make billing valid.
- Setup/test calls can run without a card if the current product policy allows it.
- Business-number live answering requires valid billing, payment method, forwarding setup, and go-live enablement.

## Required environment variables

Use sandbox values in staging/sandbox and production values in production.

```env
BILLING_PROVIDER=paddle
BILLING_CHECKOUT_ENABLED=true
BILLING_MANAGE_ENABLED=false

PADDLE_ENV=sandbox
# or:
# PADDLE_ENV=production

PADDLE_API_KEY=ptl_xxxxxxxxxxxx
PADDLE_CLIENT_TOKEN=pdl_client_xxxxxxxxxxxx
PADDLE_WEBHOOK_SECRET=pdl_ntfset_xxxxxxxxxxxx
PADDLE_WEBHOOK_MAX_SKEW_SECONDS=300

PADDLE_PRICE_STARTER_MONTHLY=pri_xxxxxxxxx
PADDLE_PRICE_STARTER_ANNUAL=pri_xxxxxxxxx
PADDLE_PRICE_PROFESSIONAL_MONTHLY=pri_xxxxxxxxx
PADDLE_PRICE_PROFESSIONAL_ANNUAL=pri_xxxxxxxxx

# Only set true after Paddle trial/payment behavior has been manually verified.
PADDLE_TRIAL_CONFIG_VERIFIED=false
NEXT_PUBLIC_PADDLE_TRIAL_CONFIG_VERIFIED=false
```

Notes:

- `PADDLE_ENV=sandbox` uses `https://sandbox-api.paddle.com`.
- `PADDLE_ENV=production` uses `https://api.paddle.com`.
- `PADDLE_CLIENT_TOKEN` is intentionally exposed to the checkout page. Do not expose `PADDLE_API_KEY`.
- Keep `BILLING_CHECKOUT_ENABLED=false` until checkout and webhooks pass manual QA.
- Keep `BILLING_MANAGE_ENABLED=false` until Paddle Customer Portal QA passes for update card, cancel, and invoices.

## Paddle Dashboard setup

Configure these in the Paddle Dashboard for the matching environment.

### 1. Products and prices

Create prices for:

- Starter monthly
- Starter annual
- Professional monthly
- Professional annual

Copy each Paddle price ID into the matching env var.

### 2. Default payment link

Set the Paddle **Default payment link** to:

```text
https://ringbooker.com/checkout/paddle
```

For staging, use the staging domain equivalent:

```text
https://staging.example.com/checkout/paddle
```

Do **not** set this to:

```text
/user/billing?checkout=success
```

That URL is only the post-checkout return page. It is not the Paddle checkout page.

### 3. Website/domain approval

If Paddle requires domain approval, approve the domain that hosts `/checkout/paddle`:

```text
ringbooker.com
```

or the staging domain for sandbox testing.

### 4. Webhook destination

Set Paddle webhook URL to:

```text
https://ringbooker.com/api/backend/webhooks/paddle
```

Method:

```text
POST
```

For local/staging, use the matching public URL.

### 5. Webhook events

Enable these events:

```text
transaction.completed
transaction.payment_failed
subscription.created
subscription.trialing
subscription.activated
subscription.updated
subscription.canceled
subscription.paused
subscription.resumed
subscription.past_due
payment_method.saved
payment_method.deleted
customer.created
customer.updated
```

## CSP requirements

Paddle checkout requires these domains in Content Security Policy:

```text
script-src: https://cdn.paddle.com
connect-src: https://api.paddle.com https://sandbox-api.paddle.com https://*.paddle.com
frame-src: https://*.paddle.com
form-action: https://*.paddle.com
```

RingBooker configures these in:

- `middleware.ts`
- `src/backend/api/app.ts`

If checkout shows `Paddle checkout could not load`, check browser console for CSP errors first.


## Self-serve billing management

RingBooker uses Paddle-hosted billing management for self-serve Starter and Professional accounts.

```text
User clicks Manage billing
→ POST /api/backend/user/billing/manage
→ Backend verifies session, CSRF, shop ownership, Paddle customer/subscription ownership
→ Backend creates a Paddle customer portal session
→ User manages billing in Paddle-hosted UI
→ Paddle webhook confirms any billing state changes
→ RingBooker updates local billing/access state only from verified webhook
```

Supported through Paddle portal when the Paddle account/dashboard enables the matching portal capability:

- Update payment method / replace card.
- Cancel subscription.
- View official invoices and payment receipts.
- Manage subscription details exposed by Paddle.

Important rules:

- RingBooker does not collect or store card details.
- Frontend never sends `provider_customer_id` or `provider_subscription_id`.
- Frontend never sends arbitrary portal return URLs.
- The manage endpoint accepts an empty JSON body only.
- Portal return does **not** change billing state.
- Cancel/update card only affects RingBooker after a verified Paddle webhook is processed.
- Custom/Enterprise accounts do not use self-serve Paddle management; show Contact support / managed billing.

Current endpoint:

```text
POST /api/backend/user/billing/manage
```

Eligibility:

- Authenticated user session.
- Same-origin/CSRF check passes.
- Self-serve plan: Starter or Professional.
- Current billing provider is Paddle.
- Current subscription status is one of:
  - `active`
  - `trialing`
  - `past_due`
  - `paused`
- `provider_customer_id` exists.
- `provider_subscription_id` exists.
- Stored Paddle customer/subscription belongs to the authenticated shop.

Expected response:

```json
{
  "ok": true,
  "provider": "paddle",
  "manageUrl": "https://customer-portal.paddle.com/...",
  "canViewInvoicesViaPortal": true,
  "canUpdatePaymentMethodViaPortal": true,
  "canCancelViaPortal": true
}
```

The response must not include:

- Paddle API key.
- Paddle webhook secret.
- Raw Paddle response payload.
- `provider_customer_id`.
- `provider_subscription_id`.

### Manage Billing UI states

Active/trialing self-serve account:

```text
Title: Billing is active
CTA: Manage billing
Body: Update your payment method, view invoices, or manage your subscription.
Note: Changes made in billing management may take a minute to appear here.
```

Past due / paused account:

```text
Title: Billing issue
CTA: Resolve billing issue
Body: Update your payment method to restore live answering.
```

If Paddle portal is available, `Resolve billing issue` may open billing management. Otherwise use the existing reactivate checkout flow.

Canceled account:

```text
Title: Subscription canceled
CTA: Restart 14-day trial or Contact support
Body: Live answering is paused. Restart billing when you are ready to go live again.
```

Custom/Enterprise account:

```text
Title: Managed billing
CTA: Contact support / Contact sales
Body: Billing changes are handled by the RingBooker team.
```

### Invoice wording

The RingBooker Billing page shows local subscription activity only. Do not call this official invoice history unless Paddle invoice data is fetched directly.

Use:

```text
Account billing activity
Recent subscription activity and renewal timing. Official invoices and payment receipts are available in billing management.
```

Do not use:

```text
Billing history
Official invoices
Receipts
```

unless those documents come from Paddle-hosted billing management or Paddle invoice APIs.

## Cancel and payment method update behavior

### Update payment method

Expected flow:

```text
User opens Manage billing
→ User updates card/payment method in Paddle portal
→ Paddle sends payment_method.saved and/or subscription.updated
→ RingBooker verifies webhook signature
→ RingBooker updates payment_method_status from webhook
→ Live answering gates recompute from backend state
```

Rules:

- Do not mark `payment_method_status=valid` from frontend return.
- Do not enable live answering from portal return.
- `payment_method.saved` may contain only `customer_id`; RingBooker must resolve the internal billing customer by `provider_customer_id`.
- `payment_method.deleted` sets payment method invalid/failed and blocks live answering when policy requires a valid payment method.

### Cancel subscription

Expected flow:

```text
User opens Manage billing
→ User cancels in Paddle portal
→ Paddle sends subscription.canceled or subscription.updated with cancellation fields
→ RingBooker verifies webhook signature
→ RingBooker updates local subscription from webhook
→ Live answering is paused only when Paddle status becomes canceled/paused/past_due
```

Rules:

- Do not set local subscription to `canceled` from portal return.
- If Paddle schedules cancellation at period end but status remains `active`, do not prematurely block live answering.
- When status becomes `canceled`, `paused`, or `past_due`, live answering must be blocked before any costly call path.
- Duplicate cancel/update webhooks must be idempotent.
- Older active/trialing events must not re-enable access after newer canceled/paused/past_due events.

## Self-serve plan upgrade

RingBooker supports one self-serve plan change in-app:

```text
Starter → Professional
```

Not supported in this pass:

- Professional → Starter downgrade.
- Starter/Professional → Custom self-serve.
- Custom/Enterprise self-serve plan changes.

Upgrade flow:

```text
Starter user clicks Upgrade to Professional
→ POST /api/backend/user/billing/upgrade
→ Backend verifies session, CSRF, shop ownership, plan eligibility, Paddle customer/subscription ownership
→ Backend maps target_plan + billing_interval to env Paddle Professional price ID
→ Backend calls Paddle subscription update API
→ RingBooker stores upgrade pending metadata only
→ Paddle sends verified subscription.updated webhook
→ RingBooker maps Paddle price ID back to Professional
→ Professional features unlock only after webhook-confirmed local plan update
```

Endpoint:

```text
POST /api/backend/user/billing/upgrade
```

Input:

```json
{
  "target_plan": "professional",
  "billing_interval": "monthly"
}
```

Allowed `billing_interval` values:

- `monthly`
- `annual`

Security rules:

- Auth required.
- Same-origin/CSRF required.
- Rate limited by `user_billing_upgrade`.
- Load shop only from authenticated session.
- Current local plan must be Starter.
- Current Paddle subscription plan must be Starter.
- Current subscription status must be `active` or `trialing`.
- `provider_customer_id` and `provider_subscription_id` must exist.
- Custom/Enterprise cannot self-serve upgrade.
- Frontend must not send Paddle price IDs.
- Frontend must not send Paddle customer/subscription IDs.
- Backend must not set local plan to Professional immediately.
- Paddle webhook `subscription.updated` is the source of truth.

Paddle API behavior:

- Backend updates the existing Paddle subscription item to the Professional price.
- Current proration mode: `prorated_next_billing_period`.
- Payment failure behavior: `prevent_change`.

Expected API response:

```json
{
  "ok": true,
  "status": "pending",
  "message": "Your upgrade is being processed. Professional features will unlock after billing is confirmed."
}
```

UI behavior:

- Starter active/trialing: show `Upgrade to Professional`.
- After request succeeds: show `Upgrade pending` and `Refresh status`.
- Before webhook confirms: keep Starter feature gates active.
- After webhook confirms Professional price: show Professional as current plan and unlock Professional gated features.
- Billing issue states: show `Resolve billing issue`, not upgrade-first.
- Professional: show `Current plan: Professional` and `Manage billing`.
- Custom/Enterprise: show managed billing/contact support.

Rollback:

- Set `BILLING_CHECKOUT_ENABLED=false` to hide/disable checkout/reactivate/upgrade flows.
- Set `BILLING_MANAGE_ENABLED=false` to hide/disable Paddle Customer Portal / Manage Billing without affecting checkout/reactivate/webhooks.

## Production readiness notes for billing management

Before public production rollout, manually confirm in Paddle Dashboard and with an internal production account:

- Paddle customer portal sessions can be created.
- Portal opens the correct customer/subscription.
- Payment method update works.
- Cancel subscription works if product policy allows self-serve cancellation.
- Invoice/receipt access works if the UI says invoices are available in billing management.
- Paddle sends webhook events after portal changes.
- RingBooker webhook logs return `200`.
- Local DB state updates only after webhook.
- Portal return does not mutate billing or live answering state.
- Canceled/paused/past_due/payment_method.deleted blocks live answering.
- Custom/Enterprise cannot open self-serve portal.
- No Paddle API key or webhook secret appears in API responses or logs.

Recommended operational improvement before broad rollout:

- Use `BILLING_MANAGE_ENABLED=false` as the emergency kill switch for Manage Billing independent of checkout.
- Optionally allowlist Paddle customer portal hostnames before redirecting to `manageUrl`.


## Manual sandbox QA checklist

Run this after deploying sandbox env values.

1. Confirm env:
   - `PADDLE_ENV=sandbox`
   - `BILLING_CHECKOUT_ENABLED=true`
   - `BILLING_MANAGE_ENABLED=true` if testing Paddle Customer Portal / Manage Billing
   - all four self-serve price IDs set
   - `PADDLE_CLIENT_TOKEN` set
   - `PADDLE_WEBHOOK_SECRET` set

2. Confirm Paddle Dashboard:
   - Default payment link is `/checkout/paddle`
   - Webhook destination is `/api/backend/webhooks/paddle`
   - Required events are enabled
   - Domain is approved if Paddle requires it

3. Test checkout buttons:
   - Starter monthly
   - Starter annual
   - Professional monthly
   - Professional annual

4. Verify browser behavior:
   - `POST /api/backend/user/billing/checkout` returns `200`
   - response includes `checkoutUrl`
   - browser navigates to `/checkout/paddle?_ptxn=...`
   - Paddle overlay opens
   - user can enter sandbox payment details

5. Verify webhook behavior:
   - Paddle webhook logs show status `200`
   - `billing_subscriptions.provider_subscription_id` is set
   - `billing_subscriptions.provider_customer_id` is set
   - `payment_method_status` becomes `valid` after payment method save
   - canceled/paused/past_due/payment_method.deleted block live answering

6. Verify go-live behavior:
   - checkout success alone does not enable live answering
   - no-payment user cannot provision forwarding number
   - valid billing user can proceed to forwarding setup
   - live answering only enables after forwarding verification/manual confirmation and go-live enable

## Common errors

### `transaction_default_checkout_url_not_set`

Paddle returned:

```text
transaction_default_checkout_url_not_set
```

Fix:

- Set Paddle Dashboard Default payment link to `/checkout/paddle`.
- Confirm the backend sends `checkout.url` as `https://.../checkout/paddle`.

### `Paddle checkout could not load`

Likely causes:

- CSP blocks `https://cdn.paddle.com/paddle/v2/paddle.js`.
- Browser extension blocks Paddle.
- Network cannot reach Paddle CDN.
- `PADDLE_CLIENT_TOKEN` is missing.

Check:

- Browser console CSP errors.
- Network tab request to `https://cdn.paddle.com/paddle/v2/paddle.js`.
- Server env includes `PADDLE_CLIENT_TOKEN`.

### `Checkout session is missing`

The page opened without Paddle transaction query param.

Expected checkout URL should look like:

```text
https://ringbooker.com/checkout/paddle?_ptxn=txn_...
```

If `_ptxn` is missing, inspect the backend checkout response and Paddle transaction creation response.

### Checkout returns success but billing still not valid

This is expected until Paddle webhook is received and processed.

Check:

- Paddle webhook logs
- RingBooker server logs for `/api/backend/webhooks/paddle`
- `billing_subscriptions` row status and `payment_method_status`

## Production rollout checklist

Before enabling production checkout:

- [ ] Production Paddle products/prices created.
- [ ] Production `PADDLE_API_KEY` set.
- [ ] Production `PADDLE_CLIENT_TOKEN` set.
- [ ] Production `PADDLE_WEBHOOK_SECRET` set.
- [ ] Production price IDs set.
- [ ] `PADDLE_ENV=production`.
- [ ] Default payment link set to `https://ringbooker.com/checkout/paddle`.
- [ ] Webhook URL set to `https://ringbooker.com/api/backend/webhooks/paddle`.
- [ ] Webhook events enabled.
- [ ] Domain approved in Paddle.
- [ ] Sandbox QA passed.
- [ ] Production smoke test passed with a real checkout.
- [ ] `BILLING_CHECKOUT_ENABLED=true` only after checkout QA is complete.
- [ ] `BILLING_MANAGE_ENABLED=true` only after Paddle Customer Portal QA is complete.
