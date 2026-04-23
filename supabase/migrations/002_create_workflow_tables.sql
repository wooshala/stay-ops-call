-- Workflow tables: operation_cases, service_requests, reservation_leads
-- Requires 001_create_calls.sql (public.set_updated_at)
-- Idempotent patch / 단일 스크립트: 003_patch_workflow_tables.sql (미적용 DB에 권장)

create table if not exists public.operation_cases (
  id uuid primary key default gen_random_uuid(),
  call_id uuid not null unique references public.calls(id) on delete cascade,
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

create table if not exists public.service_requests (
  id uuid primary key default gen_random_uuid(),
  call_id uuid not null unique references public.calls(id) on delete cascade,
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

create table if not exists public.reservation_leads (
  id uuid primary key default gen_random_uuid(),
  call_id uuid not null unique references public.calls(id) on delete cascade,
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

create index if not exists idx_operation_cases_room_no on public.operation_cases(room_no);
create index if not exists idx_operation_cases_status on public.operation_cases(status);

create index if not exists idx_service_requests_room_no on public.service_requests(room_no);
create index if not exists idx_service_requests_status on public.service_requests(status);

create index if not exists idx_reservation_leads_normalized_phone on public.reservation_leads(normalized_phone);
create index if not exists idx_reservation_leads_status on public.reservation_leads(status);

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
