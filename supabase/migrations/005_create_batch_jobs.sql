-- Batch test jobs (async processing; polling from UI)

create table if not exists public.batch_jobs (
  id uuid primary key default gen_random_uuid(),
  status text not null default 'queued'
    check (status in ('queued', 'running', 'completed', 'failed')),
  pipeline text not null default 'full',
  total_count integer not null default 0,
  processed_count integer not null default 0,
  success_count integer not null default 0,
  failed_count integer not null default 0,
  started_at timestamptz,
  finished_at timestamptz,
  error_message text,
  created_at timestamptz not null default now()
);

create table if not exists public.batch_job_items (
  id uuid primary key default gen_random_uuid(),
  batch_job_id uuid not null references public.batch_jobs(id) on delete cascade,
  file_name text not null,
  status text not null default 'queued'
    check (status in ('queued', 'running', 'completed', 'failed')),
  call_id uuid references public.calls(id) on delete set null,
  stt_status text,
  analysis_status text,
  primary_intent text,
  room_no text,
  workflow_type text,
  error_stage text,
  error_message text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_batch_job_items_job_id on public.batch_job_items(batch_job_id);
create index if not exists idx_batch_job_items_status on public.batch_job_items(batch_job_id, status);

drop trigger if exists trg_batch_job_items_updated_at on public.batch_job_items;
create trigger trg_batch_job_items_updated_at
before update on public.batch_job_items
for each row execute function public.set_updated_at();

comment on table public.batch_jobs is 'Batch fixture test run; progress polled from UI';
comment on table public.batch_job_items is 'Per-file batch test result (no transcript stored)';
