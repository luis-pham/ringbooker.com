alter table auth_users
  add column if not exists email_verified_at timestamptz default null;

create table if not exists email_verification_tokens (
  id uuid primary key default gen_random_uuid(),
  auth_user_id uuid not null references auth_users(id) on delete cascade,
  token_hash text not null,
  expires_at timestamptz not null,
  used_at timestamptz default null,
  created_at timestamptz not null default now()
);

create index if not exists idx_email_verification_tokens_token_hash on email_verification_tokens(token_hash);
create index if not exists idx_email_verification_tokens_auth_user_id on email_verification_tokens(auth_user_id);
