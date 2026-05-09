# RingBooker

Nền tảng AI phone receptionist cho salon/spa/clinic:
- Website marketing + live demo call
- User portal (vận hành shop)
- Admin portal (quản trị hệ thống/shop)
- Backend API + webhook + background jobs
- Realtime voice agent qua `LiveKit` + provider AI (`Gemini Live` / `OpenAI Realtime`)

## 1) Hệ thống chức năng hiện có

### Marketing
- Trang home/pricing/how-it-works/contact/demo.
- `/demo` có flow gọi thử thật theo số khách nhập (khi cấu hình provider thật).
- Có chống abuse cho demo public: captcha + rate limit + anti-abuse.

### User Portal
- Đăng ký/đăng nhập/forgot/reset password.
- Dashboard, bookings, calls, settings, billing.
- Settings theo capability của gói (plan-gated settings).

### Admin Portal
- Quản lý shops, shop detail, users, calls, billing, system health.
- Từ shop có thể đi sang calls liên quan, xem transcript preview.

### Backend/API
- API auth user/admin + session.
- API user/admin cho dashboard/bookings/calls/settings/billing.
- API demo public.
- Runtime/profile endpoint, metrics endpoint (nội bộ).

### Voice/Realtime
- Transport: `LiveKit`.
- Voice provider: `gemini_live` hoặc `openai_realtime`.
- Worker dispatch riêng (`agent:worker`) để xử lý realtime session.

### Integrations
- Telnyx (telephony + webhook verify/dedupe).
- Paddle (billing + webhook sync).
- Google Calendar (availability/create/reschedule/cancel).
- Supabase (repo mode production).
- Redis (cache/rate-limit cross-instance, optional nhưng khuyến nghị).

### Security/Hardening
- Middleware + route guards cho user/admin.
- Rate limit theo endpoint/policy.
- Webhook signature verification + replay/dedupe protection.
- Security headers + audit log events.

## 2) Kiến trúc runtime

- Frontend + API: Next.js App Router
- Backend route handler: Hono mounted trong `/api/backend/[[...route]]`
- Worker jobs: `src/backend/jobs/worker-entry.ts`
- Realtime worker: `src/agent/realtime/worker-entry.ts`
- Repository mode:
  - `memory` (local/dev)
  - `supabase` (production)

## 3) Yêu cầu trước khi chạy local

- Node.js 20+ (khuyến nghị LTS mới).
- `npm install`
- Copy env:
  - `cp .env.example .env`

## 4) Chạy local nhanh

1. Chạy app:
```bash
npm run dev
```

2. Chạy worker jobs (terminal khác):
```bash
npm run worker
```

3. (Nếu test realtime worker tách process):
```bash
npm run agent:worker
```

4. Chạy test:
```bash
npm test
```

5. Build check:
```bash
npm run build
```

## 5) Database migrations cần áp dụng

Thư mục migration: `src/backend/db/migrations`.

Áp dụng tuần tự tối thiểu:
- `0001_init_core.sql`
- `0002_call_logs_and_missed_calls.sql`
- `0003_rename_owner_to_user.sql` (nếu môi trường cũ)
- `0004_auth_users_and_reset_tokens.sql`
- `0005_rls_multi_tenant.sql`
- `0006_billing_abstraction.sql`
- `0007_shop_dynamic_config.sql`
- `0008_call_logs_transcript_text.sql`
- `0009_call_logs_demo_live_state.sql`

## 6) Chuẩn bị để triển khai thật (production checklist)

### A. Hạ tầng
- Deploy app server (Next.js) và worker process riêng.
- Bật persistent logging (stdout aggregation hoặc log platform).
- Bật HTTPS và domain thật cho app.
- Chọn region gần khách hàng + gần provider voice để giảm latency.

### B. Cấu hình bắt buộc trong `.env`

#### Core
- `NODE_ENV=production`
- `APP_BASE_URL=https://your-domain`
- `BACKEND_INTERNAL_API_KEY=<strong-random>`
- `APP_ENCRYPTION_KEY=<32+ chars>`
- `APP_SIGNING_SECRET=<32+ chars>`

#### Data
- `BACKEND_REPOSITORY_MODE=supabase`
- `SUPABASE_URL=...`
- `SUPABASE_SERVICE_KEY=...`

#### Voice realtime
- `AGENT_TRANSPORT=livekit`
- `AGENT_VOICE_PROVIDER=gemini_live` hoặc `openai_realtime`
- `AGENT_VOICE_MODEL=...`
- `LIVEKIT_URL=...`
- `LIVEKIT_API_KEY=...`
- `LIVEKIT_API_SECRET=...`

#### Telephony
- `BACKEND_COMM_PROVIDER=telnyx`
- `TELNYX_API_KEY=...`
- `TELNYX_APP_ID=...`
- `TELNYX_WEBHOOK_PUBLIC_KEY=...`
- `TELNYX_MESSAGING_PROFILE=...`

#### Billing
- `BILLING_PROVIDER=paddle`
- `BILLING_CHECKOUT_ENABLED=false` until Paddle sandbox checkout and webhooks pass manual QA; set `true` to expose checkout buttons.
- `PADDLE_API_KEY=...`
- `PADDLE_CLIENT_TOKEN=...`
- `PADDLE_WEBHOOK_SECRET=...`
- `PADDLE_ENV=sandbox|production`
- `PADDLE_PRICE_STARTER_MONTHLY=...`
- `PADDLE_PRICE_STARTER_ANNUAL=...`
- `PADDLE_PRICE_PROFESSIONAL_MONTHLY=...`
- `PADDLE_PRICE_PROFESSIONAL_ANNUAL=...`

#### Calendar
- `GOOGLE_SERVICE_ACCOUNT_EMAIL=...`
- `GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY=...`
- hoặc credential theo shop (nếu dùng flow per-shop)

#### Demo public chống abuse
- `TURNSTILE_SECRET_KEY=...`
- `NEXT_PUBLIC_TURNSTILE_SITE_KEY=...`
- `PUBLIC_DEMO_SHOP_ID=...`

#### Email (nếu dùng gửi mail thật)
- `EMAIL_PROVIDER=resend`
- `RESEND_API_KEY=...`
- `EMAIL_FROM_ADDRESS=...`

#### Cache/rate limit cross-instance (khuyến nghị mạnh)
- `REDIS_URL=...`

### C. Process bắt buộc khi chạy thật
- `next start` (app/API)
- `npm run worker` (job worker)
- `npm run agent:worker` được spawn qua dispatch command (nếu dùng tách process realtime)

### D. Webhook production
- Public endpoint hoạt động:
  - `/api/backend/webhooks/telnyx`
  - `/api/backend/webhooks/paddle`
- Đảm bảo verify signature bật đúng secret/key.
- Đảm bảo replay/dedupe hoạt động (`provider_events`).

### E. Security bắt buộc
- Không dùng credential mặc định trong `.env.example`.
- RLS + tenant isolation đã migrate và test.
- Rate limit bật cho auth/public demo/webhook/api nhạy cảm.
- Bật audit log collection.

## 7) Kiểm tra trước go-live

1. Readiness:
```bash
npm run check:readiness
```

2. Smoke inbound:
```bash
npm run smoke:inbound
```

3. Nếu dùng OpenAI realtime:
```bash
npm run check:readiness:openai
npm run smoke:openai-realtime
```

4. Staging playbook:
```bash
npm run e2e:staging:playbook
```

5. Xác nhận thủ công:
- User signup/login/forgot/reset hoạt động.
- Owner/User settings save đúng theo plan capability.
- Admin shop/calls/billing load được data thật.
- Demo public gọi thật được, có captcha + rate limit.
- Telnyx/Paddle webhook nhận và sync đúng.
- Worker xử lý job reminder/review/callback.

## 8) Scripts vận hành quan trọng

- `npm run reconcile:provider-events`
- `npm run reconcile:paddle-subscriptions`

## 9) Ghi chú triển khai

- Không chạy nhiều `next dev` cùng lúc trên một project (dễ corrupt `.next` cache dev).
- Nếu đổi `.env`, restart app + worker để nhận config mới.
- Với production, quản lý secret qua secret manager (không commit `.env`).

---

Tài liệu backend chi tiết hơn: [src/backend/README.md](/Users/huypq/Documents/Projects/Others/ringbooker.ai/ringbooker.com/src/backend/README.md)
