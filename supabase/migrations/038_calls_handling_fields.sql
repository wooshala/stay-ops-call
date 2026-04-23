-- 콜 처리 큐: calls 테이블 운영 필드 추가 + activity 로그 테이블 생성

-- 1. calls 테이블 신규 컬럼
ALTER TABLE public.calls
  ADD COLUMN IF NOT EXISTS handling_status text
    NOT NULL DEFAULT 'new'
    CHECK (handling_status IN (
      'new', 'in_progress', 'done',
      'need_property_reply', 'waiting_customer', 'follow_up_needed'
    )),
  ADD COLUMN IF NOT EXISTS manual_classification text,
  ADD COLUMN IF NOT EXISTS assignee             text,
  ADD COLUMN IF NOT EXISTS next_action          text,
  ADD COLUMN IF NOT EXISTS next_action_at       timestamptz,
  ADD COLUMN IF NOT EXISTS handled_at           timestamptz;

CREATE INDEX IF NOT EXISTS idx_calls_handling_status
  ON public.calls(handling_status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_calls_assignee
  ON public.calls(assignee)
  WHERE assignee IS NOT NULL;

-- 2. 콜 활동 로그 테이블
CREATE TABLE IF NOT EXISTS public.call_activity_logs (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  call_id     uuid        NOT NULL REFERENCES public.calls(id) ON DELETE CASCADE,
  event_type  text        NOT NULL,   -- status_changed / assignee_changed / note_added / next_action_set / etc.
  actor       text,                   -- 담당자 이름 (optional)
  payload     jsonb       NOT NULL DEFAULT '{}',
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_call_activity_logs_call_id
  ON public.call_activity_logs(call_id, created_at DESC);

COMMENT ON TABLE  public.call_activity_logs                   IS '콜 처리 이력 — 상태 변경 / 메모 등 append-only';
COMMENT ON COLUMN public.call_activity_logs.event_type        IS 'status_changed | assignee_changed | note_added | next_action_set';
COMMENT ON COLUMN public.call_activity_logs.payload           IS '{"from":"new","to":"in_progress"} 형태 등 이벤트 별 자유 구조';

-- 3. 기존 데이터 backfill
-- 038 적용 전 이미 분석 완료된 콜은 처리 큐를 오염시키지 않도록 done으로 설정.
-- 분석 미완료(failed / queued / pending 등)는 new 유지 → 재처리 검토 대상.
UPDATE public.calls
SET handling_status = 'done'
WHERE handling_status = 'new'          -- DEFAULT로 방금 채워진 값만
  AND analysis_status IN ('completed', 'partial', 'warning')
  AND created_at < now() - interval '1 hour';  -- 방금 ingest된 건은 제외
