-- Defense in depth: the backend reaches sales_prepared_demos only via the service
-- role (which bypasses RLS), and the table holds the demo system prompt + config.
-- Enable RLS with no policies so anon/authenticated keys cannot read or write it,
-- even if one is ever exposed to the client.

-- (No FORCE: the service_role bypasses RLS via its BYPASSRLS attribute, matching
--  how the rest of the backend tables are accessed.)
alter table public.sales_prepared_demos enable row level security;
