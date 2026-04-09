-- Auth users and password reset tokens (Sprint 1 P0)

create table if not exists auth_users (
  id uuid primary key default gen_random_uuid(),
  email text not null unique,
  role text not null,
  shop_id uuid references shops(id) on delete set null,
  password_hash text not null,
  active boolean not null default true,
  mfa_enabled boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint auth_users_role_check check (role in ('user', 'admin'))
);

create index if not exists idx_auth_users_role on auth_users(role);
create index if not exists idx_auth_users_shop_id on auth_users(shop_id);

create table if not exists auth_password_reset_tokens (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth_users(id) on delete cascade,
  token_hash text not null unique,
  expires_at timestamptz not null,
  consumed_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists idx_auth_reset_user_id on auth_password_reset_tokens(user_id);
create index if not exists idx_auth_reset_expires_at on auth_password_reset_tokens(expires_at);
