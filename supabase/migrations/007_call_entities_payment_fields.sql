-- 결제·단체 등 확장 엔티티 (LLM 추출 + 휴리스틱 보강용)
alter table public.call_entities
  add column if not exists amount numeric;

alter table public.call_entities
  add column if not exists payment_method text;

alter table public.call_entities
  add column if not exists payment_deposit boolean;

alter table public.call_entities
  add column if not exists group_booking boolean;

comment on column public.call_entities.amount is '결제·견적 금액(원 등)';
comment on column public.call_entities.payment_method is '카드, 계좌이체, 현금 등';
comment on column public.call_entities.payment_deposit is '계약금·예약금 성격 여부';
comment on column public.call_entities.group_booking is '단체·다인 예약 여부';
