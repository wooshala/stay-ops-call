-- ============================================================
-- 029_schema_repair.sql
-- 실제 DB와 코드 스키마 diff 복구 (idempotent)
-- 2026-04-16 기준 누락된 컬럼/테이블 일괄 추가
-- ============================================================

-- ────────────────────────────────────────────────────────────
-- 1. calls 누락 컬럼
-- ────────────────────────────────────────────────────────────
alter table public.calls
  add column if not exists analysis_version    text,
  add column if not exists quote_draft         text,
  add column if not exists auto_score          numeric,
  add column if not exists auto_decision       text,
  add column if not exists cluster_id          text,
  add column if not exists file_size_kb        integer;

comment on column public.calls.analysis_version is '분석 스키마/프롬프트 버전';
comment on column public.calls.quote_draft      is '자동 생성 견적서 초안 텍스트';
comment on column public.calls.auto_score       is '자동 검수 점수 (0~1)';
comment on column public.calls.auto_decision    is '자동 검수 의사결정 (pass|reject|review)';
comment on column public.calls.cluster_id       is '클러스터 키 (intent_date)';
comment on column public.calls.file_size_kb     is '원본 파일 크기(KB)';

-- ────────────────────────────────────────────────────────────
-- 2. call_entities 누락 컬럼 (007, 008 미적용분)
-- ────────────────────────────────────────────────────────────
alter table public.call_entities
  add column if not exists payment_method  text,
  add column if not exists payment_deposit boolean,
  add column if not exists group_booking   boolean,
  add column if not exists room_count      integer,
  add column if not exists deposit_amount  numeric,
  add column if not exists parking_count   integer;

comment on column public.call_entities.payment_method  is '카드, 계좌이체, 현금 등';
comment on column public.call_entities.payment_deposit is '계약금·예약금 성격 여부';
comment on column public.call_entities.group_booking   is '단체·다인 예약 여부';
comment on column public.call_entities.room_count      is '견적·단체: 객실 수';
comment on column public.call_entities.deposit_amount  is '예약금·계약금(원)';
comment on column public.call_entities.parking_count   is '주차 대수';

-- ────────────────────────────────────────────────────────────
-- 3. batch_job_items 누락 컬럼
-- ────────────────────────────────────────────────────────────
alter table public.batch_job_items
  add column if not exists analysis_persist_level text,
  add column if not exists source_file_name       text,
  add column if not exists error_code             text,
  add column if not exists analysis_raw_response  text;

comment on column public.batch_job_items.analysis_persist_level is '처리 시점 calls.analysis_persist_level 스냅샷';
comment on column public.batch_job_items.source_file_name       is '원본 업로드 파일명';
comment on column public.batch_job_items.error_code             is '실패 시 기계 판별 에러 코드';

-- ────────────────────────────────────────────────────────────
-- 4. review_jobs + 관련 테이블 (014 미적용분)
-- ────────────────────────────────────────────────────────────
create table if not exists public.review_jobs (
  id                   uuid primary key default gen_random_uuid(),
  title                text not null default '검수 작업',
  source_batch_job_id  uuid references public.batch_jobs(id) on delete set null,
  status               text not null default 'draft'
    check (status in ('draft','imported','analyzing','analyzed','candidates_ready','clustered','labeling')),
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);

drop trigger if exists trg_review_jobs_updated_at on public.review_jobs;
create trigger trg_review_jobs_updated_at
  before update on public.review_jobs
  for each row execute function public.set_updated_at();

comment on table public.review_jobs is '검수 라벨링 작업 단위';

create table if not exists public.review_job_calls (
  review_job_id uuid not null references public.review_jobs(id) on delete cascade,
  call_id       uuid not null references public.calls(id) on delete cascade,
  primary key (review_job_id, call_id)
);
create index if not exists idx_review_job_calls_call on public.review_job_calls(call_id);
comment on table public.review_job_calls is '작업에 포함된 통화';

create table if not exists public.review_candidates (
  id                     uuid primary key default gen_random_uuid(),
  review_job_id          uuid not null references public.review_jobs(id) on delete cascade,
  call_id                uuid not null references public.calls(id) on delete cascade,
  review_priority_score  integer not null default 0,
  cluster_key            text,
  predicted_call_type    text,
  intent_score           numeric,
  is_fallback            boolean not null default false,
  review_status          text not null default 'pending'
    check (review_status in ('pending','skipped','labeled')),
  is_representative      boolean not null default false,
  reason_json            jsonb,
  created_at             timestamptz not null default now(),
  unique (review_job_id, call_id)
);
create index if not exists idx_review_candidates_job        on public.review_candidates(review_job_id);
create index if not exists idx_review_candidates_job_status on public.review_candidates(review_job_id, review_status);
create index if not exists idx_review_candidates_call       on public.review_candidates(call_id);
comment on table public.review_candidates is '검수 후보 (우선순위·클러스터)';

create table if not exists public.review_clusters (
  id                           uuid primary key default gen_random_uuid(),
  review_job_id                uuid not null references public.review_jobs(id) on delete cascade,
  cluster_key                  text not null,
  representative_candidate_id  uuid references public.review_candidates(id) on delete set null,
  sample_count                 integer not null default 0,
  unique (review_job_id, cluster_key)
);
create index if not exists idx_review_clusters_job on public.review_clusters(review_job_id);
comment on table public.review_clusters is '클러스터 메타';

create table if not exists public.review_labels (
  id                    uuid primary key default gen_random_uuid(),
  candidate_id          uuid not null references public.review_candidates(id) on delete cascade,
  final_call_type       text,
  final_summary         text,
  final_price_mentioned boolean,
  final_date_mentioned  boolean,
  reviewer_note         text,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),
  unique (candidate_id)
);
drop trigger if exists trg_review_labels_updated_at on public.review_labels;
create trigger trg_review_labels_updated_at
  before update on public.review_labels
  for each row execute function public.set_updated_at();
comment on table public.review_labels is '사람 라벨 (후보당 최신 1건)';

-- ────────────────────────────────────────────────────────────
-- 5. quotes + 관련 테이블 (025-027 미적용분)
-- ────────────────────────────────────────────────────────────
do $$ begin
  if not exists (select 1 from pg_type where typname = 'quote_source_enum') then
    create type public.quote_source_enum as enum ('auto', 'manual', 'imported');
  end if;
  if not exists (select 1 from pg_type where typname = 'quote_status_enum') then
    create type public.quote_status_enum as enum ('draft', 'ready', 'sent', 'accepted', 'rejected', 'expired');
  end if;
  if not exists (select 1 from pg_type where typname = 'quote_channel_enum') then
    create type public.quote_channel_enum as enum ('sms', 'kakao', 'email', 'manual');
  end if;
  if not exists (select 1 from pg_type where typname = 'quote_message_send_status_enum') then
    create type public.quote_message_send_status_enum as enum ('pending', 'sent', 'failed');
  end if;
end $$;

create table if not exists public.quotes (
  id                   uuid primary key default gen_random_uuid(),
  call_id              uuid null references public.calls(id) on delete set null,
  customer_phone_number text null,
  customer_phone       text null,
  customer_name        text null,
  requested_date       date null,
  requested_weekday    text null,
  stay_type            text not null,
  room_type            text null,
  quoted_price         numeric null,
  price_currency       text not null default 'KRW',
  message_body         text not null default '',
  quote_text           text null,
  title                text null,
  summary              text null,
  internal_memo        text null,
  source               public.quote_source_enum not null default 'auto',
  status               public.quote_status_enum not null default 'draft',
  quote_status         text not null default 'confirmed',
  source_kind          text not null default 'auto',
  source_system        text null,
  source_reference_id  text null,
  total_amount         integer null,
  final_amount         integer null,
  parse_confidence     double precision null,
  quote_confidence     double precision null,
  needs_review         boolean not null default false,
  review_reason        text null,
  failure_reason       text null,
  finalized_by         text null,
  finalized_at         timestamptz null,
  sent_at              timestamptz null,
  accepted_at          timestamptz null,
  rejected_at          timestamptz null,
  expired_at           timestamptz null,
  external_sync_status text null,
  external_sync_target text null,
  external_sync_at     timestamptz null,
  external_ref_id      text null,
  created_by           text null,
  updated_by           text null,
  metadata_json        jsonb null,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);

create index if not exists idx_quotes_call_id     on public.quotes(call_id);
create index if not exists idx_quotes_status      on public.quotes(status);
create index if not exists idx_quotes_source      on public.quotes(source);
create index if not exists idx_quotes_needs_review on public.quotes(needs_review);
create index if not exists idx_quotes_customer_phone on public.quotes(customer_phone);
create index if not exists idx_quotes_updated_at  on public.quotes(updated_at desc);
comment on table public.quotes is '최종 견적 저장소';

create table if not exists public.quote_messages (
  id                  uuid primary key default gen_random_uuid(),
  quote_id            uuid not null references public.quotes(id) on delete cascade,
  channel             public.quote_channel_enum not null,
  recipient           text not null,
  message_text        text not null,
  send_status         public.quote_message_send_status_enum not null default 'pending',
  provider            text,
  provider_message_id text,
  error_message       text,
  sent_at             timestamptz,
  created_at          timestamptz not null default now()
);
create index if not exists idx_quote_messages_quote_id    on public.quote_messages(quote_id);
create index if not exists idx_quote_messages_send_status on public.quote_messages(send_status);

create table if not exists public.quote_versions (
  id          uuid primary key default gen_random_uuid(),
  quote_id    uuid not null references public.quotes(id) on delete cascade,
  version_no  integer not null,
  draft_text  text not null,
  payload     jsonb,
  created_by  text,
  created_at  timestamptz not null default now(),
  unique (quote_id, version_no)
);
create index if not exists idx_quote_versions_quote_id on public.quote_versions(quote_id);
