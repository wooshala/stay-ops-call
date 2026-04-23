alter table public.calls
  add column if not exists file_size_kb integer,
  add column if not exists primary_intent text,
  add column if not exists confidence numeric;
