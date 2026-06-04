-- Prepared, shareable per-salon demos created by sales.ringbooker.com via the
-- internal demo-context API. One row per sales lead (idempotent upsert). The
-- public page /try/<slug> is served from this row, and demo tracking webhooks
-- are sent back to sales keyed by the slug.
--
-- NOTE: sales.ringbooker.com stores demo_slug = URL pathname without the leading
-- slash, i.e. "try/<slug>". Outbound tracking webhooks MUST send that exact
-- string (prefix the stored `slug` with "try/") so the lookup on the sales side
-- matches.

create table if not exists sales_prepared_demos (
  id              uuid        primary key default gen_random_uuid(),
  -- Lead id lives in the sales Supabase project (separate DB) — plain uuid, no FK.
  sales_lead_id   uuid        not null unique,
  slug            text        not null unique,
  vertical        text        not null default 'hair-salon',
  business_name   text        not null,
  city            text,
  state           text,
  website_url     text,
  instagram_url   text,
  -- Built from website import (primary) merged with the sales payload (fallback):
  -- { services: [...], primaryHours, secondaryHours, staffNames: [...] }
  demo_config     jsonb       not null default '{}',
  system_prompt   text,
  expires_at      timestamptz not null default (now() + interval '30 days'),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create unique index if not exists idx_sales_prepared_demos_slug    on sales_prepared_demos(slug);
create index        if not exists idx_sales_prepared_demos_lead    on sales_prepared_demos(sales_lead_id);
create index        if not exists idx_sales_prepared_demos_expires on sales_prepared_demos(expires_at);
