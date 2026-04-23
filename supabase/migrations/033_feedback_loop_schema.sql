-- Feedback loop v1
-- 1) review_candidates: snapshot + versioning + nullable review_job_id
-- 2) review_labels: 운영 필드 추가
-- 3) correction_events VIEW

-- ── review_candidates 확장 ──────────────────────────────────────────────────

-- review_job_id nullable (신규 call-based flow는 job 없이 생성)
alter table public.review_candidates
  alter column review_job_id drop not null;

-- snapshot (생성 시 고정, 이후 절대 수정 금지)
alter table public.review_candidates
  add column if not exists original_intent       text,
  add column if not exists original_summary      text,
  add column if not exists original_confidence   numeric;

-- versioning
alter table public.review_candidates
  add column if not exists model_version         text,
  add column if not exists prompt_version        text,
  add column if not exists heuristic_version     text;

-- candidate 생성 경로 추적
alter table public.review_candidates
  add column if not exists source                text
    check (source in ('batch', 'upload', 'reanalyze'));

-- unique 제약 완화: review_job_id nullable이 되면 기존 unique(review_job_id, call_id) 동작이 달라짐
-- call_id 단독으로 open(pending) candidate는 1개만 허용 → 애플리케이션에서 체크

comment on column public.review_candidates.original_intent     is 'snapshot: candidate 생성 시 calls.primary_intent 값 (불변)';
comment on column public.review_candidates.original_summary    is 'snapshot: candidate 생성 시 calls.summary 값 (불변)';
comment on column public.review_candidates.original_confidence is 'snapshot: candidate 생성 시 calls.analysis_confidence 값 (불변)';
comment on column public.review_candidates.model_version       is '분석에 사용된 LLM 모델 버전';
comment on column public.review_candidates.prompt_version      is '분석에 사용된 프롬프트 버전';
comment on column public.review_candidates.heuristic_version   is '분석에 사용된 휴리스틱 버전';
comment on column public.review_candidates.source              is 'candidate 생성 경로: batch | upload | reanalyze';

-- ── review_labels 확장 ──────────────────────────────────────────────────────

-- 운영 필드 (v1 최소화: 2개)
alter table public.review_labels
  add column if not exists final_requires_followup     boolean,
  add column if not exists final_should_create_record  boolean;

-- 검수자 유형
alter table public.review_labels
  add column if not exists reviewer_type  text
    check (reviewer_type in ('human', 'ai', 'hybrid'));

-- 교정 뷰용: 검수 완료 시각 (미채우면 updated_at 폴백)
alter table public.review_labels
  add column if not exists reviewed_at timestamptz;

comment on column public.review_labels.final_requires_followup    is '후속 연락/확인이 필요한가';
comment on column public.review_labels.final_should_create_record is '운영상 반드시 기록으로 남겨야 하는가 (예약 확정, 분쟁 가능성 등)';
comment on column public.review_labels.reviewer_type              is 'human | ai | hybrid';
comment on column public.review_labels.reviewed_at                is '검수 완료 시각(선택); null이면 correction_events에서 updated_at 사용)';

-- ── correction_events VIEW ──────────────────────────────────────────────────

create or replace view public.correction_events as
select
  rc.id                                                         as candidate_id,
  rc.call_id,
  rc.original_intent,
  rl.final_call_type                                            as corrected_intent,
  rc.original_confidence,
  rc.model_version,
  rc.prompt_version,
  rc.heuristic_version,
  rc.source,
  (rc.original_intent is distinct from rl.final_call_type)     as intent_changed,
  (rc.original_summary is distinct from rl.final_summary)      as summary_changed,
  rl.final_requires_followup,
  rl.final_should_create_record,
  coalesce(rl.reviewed_at, rl.updated_at)                       as reviewed_at
from public.review_candidates rc
join public.review_labels rl on rl.candidate_id = rc.id
where rc.original_intent is not null;

comment on view public.correction_events is '교정 이벤트: snapshot vs 최종 판정 diff (오분류 패턴 분석용)';
