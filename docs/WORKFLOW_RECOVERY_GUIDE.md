# Failure recovery guide (ops)

## operation_cases severity contract

- **Allowed values**: `medium`, `high`
- **Forbidden**: `normal` (do not emit / do not persist)
- **Default**: complaint / maintenance / payment → `medium`

This contract is enforced in code before DB upsert.

## analysis_status / workflow_status 의미 (요약)

See `docs/CALL_STATUS_MODEL.md` for the canonical table.

- `analysis_status`는 STT/LLM/DB 저장까지 포함한 **분석 파이프라인 상태**
- `workflow_status`는 analysis 결과를 기반으로 operation/service/lead 테이블에 upsert 하는 **업무 레코드 생성 상태**

## Failure type별 recovery 전략

### 1) workflow constraint 실패 (예: enum/check/NOT NULL)

- **증상**
  - `analysis_status = completed`
  - `workflow_status = failed`
  - `workflow_error_code = workflow_failed`
  - 서버 로그/에러에 `23514`(check), `23502`(not null), `22P02`(invalid enum/uuid) 등 DB 제약 위반이 포함

- **재처리**
  - **workflow-only 재처리**: `POST /api/calls/<CALL_ID>/workflow`
  - 분석(LLM) 재실행 없이 workflow upsert만 다시 시도한다.

HTTP로 직접 호출할 때는 `INTERNAL_API_TOKEN`이 설정된 환경에서는 `Authorization: Bearer <token>`이 필요합니다. 자세한 정책은 `docs/OPS_QUEUE_SECURITY.md`를 참고하세요.

### 2) analysis DB write 실패 (예: `analysis_db_write_failed` + ECONNRESET)

- **증상**
  - `analysis_error_code = analysis_db_write_failed`
  - 오류 메시지에 `ECONNRESET` / `fetch failed`가 포함될 수 있음
  - 최종 실패 시 `analysis_status`는 **재처리 가능 상태로 `queued`에 남는다**

- **재처리**
  - **analyze 재처리**: `POST /api/calls/<CALL_ID>/analyze`
  - 분석 + 저장 + (가능하면) workflow까지 다시 수행한다.

위 analyze 엔드포인트도 동일하게 Bearer 인증이 적용될 수 있습니다 (`docs/OPS_QUEUE_SECURITY.md`).

