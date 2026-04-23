-- 분석 입력용 전처리 텍스트 (원본 transcript_text는 STT 그대로 유지)
alter table public.calls
  add column if not exists transcript_cleaned text;

alter table public.calls
  add column if not exists analysis_input_text text;

comment on column public.calls.transcript_cleaned is '반복 제거 등 전처리된 STT (원본 보존)';
comment on column public.calls.analysis_input_text is '실제 LLM 분석에 넣은 텍스트 (긴 통화 시 요약 추출 포함)';
