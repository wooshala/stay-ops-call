-- 파일 중심 검수 플로우: 원본 파일명 추적, 배치 워커 업로드 루트, 제외 목록

alter table public.calls
  add column if not exists source_file_name text;

comment on column public.calls.source_file_name is '업로드 폴더 기준 원본 오디오 파일명(검수·배치)';

alter table public.batch_jobs
  add column if not exists upload_root text;

comment on column public.batch_jobs.upload_root is 'STT/분석 시 오디오를 읽을 서버 디렉터리(절대 경로 권장)';

create table if not exists public.review_file_state (
  file_name text primary key,
  excluded boolean not null default false,
  updated_at timestamptz not null default now()
);

comment on table public.review_file_state is '검수 UI에서 사용자가 제외한 파일명(폴더 내 유일 가정)';
