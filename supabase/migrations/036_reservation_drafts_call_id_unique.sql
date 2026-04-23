-- call_id 당 draft 1건 (null call_id 는 여러 건 허용)

DELETE FROM public.reservation_drafts a
WHERE a.call_id IS NOT NULL
  AND a.id NOT IN (
    SELECT id FROM (
      SELECT DISTINCT ON (call_id) id
      FROM public.reservation_drafts
      WHERE call_id IS NOT NULL
      ORDER BY call_id, created_at ASC, id ASC
    ) k
  );

CREATE UNIQUE INDEX IF NOT EXISTS idx_reservation_drafts_call_id_unique
  ON public.reservation_drafts (call_id)
  WHERE call_id IS NOT NULL;

COMMENT ON INDEX public.idx_reservation_drafts_call_id_unique IS
  '동일 통화에 대해 draft 중복 방지 (승인/무시 후에도 재생성 안 함)';
