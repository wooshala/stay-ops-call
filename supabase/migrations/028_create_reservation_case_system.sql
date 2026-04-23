create table if not exists public.reservation_cases (
  id uuid primary key default gen_random_uuid(),

  -- 연결
  call_id uuid references public.calls(id),

  -- 고객
  phone_number text,

  -- 예약 핵심
  checkin_date date,
  stay_type text, -- 'stay' | 'dayuse'
  room_type text,
  people_count int,

  -- 상태
  state text not null default 'new',

  -- 체크 플래그
  is_pms_registered boolean default false,
  is_room_confirmed boolean default false,
  is_checkin_time_confirmed boolean default false,

  -- 운영 통제
  current_owner text,
  next_action text,
  due_at timestamptz,
  is_overdue boolean default false,

  -- 위험
  risk_level text default 'normal',
  risk_code text,

  -- 메타
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists idx_reservation_cases_call_id
on public.reservation_cases(call_id);

create index if not exists idx_reservation_cases_state
on public.reservation_cases(state);

create index if not exists idx_reservation_cases_due_at
on public.reservation_cases(due_at);

create table if not exists public.case_events (
  id uuid primary key default gen_random_uuid(),
  case_id uuid references public.reservation_cases(id),
  type text,
  message text,
  created_at timestamptz default now()
);

create index if not exists idx_case_events_case_id
on public.case_events(case_id);

create table if not exists public.case_tasks (
  id uuid primary key default gen_random_uuid(),
  case_id uuid references public.reservation_cases(id),
  task_type text,
  status text default 'pending',
  owner text,
  due_at timestamptz,
  created_at timestamptz default now()
);

create index if not exists idx_case_tasks_case_id
on public.case_tasks(case_id);

