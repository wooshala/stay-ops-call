-- Idempotent: remote DB may have missed 006; ensure pre-analysis columns exist.
alter table public.calls
  add column if not exists transcript_cleaned text;

alter table public.calls
  add column if not exists analysis_input_text text;

comment on column public.calls.transcript_cleaned is '반복 제거 등 전처리된 STT (원본 보존)';
comment on column public.calls.analysis_input_text is '실제 LLM 분석에 넣은 텍스트 (긴 통화 시 요약 추출 포함)';

-- Optional diagnostics (nullable; app may omit on older schemas — code uses defensive updates)
alter table public.calls
  add column if not exists analysis_error_code text;

alter table public.calls
  add column if not exists analysis_raw_response text;

alter table public.calls
  add column if not exists analysis_version text;

comment on column public.calls.analysis_error_code is '짧은 기계 판별 코드 (예: DB_PERSIST_PARTIAL, SCHEMA_MISMATCH)';
comment on column public.calls.analysis_raw_response is 'LLM 원시 응답 또는 직렬화된 중간 결과(디버그)';
comment on column public.calls.analysis_version is '분석 스키마/프롬프트 버전';

-- analysis_status: app uses completed | processing | pending | failed | partial | warning (text, no strict check)
