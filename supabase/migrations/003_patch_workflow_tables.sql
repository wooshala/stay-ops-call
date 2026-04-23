-- ============================================================================
-- 003_patch_workflow_tables.sql
-- Workflow 테이블: operation_cases, service_requests, reservation_leads
-- ============================================================================
-- 선행 조건: 001_create_calls.sql (public.calls 존재)
-- 용도:
--   - 신규 프로젝트: CREATE TABLE IF NOT EXISTS 로 3테이블 생성
--   - 기존 DB(002 미적용/부분 적용): ADD COLUMN IF NOT EXISTS 로 컬럼 보강
-- 재실행: 안전 (IF NOT EXISTS 위주)
--
-- 앱 기대 스키마: lib/db/workflows.ts (upsert onConflict: call_id)
-- ============================================================================

create or replace function public.set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

-- ---------------------------------------------------------------------------
-- operation_cases
-- ---------------------------------------------------------------------------
create table if not exists public.operation_cases (
  id uuid primary key default gen_random_uuid(),
  call_id uuid not null references public.calls(id) on delete cascade,
  room_no text,
  case_type text default 'maintenance',
  issue_type text,
  title text not null,
  description text,
  severity text default 'normal' check (severity in ('low','normal','high')),
  status text default 'open' check (status in ('open','in_progress','resolved','closed')),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table public.operation_cases add column if not exists id uuid default gen_random_uuid();
alter table public.operation_cases add column if not exists call_id uuid;
alter table public.operation_cases add column if not exists room_no text;
alter table public.operation_cases add column if not exists case_type text default 'maintenance';
alter table public.operation_cases add column if not exists issue_type text;
alter table public.operation_cases add column if not exists title text;
alter table public.operation_cases add column if not exists description text;
alter table public.operation_cases add column if not exists severity text default 'normal';
alter table public.operation_cases add column if not exists status text default 'open';
alter table public.operation_cases add column if not exists created_at timestamptz default now();
alter table public.operation_cases add column if not exists updated_at timestamptz default now();

update public.operation_cases set title = coalesce(title, 'Untitled') where title is null;

do $$
begin
  alter table public.operation_cases alter column title set default 'Untitled';
exception when others then null;
end $$;

do $$
begin
  alter table public.operation_cases alter column title set not null;
exception when others then null;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_constraint c
    join pg_class t on c.conrelid = t.oid
    join pg_namespace n on t.relnamespace = n.oid
    where n.nspname = 'public' and t.relname = 'operation_cases' and c.conname = 'operation_cases_call_id_fkey'
  ) then
    alter table public.operation_cases
      add constraint operation_cases_call_id_fkey
      foreign key (call_id) references public.calls(id) on delete cascade;
  end if;
end $$;

create unique index if not exists operation_cases_call_id_uidx on public.operation_cases (call_id);

-- ---------------------------------------------------------------------------
-- service_requests
-- ---------------------------------------------------------------------------
create table if not exists public.service_requests (
  id uuid primary key default gen_random_uuid(),
  call_id uuid not null references public.calls(id) on delete cascade,
  room_no text,
  request_type text,
  item_requested text,
  quantity numeric,
  unit text,
  title text not null,
  description text,
  status text default 'open' check (status in ('open','in_progress','completed','cancelled')),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table public.service_requests add column if not exists id uuid default gen_random_uuid();
alter table public.service_requests add column if not exists call_id uuid;
alter table public.service_requests add column if not exists room_no text;
alter table public.service_requests add column if not exists request_type text;
alter table public.service_requests add column if not exists item_requested text;
alter table public.service_requests add column if not exists quantity numeric;
alter table public.service_requests add column if not exists unit text;
alter table public.service_requests add column if not exists title text;
alter table public.service_requests add column if not exists description text;
alter table public.service_requests add column if not exists status text default 'open';
alter table public.service_requests add column if not exists created_at timestamptz default now();
alter table public.service_requests add column if not exists updated_at timestamptz default now();

update public.service_requests set title = coalesce(title, 'Untitled') where title is null;

do $$
begin
  alter table public.service_requests alter column title set default 'Untitled';
exception when others then null;
end $$;

do $$
begin
  alter table public.service_requests alter column title set not null;
exception when others then null;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_constraint c
    join pg_class t on c.conrelid = t.oid
    join pg_namespace n on t.relnamespace = n.oid
    where n.nspname = 'public' and t.relname = 'service_requests' and c.conname = 'service_requests_call_id_fkey'
  ) then
    alter table public.service_requests
      add constraint service_requests_call_id_fkey
      foreign key (call_id) references public.calls(id) on delete cascade;
  end if;
end $$;

create unique index if not exists service_requests_call_id_uidx on public.service_requests (call_id);

-- ---------------------------------------------------------------------------
-- reservation_leads
-- ---------------------------------------------------------------------------
create table if not exists public.reservation_leads (
  id uuid primary key default gen_random_uuid(),
  call_id uuid not null references public.calls(id) on delete cascade,
  phone_number text,
  normalized_phone text,
  lead_type text,
  guest_name text,
  room_no text,
  arrival_eta text,
  occupancy_count integer,
  quoted_price numeric,
  title text not null,
  description text,
  status text default 'new' check (status in ('new','contacted','converted','lost')),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table public.reservation_leads add column if not exists id uuid default gen_random_uuid();
alter table public.reservation_leads add column if not exists call_id uuid;
alter table public.reservation_leads add column if not exists phone_number text;
alter table public.reservation_leads add column if not exists normalized_phone text;
alter table public.reservation_leads add column if not exists lead_type text;
alter table public.reservation_leads add column if not exists guest_name text;
alter table public.reservation_leads add column if not exists room_no text;
alter table public.reservation_leads add column if not exists arrival_eta text;
alter table public.reservation_leads add column if not exists occupancy_count integer;
alter table public.reservation_leads add column if not exists quoted_price numeric;
alter table public.reservation_leads add column if not exists title text;
alter table public.reservation_leads add column if not exists description text;
alter table public.reservation_leads add column if not exists status text default 'new';
alter table public.reservation_leads add column if not exists created_at timestamptz default now();
alter table public.reservation_leads add column if not exists updated_at timestamptz default now();

update public.reservation_leads set title = coalesce(title, 'Untitled') where title is null;

do $$
begin
  alter table public.reservation_leads alter column title set default 'Untitled';
exception when others then null;
end $$;

do $$
begin
  alter table public.reservation_leads alter column title set not null;
exception when others then null;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_constraint c
    join pg_class t on c.conrelid = t.oid
    join pg_namespace n on t.relnamespace = n.oid
    where n.nspname = 'public' and t.relname = 'reservation_leads' and c.conname = 'reservation_leads_call_id_fkey'
  ) then
    alter table public.reservation_leads
      add constraint reservation_leads_call_id_fkey
      foreign key (call_id) references public.calls(id) on delete cascade;
  end if;
end $$;

create unique index if not exists reservation_leads_call_id_uidx on public.reservation_leads (call_id);

-- ---------------------------------------------------------------------------
-- Indexes
-- ---------------------------------------------------------------------------
create index if not exists idx_operation_cases_room_no on public.operation_cases(room_no);
create index if not exists idx_operation_cases_status on public.operation_cases(status);

create index if not exists idx_service_requests_room_no on public.service_requests(room_no);
create index if not exists idx_service_requests_status on public.service_requests(status);

create index if not exists idx_reservation_leads_normalized_phone on public.reservation_leads(normalized_phone);
create index if not exists idx_reservation_leads_status on public.reservation_leads(status);

-- ---------------------------------------------------------------------------
-- Triggers
-- ---------------------------------------------------------------------------
drop trigger if exists trg_operation_cases_updated_at on public.operation_cases;
create trigger trg_operation_cases_updated_at
before update on public.operation_cases
for each row execute function public.set_updated_at();

drop trigger if exists trg_service_requests_updated_at on public.service_requests;
create trigger trg_service_requests_updated_at
before update on public.service_requests
for each row execute function public.set_updated_at();

drop trigger if exists trg_reservation_leads_updated_at on public.reservation_leads;
create trigger trg_reservation_leads_updated_at
before update on public.reservation_leads
for each row execute function public.set_updated_at();

-- PostgREST (Supabase API) 스키마 캐시 갱신 — "table not in schema cache" 완화
notify pgrst, 'reload schema';
