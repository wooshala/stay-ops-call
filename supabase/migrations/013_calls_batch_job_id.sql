-- 배치 잡 ↔ 통화 직접 연결 (검수·목록 조회를 DB 기준으로 단순화)

alter table public.batch_jobs
  add column if not exists name text;

comment on column public.batch_jobs.name is '표시용 배치 이름';

alter table public.calls
  add column if not exists batch_job_id uuid references public.batch_jobs(id) on delete set null;

create index if not exists idx_calls_batch_job_id on public.calls(batch_job_id);

-- 기존 batch_job_items 기준 역추적 (한 통화가 여러 배치에 있으면 최근 항목 우선)
with pick as (
  select distinct on (call_id)
    call_id,
    batch_job_id
  from public.batch_job_items
  where call_id is not null
  order by call_id, created_at desc
)
update public.calls c
set batch_job_id = pick.batch_job_id
from pick
where c.id = pick.call_id
  and c.batch_job_id is null;

comment on column public.calls.batch_job_id is '이 통화를 생성한 배치 테스트 잡';
