-- AI 예약 초안 → 사람 승인 후 시트 반영

create table if not exists public.reservation_drafts (
  id               uuid primary key default gen_random_uuid(),
  call_id          uuid references public.calls(id) on delete set null,
  review_status    text not null default 'pending'
    check (review_status in ('pending', 'approved', 'dismissed')),
  draft_json       jsonb not null default '{}',
  final_json       jsonb,
  reviewed_by      text,
  reviewed_at      timestamptz,
  sheet_appended_at timestamptz,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

create index if not exists idx_reservation_drafts_review_status_created
  on public.reservation_drafts(review_status, created_at desc);

create index if not exists idx_reservation_drafts_call_id
  on public.reservation_drafts(call_id);

drop trigger if exists trg_reservation_drafts_updated_at on public.reservation_drafts;
create trigger trg_reservation_drafts_updated_at
  before update on public.reservation_drafts
  for each row execute function public.set_updated_at();

comment on table public.reservation_drafts is 'AI 생성 예약 초안 — 승인 전까지 pending';
comment on column public.reservation_drafts.draft_json is 'AI 추출 원본(JSON)';
comment on column public.reservation_drafts.final_json is '승인 시점 최종값(수정 반영 시 draft와 다를 수 있음)';
