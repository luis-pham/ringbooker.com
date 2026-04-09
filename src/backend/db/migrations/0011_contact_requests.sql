create table if not exists public.contact_requests (
  id uuid primary key default gen_random_uuid(),
  request_id text not null unique,
  full_name text not null,
  business_name text not null,
  email text not null,
  phone_number text not null,
  business_type text not null,
  current_setup text not null,
  help_need text not null,
  best_time text not null,
  status text not null default 'new',
  source text not null default 'marketing_contact_form',
  ip text,
  notes text,
  handled_by text,
  handled_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint contact_requests_status_check check (status in ('new', 'contacted', 'qualified', 'closed', 'spam'))
);

create index if not exists idx_contact_requests_created_at on public.contact_requests(created_at desc);
create index if not exists idx_contact_requests_status_created_at on public.contact_requests(status, created_at desc);
create index if not exists idx_contact_requests_email on public.contact_requests(email);
create index if not exists idx_contact_requests_business_type on public.contact_requests(business_type);

alter table public.contact_requests enable row level security;

drop policy if exists contact_requests_admin_all on public.contact_requests;
create policy contact_requests_admin_all on public.contact_requests
for all
using (public.rb_is_admin())
with check (public.rb_is_admin());
