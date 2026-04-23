-- Android 업로드 에이전트 추적 테이블
-- 기기별 업로드 이력을 서버에 보존하여 앱 삭제/기기 교체 후에도 장애 추적 가능

-- 1. file_fingerprint 유니크 인덱스
-- 앱 레벨 중복 체크와 별개로 DB 레벨 방어선을 추가한다.
-- 동시에 같은 파일이 두 번 insert되는 race condition 방지.
CREATE UNIQUE INDEX IF NOT EXISTS calls_file_fingerprint_uidx
  ON public.calls(file_fingerprint)
  WHERE file_fingerprint IS NOT NULL;

-- 2. 업로드 작업 이력 테이블
CREATE TABLE IF NOT EXISTS public.call_upload_jobs (
  id               uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  device_id        text        NOT NULL,
  source_type      text        NOT NULL DEFAULT 'android_agent',
  local_file_name  text,
  file_fingerprint text,
  -- queued | uploading | uploaded | duplicate | failed
  status           text        NOT NULL,
  failure_reason   text,
  retry_count      int         NOT NULL DEFAULT 0,
  call_id          uuid        REFERENCES public.calls(id) ON DELETE SET NULL,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS call_upload_jobs_device_created_idx
  ON public.call_upload_jobs(device_id, created_at DESC);

CREATE INDEX IF NOT EXISTS call_upload_jobs_fingerprint_idx
  ON public.call_upload_jobs(file_fingerprint)
  WHERE file_fingerprint IS NOT NULL;

-- updated_at 자동 갱신 (기존 set_updated_at 함수 재사용)
DROP TRIGGER IF EXISTS trg_call_upload_jobs_updated_at ON public.call_upload_jobs;
CREATE TRIGGER trg_call_upload_jobs_updated_at
  BEFORE UPDATE ON public.call_upload_jobs
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

COMMENT ON TABLE public.call_upload_jobs IS 'Android 업로드 에이전트 작업 이력 — 기기별 업로드 성공/실패/중복 추적';
COMMENT ON COLUMN public.call_upload_jobs.status IS 'queued | uploading | uploaded | duplicate | failed';
COMMENT ON COLUMN public.call_upload_jobs.device_id IS 'Android 앱 설정의 기기 식별자';
