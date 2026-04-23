-- ============================================================
-- 032_intent_taxonomy_backfill.sql
-- 구 intent 값을 신규 taxonomy로 일괄 마이그레이션
--
-- 매핑 규칙:
--   extension_request     → checkin_checkout  (체크인/아웃/연장 통합)
--   rate_inquiry          → reservation_inquiry
--   quotation_intent      → reservation_inquiry
--   service_request       → other             (비품요청: 자동 라우팅 보류)
--   manual_review_required → other
-- ============================================================

UPDATE public.calls
  SET primary_intent = 'checkin_checkout'
  WHERE primary_intent = 'extension_request';

UPDATE public.calls
  SET primary_intent = 'reservation_inquiry'
  WHERE primary_intent IN ('rate_inquiry', 'quotation_intent');

UPDATE public.calls
  SET primary_intent = 'other'
  WHERE primary_intent IN ('service_request', 'manual_review_required');
