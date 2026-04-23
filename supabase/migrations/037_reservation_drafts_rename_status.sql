-- 035에서 status로 생성된 컬럼을 review_status로 정규화
-- 이미 review_status인 DB에서는 아무 작업도 하지 않음

DO $$
BEGIN
  -- status 컬럼이 존재하고 review_status가 없으면 rename
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name   = 'reservation_drafts'
      AND column_name  = 'status'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name   = 'reservation_drafts'
      AND column_name  = 'review_status'
  ) THEN
    ALTER TABLE public.reservation_drafts RENAME COLUMN status TO review_status;

    -- 기존 인덱스 교체
    DROP INDEX IF EXISTS public.idx_reservation_drafts_status_created;
    CREATE INDEX IF NOT EXISTS idx_reservation_drafts_review_status_created
      ON public.reservation_drafts(review_status, created_at DESC);
  END IF;
END $$;
