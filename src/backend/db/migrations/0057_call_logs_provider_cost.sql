-- Persist Telnyx `call.cost` webhook events onto the call_logs row so per-call and
-- per-shop telephony spend is queryable in the database instead of living only in
-- application logs. Populated by processCallCost in telnyx-call-control-webhook.ts.

alter table public.call_logs
  add column if not exists provider_cost_amount numeric(12, 6),
  add column if not exists provider_cost_currency text,
  add column if not exists provider_cost_recorded_at timestamptz;
