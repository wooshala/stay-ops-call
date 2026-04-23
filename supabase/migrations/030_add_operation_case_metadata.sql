-- 새 컬럼 추가 (nullable)
ALTER TABLE public.operation_cases
  ADD COLUMN IF NOT EXISTS channel_type TEXT DEFAULT 'call';

ALTER TABLE public.operation_cases
  ADD COLUMN IF NOT EXISTS source_confidence NUMERIC(3,2) DEFAULT 0.5;

-- 체크 제약 추가 (선택)
ALTER TABLE public.operation_cases
  ADD CONSTRAINT chk_channel_type CHECK (channel_type IN ('call', 'chat', 'email', 'other'));

ALTER TABLE public.operation_cases
  ADD CONSTRAINT chk_source_confidence CHECK (source_confidence >= 0 AND source_confidence <= 1);
