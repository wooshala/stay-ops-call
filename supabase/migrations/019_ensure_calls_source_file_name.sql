-- Ensure calls.source_file_name exists on older environments.
alter table public.calls
  add column if not exists source_file_name text;

comment on column public.calls.source_file_name is '원본 파일명(검수 업로드 기준)';
