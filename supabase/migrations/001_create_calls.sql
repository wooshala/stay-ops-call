-- Stay-Ops-Call MVP schema
-- Run in Supabase SQL editor or via supabase db push

create table if not exists public.calls (
  id uuid primary key default gen_random_uuid(),
  started_at timestamptz,
  ended_at timestamptz,
  duration_sec integer,
  phone_number text,
  normalized_phone text,
  direction text check (direction in ('inbound','outbound')),
  source_type text check (source_type in ('internal','external','smartcall')),
  room_no_hint text,
  recording_path text,
  recording_url text,
  upload_status text default 'uploaded',
  stt_status text default 'pending',
  analysis_status text default 'pending',
  transcript_text text,
  summary text,
  primary_intent text,
  secondary_tags jsonb default '[]'::jsonb,
  stt_confidence numeric,
  analysis_confidence numeric,
  stt_provider text,
  stt_error_message text,
  analysis_error_message text,
  note text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists public.call_entities (
  id uuid primary key default gen_random_uuid(),
  call_id uuid not null references public.calls(id) on delete cascade,
  room_no text,
  guest_name text,
  issue_type text,
  item_requested text,
  quantity numeric,
  unit text,
  arrival_eta text,
  occupancy_count integer,
  checkin_date date,
  checkout_date date,
  quoted_price numeric,
  complaint_reason text,
  extracted_json jsonb default '{}'::jsonb,
  created_at timestamptz default now()
);

create table if not exists public.action_recommendations (
  id uuid primary key default gen_random_uuid(),
  call_id uuid not null references public.calls(id) on delete cascade,
  action_type text,
  title text not null,
  description text,
  status text default 'suggested' check (status in ('suggested','confirmed','dismissed')),
  priority text default 'normal' check (priority in ('low','normal','high')),
  created_at timestamptz default now()
);

create table if not exists public.phone_contacts (
  id uuid primary key default gen_random_uuid(),
  phone_number text not null,
  normalized_phone text not null unique,
  name text,
  first_seen_at timestamptz,
  last_seen_at timestamptz,
  total_calls integer default 0,
  inbound_calls integer default 0,
  outbound_calls integer default 0,
  last_intent text,
  last_summary text,
  notes text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists idx_calls_created_at on public.calls(created_at desc);
create index if not exists idx_calls_normalized_phone on public.calls(normalized_phone);
create index if not exists idx_calls_primary_intent on public.calls(primary_intent);
create index if not exists idx_calls_room_no_hint on public.calls(room_no_hint);

create index if not exists idx_call_entities_call_id on public.call_entities(call_id);
create index if not exists idx_call_entities_room_no on public.call_entities(room_no);

create index if not exists idx_action_recommendations_call_id on public.action_recommendations(call_id);

create index if not exists idx_phone_contacts_normalized_phone on public.phone_contacts(normalized_phone);
create index if not exists idx_phone_contacts_last_seen_at on public.phone_contacts(last_seen_at desc);

create or replace function public.set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_calls_updated_at on public.calls;
create trigger trg_calls_updated_at
before update on public.calls
for each row execute function public.set_updated_at();

drop trigger if exists trg_phone_contacts_updated_at on public.phone_contacts;
create trigger trg_phone_contacts_updated_at
before update on public.phone_contacts
for each row execute function public.set_updated_at();

-- Storage: create bucket "recordings" in Supabase Dashboard (Storage) and add policies as needed.
-- For server-side uploads with service role, RLS on storage can allow service role full access.
