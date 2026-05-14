# Backend Extension Guide

This backend is intentionally split by contracts first so we can replace infrastructure without rewriting business logic.

## Current Layers

- `domain/`: stable domain types shared across services.
- `ports/`: repository/service interfaces used by the app layer.
- `adapters/`: provider-specific implementations (`memory`, `supabase`, `telnyx`, `noop`).
- `api/`: Hono app routes (`/health`, `/readiness`, webhooks).
- `webhooks/`: provider-specific verification + dedupe entrypoints.
- `jobs/`: durable worker contract and handler execution flow.
- `services/`: provider abstractions (calendar currently).
- `bootstrap/`: dependency composition (DI runtime).

## How To Upgrade Without Refactor

1. Keep interfaces in `ports/` stable.
2. Replace or extend adapters by provider (`memory`, `supabase`) without changing app/tool code.
3. Update only `bootstrap/runtime.ts` dependency wiring (`BACKEND_REPOSITORY_MODE`, `BACKEND_COMM_PROVIDER`).
4. Keep webhook handlers idempotent by writing provider events first.
5. Add new job types in `domain/types.ts`, then register handlers in worker composition.

## Suggested Next Steps

- Add Supabase migrations and indexes for `jobs` and `provider_events` if not applied yet.
- Add integration tests for webhook signature + dedupe behavior.
- Connect `jobs/runner.ts` handlers to real booking/sms/callback domain flows.
- Run worker process via `npm run worker` (entry: `src/backend/jobs/worker-entry.ts`).

## Internal Test Endpoints

- `GET /api/backend/runtime`: shows active repository/provider mode.
- `POST /api/backend/jobs/enqueue`: enqueue a job for local integration testing.
- `POST /api/backend/jobs/tick`: run one worker tick immediately.
- `POST /api/backend/agent/simulate-inbound`: simulate an inbound agent tool call against real backend contracts.
- `POST /api/backend/agent/start-inbound`: create and start an inbound realtime agent session.
- `POST /api/backend/agent/dispatch`: internal endpoint for worker dispatch handoff (agent process launcher hook).
- `POST /api/backend/agent/dispatch/status`: internal status callback endpoint from spawned agent worker.
- `GET /api/backend/metrics`: internal metrics snapshot (requires `x-backend-key` when configured).
- `GET /api/backend/admin/system-health/metrics`: admin-session protected system-health aggregate (realtime, toolcall, webhook, jobs, API status).
- If `BACKEND_INTERNAL_API_KEY` is set, send it in header `x-backend-key`.

## Realtime Runtime Modes

- Preferred architecture:
  - `AGENT_TRANSPORT=mock|livekit`
  - `AGENT_VOICE_PROVIDER=none|gemini_live|openai_realtime`
  - `AGENT_VOICE_MODEL=<provider-model-name>`
- Current production-ready path:
  - `AGENT_TRANSPORT=livekit`
  - `AGENT_VOICE_PROVIDER=gemini_live`
  - `AGENT_VOICE_MODEL=gemini-3.1-flash-live-preview`
- Legacy fallback remains supported:
  - `AGENT_RUNTIME_MODE=mock`
  - `AGENT_RUNTIME_MODE=livekit_gemini`
- Behavior:
  - `mock` transport/provider uses `MockRealtimeAgentRuntime`.
  - `livekit + gemini_live` uses `LiveKitRealtimeRuntime` with Gemini as the active voice adapter.
  - Runtime metadata now carries transport and LLM provider separately so model providers can change later without rewriting the LiveKit media path.
  - `POST /api/backend/agent/start-inbound` continues to enqueue `realtime_session_dispatch` for worker-driven handoff.

### Realtime Env

- `AGENT_TRANSPORT` (preferred; `mock|livekit`)
- `AGENT_VOICE_PROVIDER` (preferred; `none|gemini_live|openai_realtime`)
- `AGENT_VOICE_MODEL` (preferred provider model name)
- `AGENT_GEMINI_MODEL` (default `gemini-3.1-flash-live-preview`)
- `AGENT_GEMINI_LATENCY_PRESET` (default `balanced`; `balanced|ultra_low_latency`)
- `AGENT_GEMINI_THINKING_LEVEL` (default `minimal`; `minimal|low|medium|high`)
- `AGENT_GEMINI_VAD_START_SENSITIVITY` (default `low`; `low|high`)
- `AGENT_GEMINI_VAD_END_SENSITIVITY` (default `low`; `low|high`)
- `AGENT_GEMINI_VAD_PREFIX_MS` (default `20`)
- `AGENT_GEMINI_VAD_SILENCE_MS` (default `100`)
- `AGENT_CALENDAR_WARMUP_DAYS` (default `2`) prefetch open-day availability at call start.
- `AGENT_DISPATCH_WEBHOOK_URL` (optional, required for live dispatch worker handoff)
- `AGENT_DISPATCH_AUTH_TOKEN` (optional bearer token for dispatch webhook)
- `AGENT_LIVEKIT_AGENT_COMMAND` (optional but recommended for `livekit` transport; used to spawn isolated agent worker process)
- `AGENT_WORKER_MAX_SESSION_MS` (default `1800000`) max room session duration before worker self-disconnect.
- `AGENT_AUDIO_METRICS_INTERVAL_MS` (default `10000`) interval for logging realtime audio latency/jitter metrics.
- `LIVEKIT_URL`, `LIVEKIT_API_KEY`, `LIVEKIT_API_SECRET`
- `LIVEKIT_SIP_OUTBOUND_TRUNK_ID` (optional; when set, callback/transfer flows dial via LiveKit SIP participant into agent room)
- `GOOGLE_AI_API_KEY`
- `SQUARE_ENVIRONMENT` (`sandbox|production`, default `sandbox`)
- `SQUARE_API_VERSION` (default `2026-01-22`)
- `SQUARE_APPLICATION_ID` (required if Square OAuth token refresh is used)
- `SQUARE_APPLICATION_SECRET` (required if Square OAuth token refresh is used)
- `REDIS_URL` (optional; enables cross-instance cache for Google Calendar token/freebusy)
- `CALENDAR_TOKEN_CACHE_TTL_SECONDS` (default `3300`)
- `CALENDAR_FREEBUSY_CACHE_TTL_SECONDS` (default `45`)
- `CALENDAR_SINGLEFLIGHT_LOCK_MS` (default `2500`)
- `CALENDAR_PROVIDER_DEFAULT` (default `manual`; supports `manual|google_calendar|vagaro|square_appointments|mindbody|acuity|booksy`)

Latency preset notes:
- `balanced`: safer conversational stability for mixed caller audio quality.
- `ultra_low_latency`: more aggressive VAD for fastest turn-taking; can cut off hesitant speech sooner in noisy lines.

## Calendar Provider

- `GoogleCalendarProvider` is now wired to Google Calendar API:
  - `freeBusy` for availability checks
  - `events.insert` for booking creation
  - `events.patch` for reschedule
  - `events.delete` for cancellation
  - booking create idempotency via private extended property (`rb_idempotency_key`)
  - Redis-backed token + freebusy cache for multi-instance latency reduction (falls back to in-process cache when `REDIS_URL` is not set)
- `SquareAppointmentsProvider` is now wired to Square Bookings API:
  - `bookings/availability/search` for availability checks
  - `bookings` create/update/cancel for booking lifecycle
  - customer lookup/create via `customers/search` + `customers`
  - OAuth refresh token flow via `oauth2/token` (when app credentials are configured)
  - shop credential payload is read from `shop.google_cal_credentials_encrypted` (JSON or base64 JSON) with keys:
    - `provider: "square_appointments"`
    - `access_token`
    - `refresh_token`
    - `location_id`
    - `service_variation_id`
    - optional `team_member_id`

## User Calendar Connection APIs

- `GET /api/backend/user/calendar/providers`
  - returns connect/configure status for calendar providers per shop.
- `GET /api/backend/user/calendar/providers/square_appointments/connect/start`
  - starts Square OAuth for authenticated user and redirects to Square auth page.
- `GET /api/backend/user/calendar/providers/square_appointments/connect/callback`
  - exchanges auth code and stores Square tokens on the current shop.
- `GET /api/backend/user/calendar/providers/square_appointments/options`
  - fetches real Square locations and service variations.
- `POST /api/backend/user/calendar/providers/square_appointments/configure`
  - body: `{ locationId, serviceVariationId, teamMemberId? }`
  - persists booking target for live availability/create booking.
- `POST /api/backend/user/calendar/providers/square_appointments/disconnect`
  - removes Square credentials from shop connection.

## Quick Bootstrap

1. Copy env:
   - `cp .env.example .env`
2. Apply DB baseline migration:
   - `src/backend/db/migrations/0001_init_core.sql`
   - `src/backend/db/migrations/0002_call_logs_and_missed_calls.sql`
   - `src/backend/db/migrations/0003_rename_owner_to_user.sql` (only needed for environments created before user_* rename)
   - Optional verification: `src/backend/db/migrations/0003_postcheck_owner_to_user.sql`
   - `src/backend/db/migrations/0004_auth_users_and_reset_tokens.sql`
   - `src/backend/db/migrations/0005_rls_multi_tenant.sql`
3. Start app:
   - `npm run dev`
4. Start worker:
   - `npm run worker`

## Local Validation (Quick)

1. Runtime wiring:
   - `GET /api/backend/runtime`
2. Start inbound call session (memory demo shop):
   - `POST /api/backend/agent/start-inbound`
   - body:
     - `{"callerPhone":"+14155550199","destinationPhone":"+17145550123"}`
3. Run worker (to consume dispatch/messaging jobs):
   - `npm run worker`
   - `realtime_session_dispatch` posts to `AGENT_DISPATCH_WEBHOOK_URL` or falls back to `${APP_BASE_URL}/api/backend/agent/dispatch`
4. Run standalone realtime agent worker command (used by dispatcher):
   - `npm run agent:worker`
5. Run integration tests:
   - `npm test`

## Production Readiness + Smoke

1. Configure production profile in `.env`:
   - `BACKEND_REPOSITORY_MODE=supabase`
   - `BACKEND_COMM_PROVIDER=telnyx`
   - `AGENT_TRANSPORT=livekit`
   - `AGENT_VOICE_PROVIDER=gemini_live`
   - `AGENT_VOICE_MODEL=gemini-3.1-flash-live-preview`
2. Validate backend readiness:
   - `npm run check:readiness`
   - for OpenAI Realtime profile: `npm run check:readiness:openai`
3. Run inbound smoke E2E:
   - `npm run smoke:inbound`
   - for OpenAI Realtime profile: `npm run smoke:openai-realtime`
   - optional overrides:
     - `SMOKE_DESTINATION_PHONE`
     - `SMOKE_CALLER_PHONE`
4. Run staging E2E playbook:
   - `npm run e2e:staging:playbook`
   - flow covered:
     - readiness/runtime checks
     - inbound session start
     - tool calls: `check_availability` -> `create_booking` -> `schedule_callback`
     - worker tick loop for queued jobs
     - optional user login + bookings verify
     - optional Paddle webhook sync check
   - optional env:
     - `STAGING_E2E_USER_EMAIL`
     - `STAGING_E2E_USER_PASSWORD`
     - `STAGING_E2E_SERVICE_NAME` (default `Manicure`)
     - `STAGING_E2E_JOB_TICKS` (default `3`)
5. Review `api_request` logs for latency/status and confirm no 5xx in webhook/dispatch flows.

## Reconciliation Scripts (P2)

- Provider events replay/health check:
  - `npm run reconcile:provider-events`
  - exits with code `2` when unprocessed/failed provider events are found.
- Provider event replay (safe runbook):
  - dry-run failed Paddle events: `npm run replay:provider-events`
  - replay specific event id:
    - `REPLAY_PROVIDER_EVENT_ID=<provider_event_id> REPLAY_APPLY=true npm run replay:provider-events`
  - replay window apply mode:
    - `REPLAY_APPLY=true REPLAY_LOOKBACK_DAYS=14 REPLAY_MAX_ROWS=200 npm run replay:provider-events`
  - automated replay is intentionally limited to `paddle`; Telnyx replay should be manual-only to avoid duplicate callback/SMS side effects.
- Paddle subscription backfill (plan/active sync from provider events):
  - dry-run (default): `npm run reconcile:paddle-subscriptions`
  - apply updates: `RECON_APPLY=true npm run reconcile:paddle-subscriptions`
  - optional: `RECON_LOOKBACK_DAYS=30`

## Production Lifecycle Additions

- Telnyx webhook now writes operational call lifecycle data:
  - `call_logs` updates for call start/end and agent join markers
  - `missed_calls` dedupe bucket (once per hour per caller/shop) before enqueueing follow-up SMS
- Dispatch handler (`/api/backend/agent/dispatch`) marks `agent_joined` by `shopId + requestId` when metadata is available.
- Spawned worker can push lifecycle callbacks (`received`, `agent_joined`, `failed`) to `/api/backend/agent/dispatch/status`.
- Worker runtime now joins LiveKit room directly using dispatch join token and sends `completed` status on graceful finish.
- Worker runtime includes provider-driven voice bridge orchestration:
  - consumes room `ChatMessage` from caller participants
  - sends prompts to the configured live voice provider with `systemPrompt`
  - publishes agent replies to room topic `rb.agent.text`
  - logs per-tool-call execution latency from the active provider adapter

## Retry + DLQ Policy

- Telnyx outbound SMS/call now uses bounded retry with exponential backoff:
  - retries on `429` and `5xx`
  - preserves idempotency headers on retries
- Job failures emit:
  - `job_failed` for each handler failure
  - `job_dead_letter_alert` when retryable job reaches max attempts (default 5)
- API request telemetry:
  - `api_request` logs include method/path/status/durationMs

## Metrics Snapshot (P2 baseline)

- `api_requests_total`
- `api_request_duration_ms`
- `toolcall_total`
- `toolcall_duration_ms`
- `toolcall_queue_failed_total`
- `realtime_response_latency_ms`
- `realtime_audio_queue_latency_ms`
- `realtime_audio_jitter_ms`
- `webhook_requests_total`
- `webhook_signature_invalid_total`
- `jobs_completed_total`
- `jobs_failed_total`
- `jobs_dead_letter_total`
- `job_handler_duration_ms`
- `call_latency_ms`

Realtime metrics now carry provider labels so Gemini vs OpenAI can be compared directly on staging:
- `provider=gemini_live|openai_realtime` on tool-call metrics
- `voiceProvider=gemini_live|openai_realtime` on realtime latency metrics
- `transport=livekit` on realtime latency metrics

## Rate Limit Guardrails

- Backend API now enforces per-endpoint rate limits (IP + route + identity):
  - user/admin login (strict, with temporary block)
  - user/admin authenticated APIs
  - agent start/simulate/dispatch endpoints
  - jobs enqueue endpoint
  - Telnyx and Paddle webhooks
- Response includes:
  - `X-RateLimit-Limit`
  - `X-RateLimit-Remaining`
  - `Retry-After`
- Uses Redis-backed counters when `REDIS_URL` is set, and in-memory fallback when not set.

## Calendar Provider Architecture (Multi-Provider Ready)

- Calendar layer now has provider catalog + capabilities:
  - `manual` (active)
  - `google_calendar` (active)
  - `square_appointments` (active)
  - `vagaro`, `mindbody`, `acuity` (active integration providers)
  - `booksy` (planned)
- Provider resolution order per shop:
  1. provider hint from `shop.integration_credentials_encrypted` or legacy `shop.google_cal_credentials_encrypted` (`provider` / `provider_id`)
  2. `shop.google_cal_id` -> `google_calendar`
  3. fallback `CALENDAR_PROVIDER_DEFAULT`
- Safety:
  - If a planned provider is selected but not implemented, runtime throws `calendar_provider_not_implemented:<provider>`.
  - In production strict mode, active shops cannot silently fallback to manual provider.
