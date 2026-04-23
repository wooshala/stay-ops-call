-- 운영/배치에서 calls 저장 깊이 표시 (LLM 성공과 독립)
alter table public.calls
  add column if not exists analysis_persist_level text;

comment on column public.calls.analysis_persist_level is
  'full | partial_db | minimal | none — DB 반영 수준';

alter table public.batch_job_items
  add column if not exists analysis_persist_level text;

comment on column public.batch_job_items.analysis_persist_level is
  '처리 시점 calls.analysis_persist_level 스냅샷';
