-- 부트스트랩: 이전 마이그레이션(011~013)이 적용되지 않은 DB에서도
-- /api/review/* 및 batch_jobs.name 오류를 해소한다.
-- 앱 코드 기준 스키마는 lib/types/database.ts 및 011_review_labeling.sql 과 동일.

-- ---------------------------------------------------------------------------
-- batch_jobs.name (013과 동일)
-- ---------------------------------------------------------------------------
alter table public.batch_jobs
  add column if not exists name text;

comment on column public.batch_jobs.name is '표시용 배치 이름';

-- ---------------------------------------------------------------------------
-- calls.batch_job_id (013과 동일, calls·batch_jobs 존재 시)
-- ---------------------------------------------------------------------------
do $$
begin
  if exists (
    select 1 from information_schema.tables
    where table_schema = 'public' and table_name = 'calls'
  ) and exists (
    select 1 from information_schema.tables
    where table_schema = 'public' and table_name = 'batch_jobs'
  ) then
    alter table public.calls
      add column if not exists batch_job_id uuid references public.batch_jobs(id) on delete set null;
    create index if not exists idx_calls_batch_job_id on public.calls(batch_job_id);
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- review_jobs (011: title·status·source_batch_job_id — name 컬럼은 미사용, title 사용)
-- ---------------------------------------------------------------------------
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

-- ---------------------------------------------------------------------------
-- review_job_calls
-- ---------------------------------------------------------------------------
create table if not exists public.review_job_calls (
  review_job_id uuid not null references public.review_jobs(id) on delete cascade,
  call_id uuid not null references public.calls(id) on delete cascade,
  primary key (review_job_id, call_id)
);

create index if not exists idx_review_job_calls_call on public.review_job_calls(call_id);

comment on table public.review_job_calls is '작업에 포함된 통화 (배치·수동 import)';

-- ---------------------------------------------------------------------------
-- review_candidates (코드: is_representative, reason_json)
-- ---------------------------------------------------------------------------
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
  is_representative boolean not null default false,
  reason_json jsonb,
  created_at timestamptz not null default now(),
  unique (review_job_id, call_id)
);

-- 011에서 생성된 구형 컬럼명 정리
do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name = 'review_candidates'
      and column_name = 'is_cluster_representative'
  ) and not exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name = 'review_candidates'
      and column_name = 'is_representative'
  ) then
    alter table public.review_candidates
      rename column is_cluster_representative to is_representative;
  end if;
end $$;

alter table public.review_candidates
  add column if not exists reason_json jsonb;

create index if not exists idx_review_candidates_job on public.review_candidates(review_job_id);
create index if not exists idx_review_candidates_job_status on public.review_candidates(review_job_id, review_status);
create index if not exists idx_review_candidates_call on public.review_candidates(call_id);

comment on table public.review_candidates is '검수 후보 (우선순위 점수·클러스터)';
comment on column public.review_candidates.reason_json is 'review_priority_score 가중치 항목별 점수';
comment on column public.review_candidates.is_representative is '클러스터 내 대표 샘플(1~n건)';

-- ---------------------------------------------------------------------------
-- review_clusters
-- ---------------------------------------------------------------------------
create table if not exists public.review_clusters (
  id uuid primary key default gen_random_uuid(),
  review_job_id uuid not null references public.review_jobs(id) on delete cascade,
  cluster_key text not null,
  representative_candidate_id uuid references public.review_candidates(id) on delete set null,
  sample_count integer not null default 0,
  unique (review_job_id, cluster_key)
);

create index if not exists idx_review_clusters_job on public.review_clusters(review_job_id);

comment on table public.review_clusters is '클러스터 메타 (대표 후보)';

-- ---------------------------------------------------------------------------
-- review_labels (후보당 1건 — candidate_id, 앱 코드와 동일)
-- ---------------------------------------------------------------------------
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

drop trigger if exists trg_review_labels_updated_at on public.review_labels;
create trigger trg_review_labels_updated_at
before update on public.review_labels
for each row execute function public.set_updated_at();

comment on table public.review_labels is '사람 라벨 (후보당 최신 1건 upsert)';
