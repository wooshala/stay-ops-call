-- ============================================================
-- 031_workflow_status_columns.sql
-- calls 테이블에 workflow 생명주기 컬럼 추가
-- analysis_status와 workflow_status를 분리하여 독립 추적
-- ============================================================

ALTER TABLE public.calls
  ADD COLUMN IF NOT EXISTS workflow_status           TEXT,
  ADD COLUMN IF NOT EXISTS workflow_error_code       TEXT,
  ADD COLUMN IF NOT EXISTS workflow_error_message    TEXT,
  ADD COLUMN IF NOT EXISTS workflow_attempts         INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS workflow_last_attempt_at  TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS workflow_completed_at     TIMESTAMPTZ;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'chk_workflow_status'
      AND conrelid = 'public.calls'::regclass
  ) THEN
    ALTER TABLE public.calls
      ADD CONSTRAINT chk_workflow_status
        CHECK (workflow_status IN ('pending','running','completed','failed','skipped'));
  END IF;
END $$;

COMMENT ON COLUMN public.calls.workflow_status          IS 'workflow 생성 상태 (분석 상태와 독립)';
COMMENT ON COLUMN public.calls.workflow_error_code      IS 'workflow 실패 시 기계 판별 코드';
COMMENT ON COLUMN public.calls.workflow_error_message   IS 'workflow 실패 시 사람 읽기용 메시지';
COMMENT ON COLUMN public.calls.workflow_attempts        IS 'workflow 생성 시도 횟수';
COMMENT ON COLUMN public.calls.workflow_last_attempt_at IS '마지막 workflow 시도 시각';
COMMENT ON COLUMN public.calls.workflow_completed_at    IS 'workflow 완료 시각';
