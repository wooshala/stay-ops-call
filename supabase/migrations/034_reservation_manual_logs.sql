-- Phase 1 MVP: 수동 예약 기록 테이블
-- 구두 예약 미기입 → 당일 오버부킹 사고 방지

create table if not exists public.reservation_manual_logs (
  id               uuid        primary key default gen_random_uuid(),

  -- 예약 정보
  phone_number     text,
  guest_name       text,
  check_in_date    date        not null,
  check_in_time    time,
  room_type        text,
  vehicle_info     text,
  occupancy_count  integer,

  -- 상태
  status           text        not null default 'inquiry'
    check (status in ('inquiry','tentative','confirmed','follow_up','cancelled')),

  memo             text,
  pms_confirmed    boolean     not null default false,

  -- 기존 통화 연결 (선택)
  call_id          uuid        references public.calls(id) on delete set null,

  -- 감사 로그
  created_by       text,
  created_at       timestamptz not null default now(),
  updated_by       text,
  updated_at       timestamptz not null default now()
);

create index if not exists idx_rml_check_in_date  on public.reservation_manual_logs(check_in_date);
create index if not exists idx_rml_phone          on public.reservation_manual_logs(phone_number);
create index if not exists idx_rml_status         on public.reservation_manual_logs(status);
create index if not exists idx_rml_created_at     on public.reservation_manual_logs(created_at desc);

-- updated_at 자동 갱신
drop trigger if exists trg_rml_updated_at on public.reservation_manual_logs;
create trigger trg_rml_updated_at
  before update on public.reservation_manual_logs
  for each row execute function public.set_updated_at();

comment on table  public.reservation_manual_logs                is '수동 예약 기록 — 구두 예약 누락 방지용';
comment on column public.reservation_manual_logs.status         is 'inquiry(문의)|tentative(구두확정)|confirmed(확정)|follow_up(추후연락)|cancelled(취소)';
comment on column public.reservation_manual_logs.pms_confirmed  is 'PMS에 입력 여부 (직원 수동 확인)';
comment on column public.reservation_manual_logs.call_id        is '연결된 통화 ID (선택)';
