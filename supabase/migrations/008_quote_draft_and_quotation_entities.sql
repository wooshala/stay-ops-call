-- 견적서 초안 + 견적 엔티티 확장
alter table public.calls
  add column if not exists quote_draft text;

comment on column public.calls.quote_draft is '견적서 초안 텍스트(자동 생성)';

alter table public.call_entities
  add column if not exists room_count integer;

alter table public.call_entities
  add column if not exists deposit_amount numeric;

alter table public.call_entities
  add column if not exists parking_count integer;

comment on column public.call_entities.room_count is '견적·단체: 객실 수';
comment on column public.call_entities.deposit_amount is '예약금·계약금(원)';
comment on column public.call_entities.parking_count is '주차 대수';
