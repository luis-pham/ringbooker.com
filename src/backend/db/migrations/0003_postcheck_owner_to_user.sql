-- Post-migration verification for 0003_rename_owner_to_user.sql
-- Run manually in Supabase SQL editor (read-only checks).

-- 1) Confirm shops columns after rename.
select
  column_name,
  data_type,
  is_nullable
from information_schema.columns
where table_schema = 'public'
  and table_name = 'shops'
  and column_name in ('owner_phone', 'owner_name', 'user_phone', 'user_name')
order by column_name;

-- Expected:
-- - user_phone exists and is_nullable = NO
-- - user_name exists
-- - owner_phone/owner_name do not exist

-- 2) Find RLS policies still referencing owner_*.
select
  schemaname,
  tablename,
  policyname,
  qual,
  with_check
from pg_policies
where schemaname = 'public'
  and (
    coalesce(qual, '') ilike '%owner_%'
    or coalesce(with_check, '') ilike '%owner_%'
  )
order by tablename, policyname;

-- 3) Find views still referencing owner_*.
select
  schemaname,
  viewname,
  definition
from pg_views
where schemaname = 'public'
  and definition ilike '%owner_%'
order by viewname;

-- 4) Find SQL functions still referencing owner_*.
select
  n.nspname as schema_name,
  p.proname as function_name,
  pg_get_functiondef(p.oid) as definition
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and pg_get_functiondef(p.oid) ilike '%owner_%'
order by function_name;

-- 5) Find triggers/functions tied to triggers with owner_* reference.
select
  t.tgname as trigger_name,
  c.relname as table_name,
  p.proname as function_name
from pg_trigger t
join pg_class c on c.oid = t.tgrelid
join pg_proc p on p.oid = t.tgfoid
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public'
  and (
    t.tgname ilike '%owner%'
    or p.proname ilike '%owner%'
  )
order by c.relname, t.tgname;

-- 6) Optional sanity read from shops (limit).
select
  id,
  name,
  user_phone,
  user_name
from public.shops
limit 20;
