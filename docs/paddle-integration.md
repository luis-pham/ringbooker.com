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

## Manual sandbox QA checklist

Run this after deploying sandbox env values.

1. Confirm env:
   - `PADDLE_ENV=sandbox`
   - `BILLING_CHECKOUT_ENABLED=true`
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
- [ ] `BILLING_CHECKOUT_ENABLED=true` only after the above is complete.
