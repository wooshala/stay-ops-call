create table if not exists public.review_logs (
  id uuid primary key default gen_random_uuid(),
  call_id uuid not null references public.calls(id) on delete cascade,
  action text not null,
  before_json jsonb,
  after_json jsonb,
  created_by text,
  created_at timestamptz default now()
);

create index if not exists idx_review_logs_call_id
on public.review_logs(call_id);
