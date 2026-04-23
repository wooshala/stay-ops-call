alter table public.quotes
  add column if not exists review_reason text,
  add column if not exists created_by text,
  add column if not exists updated_by text;

alter table public.quotes
  alter column quote_text drop not null;

alter table public.quotes
  alter column total_amount type integer using round(total_amount::numeric),
  alter column final_amount type integer using round(final_amount::numeric);
