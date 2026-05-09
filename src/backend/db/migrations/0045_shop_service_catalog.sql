create table if not exists shop_service_categories (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null references shops(id) on delete cascade,
  name text not null,
  description text,
  sort_order integer not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists shop_services (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null references shops(id) on delete cascade,
  category_id uuid references shop_service_categories(id) on delete set null,
  name text not null,
  description text,
  duration_minutes integer,
  price_amount numeric,
  price_currency text not null default 'USD',
  price_type text not null default 'fixed',
  bookable boolean not null default true,
  active boolean not null default true,
  sort_order integer not null default 0,
  aliases jsonb not null default '[]',
  booking_notes text,
  external_provider text,
  external_service_id text,
  external_location_id text,
  external_staff_required boolean not null default false,
  external_metadata jsonb not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint shop_services_price_type_check check (price_type in ('fixed', 'from', 'varies', 'consultation'))
);

create index if not exists idx_shop_service_categories_shop_sort
  on shop_service_categories(shop_id, active, sort_order);

create index if not exists idx_shop_services_shop_category_sort
  on shop_services(shop_id, category_id, active, sort_order);

with shops_with_legacy_services as (
  select shops.id as shop_id
  from shops
  where jsonb_typeof(shops.services) = 'array'
    and jsonb_array_length(shops.services) > 0
    and not exists (
      select 1
      from shop_service_categories existing
      where existing.shop_id = shops.id
    )
)
insert into shop_service_categories (shop_id, name, description, sort_order, active)
select shop_id, 'General Services', null, 0, true
from shops_with_legacy_services;

with legacy_services as (
  select
    shops.id as shop_id,
    categories.id as category_id,
    item.value as service,
    item.ordinality::integer - 1 as sort_order
  from shops
  join shop_service_categories categories
    on categories.shop_id = shops.id
   and categories.name = 'General Services'
  cross join lateral jsonb_array_elements(shops.services) with ordinality as item(value, ordinality)
  where jsonb_typeof(shops.services) = 'array'
    and jsonb_array_length(shops.services) > 0
    and not exists (
      select 1
      from shop_services existing
      where existing.shop_id = shops.id
    )
),
normalized_legacy_services as (
  select
    shop_id,
    category_id,
    nullif(trim(service->>'name'), '') as name,
    case
      when (service->>'duration_min') ~ '^[0-9]+$' then (service->>'duration_min')::integer
      else 60
    end as duration_minutes,
    case
      when (service->>'price') ~ '^[0-9]+(\.[0-9]+)?$' then (service->>'price')::numeric
      else 0
    end as price_amount,
    sort_order
  from legacy_services
)
insert into shop_services (
  shop_id,
  category_id,
  name,
  duration_minutes,
  price_amount,
  price_currency,
  price_type,
  bookable,
  active,
  sort_order,
  aliases,
  external_metadata
)
select
  shop_id,
  category_id,
  name,
  duration_minutes,
  price_amount,
  'USD',
  case when price_amount > 0 then 'fixed' else 'varies' end,
  true,
  true,
  sort_order,
  '[]'::jsonb,
  '{}'::jsonb
from normalized_legacy_services
where name is not null;
