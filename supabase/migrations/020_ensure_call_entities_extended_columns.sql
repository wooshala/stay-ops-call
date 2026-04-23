-- call_entities 확장 컬럼 정합성 보장 (코드 insert 필드 기준)
alter table public.call_entities
  add column if not exists amount numeric;

alter table public.call_entities
  add column if not exists payment_method text;

alter table public.call_entities
  add column if not exists payment_deposit boolean;

alter table public.call_entities
  add column if not exists group_booking boolean;

alter table public.call_entities
  add column if not exists room_count integer;

alter table public.call_entities
  add column if not exists deposit_amount numeric;

alter table public.call_entities
  add column if not exists parking_count integer;

comment on column public.call_entities.amount is '결제·견적 금액';
comment on column public.call_entities.payment_method is '결제 수단';
comment on column public.call_entities.payment_deposit is '예약금/계약금 여부';
comment on column public.call_entities.group_booking is '단체 예약 여부';
comment on column public.call_entities.room_count is '객실 수';
comment on column public.call_entities.deposit_amount is '예약금 금액';
comment on column public.call_entities.parking_count is '주차 대수';
