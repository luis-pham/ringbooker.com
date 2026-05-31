create table if not exists public.shop_staff (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null references public.shops(id) on delete cascade,
  name text not null,
  role text,
  specialties text[] not null default '{}',
  notes text,
  active boolean not null default true,
  external_provider text check (external_provider in ('square', 'vagaro', 'mindbody', 'acuity')),
  external_staff_id text,
  external_metadata jsonb not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint shop_staff_external_unique unique (shop_id, external_provider, external_staff_id)
);

create index if not exists shop_staff_shop_id_idx
  on public.shop_staff(shop_id);

create index if not exists shop_staff_external_idx
  on public.shop_staff(shop_id, external_provider, external_staff_id)
  where external_provider is not null
    and external_staff_id is not null;

alter table public.shop_staff enable row level security;

drop policy if exists shop_staff_admin_all on public.shop_staff;
drop policy if exists shop_staff_user_scoped on public.shop_staff;

create policy shop_staff_admin_all on public.shop_staff
for all
using (public.rb_is_admin())
with check (public.rb_is_admin());

create policy shop_staff_user_scoped on public.shop_staff
for all
using (public.rb_is_shop_member(shop_id))
with check (public.rb_is_shop_member(shop_id));
