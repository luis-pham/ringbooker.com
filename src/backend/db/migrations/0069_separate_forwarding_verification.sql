alter table shop_access_states
  rename column forwarding_setup_verified_at to forwarding_claimed_at;

alter table shop_access_states
  add column if not exists forwarding_verified_at timestamptz null,
  add column if not exists forwarding_verified_source text null;

update shop_access_states
set
  forwarding_verified_at = forwarding_claimed_at,
  forwarding_verified_source = case
    when forwarding_setup_verified_via in ('inbound_test_call', 'forwarding_test') then 'inbound_test'
    when forwarding_setup_verified_via in ('manual_confirmation', 'user_confirmed', 'legacy_live') then 'admin_override'
    else null
  end
where forwarding_claimed_at is not null
  and forwarding_verified_at is null;

alter table shop_access_states
  drop constraint if exists shop_access_states_forwarding_verified_source_check,
  add constraint shop_access_states_forwarding_verified_source_check
    check (forwarding_verified_source is null or forwarding_verified_source in ('inbound_test', 'admin_override'));

alter table shop_access_states
  drop column if exists forwarding_setup_verified_via;
