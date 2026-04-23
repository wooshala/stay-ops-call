alter table public.calls
  add column if not exists auto_score numeric,
  add column if not exists auto_decision text,
  add column if not exists cluster_id text;
