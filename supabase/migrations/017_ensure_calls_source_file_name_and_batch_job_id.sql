-- calls: 검수·배치 연동 (이미 013·015에서 추가된 경우 그대로 통과)
-- 신규/부분 적용 DB에서도 idempotent 하게 맞춘다.

alter table public.calls
  add column if not exists source_file_name text;

alter table public.calls
  add column if not exists batch_job_id uuid references public.batch_jobs(id) on delete set null;

create index if not exists idx_calls_batch_job_id on public.calls(batch_job_id);

comment on column public.calls.source_file_name is '업로드 폴더 기준 원본 오디오 파일명(검수·배치)';
comment on column public.calls.batch_job_id is '이 통화를 생성한 배치 잡(직접 연결; 없으면 batch_job_items로 추적)';
