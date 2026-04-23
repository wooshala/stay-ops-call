-- 참고용 보조 의도 (워크플로는 primary만 유지)
alter table public.calls
  add column if not exists actionable_secondary_intents jsonb;

comment on column public.calls.actionable_secondary_intents is
  'Optional array of PrimaryIntent values; UI/reference only; workflow uses primary_intent only';
