-- review pipeline columns + skipped cleanup + review logs
alter table public.calls
  add column if not exists review_status text not null default 'raw';

alter table public.calls
  add column if not exists label_status text not null default 'none';

alter table public.calls
  add column if not exists file_fingerprint text;

alter table public.calls
  add column if not exists reviewed_at timestamptz;

alter table public.calls
  add column if not exists reviewed_by text;

update public.calls
set analysis_status = 'warning'
where analysis_status = 'skipped';

create unique index if not exists idx_calls_fingerprint_unique
on public.calls(file_fingerprint)
where file_fingerprint is not null;

create table if not exists public.review_logs (
  id uuid primary key default gen_random_uuid(),
  call_id uuid not null references public.calls(id) on delete cascade,
  action text not null,
  before_json jsonb,
  after_json jsonb,
  created_at timestamptz not null default now(),
  created_by text
);

create index if not exists idx_review_logs_call_id_created_at
on public.review_logs(call_id, created_at desc);

comment on column public.calls.review_status is 'raw | needs_review | verified | rejected';
comment on column public.calls.label_status is 'none | auto | human_verified';
comment on column public.calls.file_fingerprint is '중복 방지용 파일 fingerprint';
comment on column public.calls.reviewed_by is '검수 완료 처리자';
