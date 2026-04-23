-- 검수 후보: 점수 사유 JSON, 대표 플래그 컬럼명 정리

alter table public.review_candidates
  add column if not exists reason_json jsonb;

comment on column public.review_candidates.reason_json is 'review_priority_score 가중치 항목별 점수';

do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name = 'review_candidates'
      and column_name = 'is_cluster_representative'
  ) and not exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name = 'review_candidates'
      and column_name = 'is_representative'
  ) then
    alter table public.review_candidates
      rename column is_cluster_representative to is_representative;
  end if;
end $$;

comment on column public.review_candidates.is_representative is '클러스터 내 대표 샘플(1~n건)';
