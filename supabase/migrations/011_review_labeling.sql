-- 검수 라벨링 워크벤치 (few-shot 재사용용)

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

create table if not exists public.review_job_calls (
  review_job_id uuid not null references public.review_jobs(id) on delete cascade,
  call_id uuid not null references public.calls(id) on delete cascade,
  primary key (review_job_id, call_id)
);

create index if not exists idx_review_job_calls_call on public.review_job_calls(call_id);

create table if not exists public.review_candidates (
  id uuid primary key default gen_random_uuid(),
  review_job_id uuid not null references public.review_jobs(id) on delete cascade,
  call_id uuid not null references public.calls(id) on delete cascade,
  review_priority_score integer not null default 0,
  cluster_key text,
  predicted_call_type text,
  intent_score numeric,
  is_fallback boolean not null default false,
  review_status text not null default 'pending'
    check (review_status in ('pending', 'skipped', 'labeled')),
  is_cluster_representative boolean not null default false,
  created_at timestamptz not null default now(),
  unique (review_job_id, call_id)
);

create index if not exists idx_review_candidates_job on public.review_candidates(review_job_id);
create index if not exists idx_review_candidates_job_status on public.review_candidates(review_job_id, review_status);

create table if not exists public.review_clusters (
  id uuid primary key default gen_random_uuid(),
  review_job_id uuid not null references public.review_jobs(id) on delete cascade,
  cluster_key text not null,
  representative_candidate_id uuid references public.review_candidates(id) on delete set null,
  sample_count integer not null default 0,
  unique (review_job_id, cluster_key)
);

create index if not exists idx_review_clusters_job on public.review_clusters(review_job_id);

create table if not exists public.review_labels (
  id uuid primary key default gen_random_uuid(),
  candidate_id uuid not null references public.review_candidates(id) on delete cascade,
  final_call_type text,
  final_summary text,
  final_price_mentioned boolean,
  final_date_mentioned boolean,
  reviewer_note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (candidate_id)
);

drop trigger if exists trg_review_jobs_updated_at on public.review_jobs;
create trigger trg_review_jobs_updated_at
before update on public.review_jobs
for each row execute function public.set_updated_at();

drop trigger if exists trg_review_labels_updated_at on public.review_labels;
create trigger trg_review_labels_updated_at
before update on public.review_labels
for each row execute function public.set_updated_at();

comment on table public.review_jobs is '검수 라벨링 작업 단위';
comment on table public.review_job_calls is '작업에 포함된 통화 (배치·수동 import)';
comment on table public.review_candidates is '검수 후보 (우선순위 점수·클러스터)';
comment on table public.review_clusters is '클러스터 메타 (대표 후보)';
comment on table public.review_labels is '사람 라벨 (후보당 최신 1건 upsert)';
