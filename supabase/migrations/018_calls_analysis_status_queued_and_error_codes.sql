-- Ops contract: analysis_status 기본 queued, legacy pending 정리, 실패 코드 컬럼 보장

alter table public.calls
  add column if not exists analysis_error_code text;

comment on column public.calls.analysis_error_code is '실패·경고 판별 코드 (예: stt_failed, no_transcript)';

-- legacy: 분석 대기 = pending → queued
update public.calls
set analysis_status = 'queued'
where analysis_status = 'pending';

update public.calls
set analysis_status = 'queued'
where analysis_status is null;

alter table public.calls
  alter column analysis_status set default 'queued';
