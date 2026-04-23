-- Idempotent: DB에 review_jobs만 빠진 경우에도 적용 가능.
-- batch_jobs(005) 및 set_updated_at(001/003) 이후 실행을 권장.

create table if not exists public.review_jobs (
  id uuid primary key default gen_random_uuid(),
  title text not null default '검수 작업',
  source_batch_job_id uuid references public.batch_jobs(id) on delete set null,
  status text not null default 'draft'
    check (status in (
      'draft',
      'imported',
      'analyzing',
      'analyzed',
      'candidates_ready',
      'clustered',
      'labeling'
    )),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists trg_review_jobs_updated_at on public.review_jobs;
create trigger trg_review_jobs_updated_at
before update on public.review_jobs
for each row execute function public.set_updated_at();

comment on table public.review_jobs is '검수 라벨링 작업 단위';
