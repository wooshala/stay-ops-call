create table if not exists public.quotes (
  id uuid primary key default gen_random_uuid(),
  call_id uuid null references public.calls(id) on delete set null,
  customer_phone_number text null,
  requested_date date null,
  requested_weekday text null,
  stay_type text not null,
  room_type text null,
  quoted_price numeric null,
  price_currency text not null default 'KRW',
  message_body text not null,
  quote_status text not null default 'confirmed',
  source_kind text not null,
  source_system text null,
  source_reference_id text null,
  finalized_by text null,
  finalized_at timestamptz null,
  sent_at timestamptz null,
  metadata_json jsonb null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_quotes_call_id on public.quotes(call_id);
create index if not exists idx_quotes_quote_status on public.quotes(quote_status);
create index if not exists idx_quotes_updated_at on public.quotes(updated_at desc);

comment on table public.quotes is '최종 견적 저장소(source of truth)';
comment on column public.quotes.source_kind is '견적 출처(auto|manual)';
comment on column public.quotes.source_system is '견적 생성 시스템(web_quote_engine|apps_script|google_sheet...)';
