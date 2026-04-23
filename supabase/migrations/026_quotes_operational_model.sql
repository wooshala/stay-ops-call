do $$
begin
  if not exists (select 1 from pg_type where typname = 'quote_source_enum') then
    create type public.quote_source_enum as enum ('auto', 'manual', 'imported');
  end if;
  if not exists (select 1 from pg_type where typname = 'quote_status_enum') then
    create type public.quote_status_enum as enum ('draft', 'ready', 'sent', 'accepted', 'rejected', 'expired');
  end if;
  if not exists (select 1 from pg_type where typname = 'quote_channel_enum') then
    create type public.quote_channel_enum as enum ('sms', 'kakao', 'email', 'manual');
  end if;
  if not exists (select 1 from pg_type where typname = 'quote_message_send_status_enum') then
    create type public.quote_message_send_status_enum as enum ('pending', 'sent', 'failed');
  end if;
end$$;

alter table public.quotes
  add column if not exists customer_phone text,
  add column if not exists customer_name text,
  add column if not exists source public.quote_source_enum,
  add column if not exists status public.quote_status_enum,
  add column if not exists title text,
  add column if not exists summary text,
  add column if not exists quote_text text,
  add column if not exists internal_memo text,
  add column if not exists total_amount numeric,
  add column if not exists final_amount numeric,
  add column if not exists parse_confidence double precision,
  add column if not exists quote_confidence double precision,
  add column if not exists needs_review boolean not null default false,
  add column if not exists review_reason text,
  add column if not exists failure_reason text,
  add column if not exists accepted_at timestamptz,
  add column if not exists rejected_at timestamptz,
  add column if not exists expired_at timestamptz,
  add column if not exists external_sync_status text,
  add column if not exists external_sync_target text,
  add column if not exists external_sync_at timestamptz,
  add column if not exists external_ref_id text,
  add column if not exists created_by text,
  add column if not exists updated_by text;

update public.quotes
set customer_phone = coalesce(customer_phone, customer_phone_number)
where customer_phone is null;

update public.quotes
set source = coalesce(source, case when source_kind in ('auto', 'manual') then source_kind::public.quote_source_enum else 'imported'::public.quote_source_enum end)
where source is null;

update public.quotes
set status = coalesce(
  status,
  case
    when quote_status = 'sent' then 'sent'::public.quote_status_enum
    when quote_status = 'confirmed' then 'ready'::public.quote_status_enum
    else 'draft'::public.quote_status_enum
  end
)
where status is null;

update public.quotes
set quote_text = coalesce(quote_text, message_body)
where quote_text is null;

alter table public.quotes
  alter column source set not null,
  alter column status set not null;

alter table public.quotes
  alter column quote_text drop not null;

alter table public.quotes
  alter column total_amount type integer using round(total_amount::numeric),
  alter column final_amount type integer using round(final_amount::numeric);

create table if not exists public.quote_messages (
  id uuid primary key default gen_random_uuid(),
  quote_id uuid not null references public.quotes(id) on delete cascade,
  channel public.quote_channel_enum not null,
  recipient text not null,
  message_text text not null,
  send_status public.quote_message_send_status_enum not null default 'pending',
  provider text,
  provider_message_id text,
  error_message text,
  sent_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists idx_quote_messages_quote_id on public.quote_messages(quote_id);
create index if not exists idx_quote_messages_send_status on public.quote_messages(send_status);

create table if not exists public.quote_versions (
  id uuid primary key default gen_random_uuid(),
  quote_id uuid not null references public.quotes(id) on delete cascade,
  version_no integer not null,
  draft_text text not null,
  payload jsonb,
  created_by text,
  created_at timestamptz not null default now(),
  unique (quote_id, version_no)
);

create index if not exists idx_quote_versions_quote_id on public.quote_versions(quote_id);
create index if not exists idx_quotes_status on public.quotes(status);
create index if not exists idx_quotes_source on public.quotes(source);
create index if not exists idx_quotes_needs_review on public.quotes(needs_review);
create index if not exists idx_quotes_customer_phone on public.quotes(customer_phone);
