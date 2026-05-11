alter table shop_services
  add column if not exists duration_text text;

create or replace function replace_shop_service_catalog(
  p_shop_id uuid,
  p_categories jsonb,
  p_services jsonb,
  p_legacy_services jsonb
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (select 1 from shops where id = p_shop_id) then
    raise exception 'shop_not_found' using errcode = 'P0002';
  end if;

  delete from shop_services where shop_id = p_shop_id;
  delete from shop_service_categories where shop_id = p_shop_id;

  insert into shop_service_categories (
    id,
    shop_id,
    name,
    description,
    sort_order,
    active,
    updated_at
  )
  select
    coalesce(category.id, gen_random_uuid()),
    p_shop_id,
    trim(category.name),
    nullif(category.description, ''),
    coalesce(category.sort_order, 0),
    coalesce(category.active, true),
    now()
  from jsonb_to_recordset(coalesce(p_categories, '[]'::jsonb)) as category(
    id uuid,
    name text,
    description text,
    sort_order integer,
    active boolean
  )
  where nullif(trim(category.name), '') is not null;

  insert into shop_services (
    id,
    shop_id,
    category_id,
    name,
    description,
    duration_text,
    duration_minutes,
    price_amount,
    price_currency,
    price_type,
    bookable,
    active,
    sort_order,
    aliases,
    booking_notes,
    external_provider,
    external_service_id,
    external_location_id,
    external_staff_required,
    external_metadata,
    updated_at
  )
  select
    coalesce(service.id, gen_random_uuid()),
    p_shop_id,
    case
      when exists (
        select 1
        from shop_service_categories category
        where category.id = service.category_id
          and category.shop_id = p_shop_id
      ) then service.category_id
      else null
    end,
    trim(service.name),
    nullif(service.description, ''),
    nullif(service.duration_text, ''),
    service.duration_minutes,
    service.price_amount,
    coalesce(nullif(service.price_currency, ''), 'USD'),
    coalesce(service.price_type, 'fixed'),
    coalesce(service.bookable, true),
    coalesce(service.active, true),
    coalesce(service.sort_order, 0),
    coalesce(service.aliases, '[]'::jsonb),
    nullif(service.booking_notes, ''),
    service.external_provider,
    service.external_service_id,
    service.external_location_id,
    coalesce(service.external_staff_required, false),
    coalesce(service.external_metadata, '{}'::jsonb),
    now()
  from jsonb_to_recordset(coalesce(p_services, '[]'::jsonb)) as service(
    id uuid,
    category_id uuid,
    name text,
    description text,
    duration_text text,
    duration_minutes integer,
    price_amount numeric,
    price_currency text,
    price_type text,
    bookable boolean,
    active boolean,
    sort_order integer,
    aliases jsonb,
    booking_notes text,
    external_provider text,
    external_service_id text,
    external_location_id text,
    external_staff_required boolean,
    external_metadata jsonb
  )
  where nullif(trim(service.name), '') is not null;

  update shops
  set services = coalesce(p_legacy_services, '[]'::jsonb),
      updated_at = now()
  where id = p_shop_id;
end;
$$;
