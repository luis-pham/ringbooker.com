alter table public.shop_staff
  add column if not exists all_services boolean not null default true;

comment on column public.shop_staff.all_services is
  'When true, staff can perform all shop services. When false, staff can only perform services in shop_staff_services. Set to false when owner manually assigns specific services.';
