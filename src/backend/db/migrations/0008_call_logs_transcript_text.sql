alter table public.call_logs
add column if not exists transcript_text text;

create index if not exists idx_call_logs_request_id on public.call_logs(request_id);
