create table if not exists public.shop_staff_services (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null references public.shops(id) on delete cascade,
  staff_id uuid not null references public.shop_staff(id) on delete cascade,
  service_id uuid not null references public.shop_services(id) on delete cascade,
  created_at timestamptz not null default now(),
  constraint shop_staff_services_unique unique (staff_id, service_id)
);

create index if not exists shop_staff_services_shop_id_idx
  on public.shop_staff_services(shop_id);

create index if not exists shop_staff_services_staff_id_idx
  on public.shop_staff_services(staff_id);

create index if not exists shop_staff_services_service_id_idx
  on public.shop_staff_services(service_id);

alter table public.shop_staff_services enable row level security;

drop policy if exists shop_staff_services_admin_all on public.shop_staff_services;
drop policy if exists shop_staff_services_user_scoped on public.shop_staff_services;

create policy shop_staff_services_admin_all on public.shop_staff_services
for all
using (public.rb_is_admin())
with check (public.rb_is_admin());

create policy shop_staff_services_user_scoped on public.shop_staff_services
for all
using (public.rb_is_shop_member(shop_id))
with check (public.rb_is_shop_member(shop_id));
