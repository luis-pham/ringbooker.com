-- Deterministic attribution: link a shop back to the originating sales lead so
-- signup / trial / convert / churn can be reported to sales.ringbooker.com.
-- Stamped once at signup from the demo token (cookie/param), with identity match
-- (phone -> domain -> email) only as a lower-confidence fallback.

alter table public.shops
  add column if not exists sales_lead_id uuid,
  add column if not exists sales_attribution_method text,
  add column if not exists sales_attributed_at timestamptz;

create index if not exists idx_shops_sales_lead_id on public.shops(sales_lead_id)
  where sales_lead_id is not null;

comment on column public.shops.sales_lead_id is
  'sales.ringbooker.com lead id this shop was attributed to (from demo token or identity match).';
comment on column public.shops.sales_attribution_method is
  'How the shop was attributed: demo_token | matched_phone | matched_domain | matched_email.';
comment on column public.shops.sales_attributed_at is
  'When sales_lead_id was first stamped on this shop.';
