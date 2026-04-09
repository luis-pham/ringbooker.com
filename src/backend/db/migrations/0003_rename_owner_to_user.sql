-- Rename legacy owner_* columns to user_* for compatibility with updated app naming.
-- Safe to run multiple times.

do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'shops'
      and column_name = 'owner_phone'
  ) and not exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'shops'
      and column_name = 'user_phone'
  ) then
    alter table public.shops rename column owner_phone to user_phone;
  end if;
end $$;

do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'shops'
      and column_name = 'owner_name'
  ) and not exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'shops'
      and column_name = 'user_name'
  ) then
    alter table public.shops rename column owner_name to user_name;
  end if;
end $$;

-- Keep NOT NULL expectation aligned with current app contracts.
do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'shops'
      and column_name = 'user_phone'
  ) then
    alter table public.shops alter column user_phone set not null;
  end if;
end $$;

-- Optional follow-up for teams using custom SQL policies/views:
-- 1) Update any RLS policy definitions referencing owner_phone/owner_name.
-- 2) Update any SQL views/functions/triggers referencing owner_phone/owner_name.
