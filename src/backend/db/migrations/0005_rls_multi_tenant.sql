-- Sprint 1: tenant isolation baseline with Postgres RLS.
-- NOTE:
-- - These policies are intended for non-service-role access.
-- - Service-role keys bypass RLS in Supabase, so API-layer scoping must still stay in place.

create or replace function public.rb_session_role()
returns text
language sql
stable
as $$
  select coalesce(current_setting('request.jwt.claim.role', true), '');
$$;

create or replace function public.rb_session_shop_id()
returns uuid
language sql
stable
as $$
  select nullif(current_setting('request.jwt.claim.shop_id', true), '')::uuid;
$$;

create or replace function public.rb_is_admin()
returns boolean
language sql
stable
as $$
  select public.rb_session_role() = 'admin';
$$;

create or replace function public.rb_is_shop_member(target_shop_id uuid)
returns boolean
language sql
stable
as $$
  select public.rb_session_shop_id() = target_shop_id;
$$;

alter table public.shops enable row level security;
alter table public.bookings enable row level security;
alter table public.callbacks enable row level security;
alter table public.call_logs enable row level security;
alter table public.missed_calls enable row level security;
alter table public.outbound_messages enable row level security;
alter table public.customers enable row level security;

drop policy if exists shops_admin_all on public.shops;
drop policy if exists shops_user_scoped on public.shops;
create policy shops_admin_all on public.shops
for all
using (public.rb_is_admin())
with check (public.rb_is_admin());
create policy shops_user_scoped on public.shops
for select
using (public.rb_is_shop_member(id));

drop policy if exists bookings_admin_all on public.bookings;
drop policy if exists bookings_user_scoped on public.bookings;
create policy bookings_admin_all on public.bookings
for all
using (public.rb_is_admin())
with check (public.rb_is_admin());
create policy bookings_user_scoped on public.bookings
for all
using (public.rb_is_shop_member(shop_id))
with check (public.rb_is_shop_member(shop_id));

drop policy if exists callbacks_admin_all on public.callbacks;
drop policy if exists callbacks_user_scoped on public.callbacks;
create policy callbacks_admin_all on public.callbacks
for all
using (public.rb_is_admin())
with check (public.rb_is_admin());
create policy callbacks_user_scoped on public.callbacks
for all
using (public.rb_is_shop_member(shop_id))
with check (public.rb_is_shop_member(shop_id));

drop policy if exists call_logs_admin_all on public.call_logs;
drop policy if exists call_logs_user_scoped on public.call_logs;
create policy call_logs_admin_all on public.call_logs
for all
using (public.rb_is_admin())
with check (public.rb_is_admin());
create policy call_logs_user_scoped on public.call_logs
for all
using (public.rb_is_shop_member(shop_id))
with check (public.rb_is_shop_member(shop_id));

drop policy if exists missed_calls_admin_all on public.missed_calls;
drop policy if exists missed_calls_user_scoped on public.missed_calls;
create policy missed_calls_admin_all on public.missed_calls
for all
using (public.rb_is_admin())
with check (public.rb_is_admin());
create policy missed_calls_user_scoped on public.missed_calls
for all
using (public.rb_is_shop_member(shop_id))
with check (public.rb_is_shop_member(shop_id));

drop policy if exists outbound_messages_admin_all on public.outbound_messages;
drop policy if exists outbound_messages_user_scoped on public.outbound_messages;
create policy outbound_messages_admin_all on public.outbound_messages
for all
using (public.rb_is_admin())
with check (public.rb_is_admin());
create policy outbound_messages_user_scoped on public.outbound_messages
for all
using (public.rb_is_shop_member(shop_id))
with check (public.rb_is_shop_member(shop_id));

drop policy if exists customers_admin_all on public.customers;
drop policy if exists customers_user_scoped on public.customers;
create policy customers_admin_all on public.customers
for all
using (public.rb_is_admin())
with check (public.rb_is_admin());
create policy customers_user_scoped on public.customers
for all
using (public.rb_is_shop_member(shop_id))
with check (public.rb_is_shop_member(shop_id));
