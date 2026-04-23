# Call 상태 모델 (2026-04-17 기준)

## analysis_status (분석 상태)

| 값 | 의미 |
|----|------|
| `queued` | STT/분석 대기 중 |
| `pending` | 처리 시작 전 (레거시) |
| `processing` | STT 또는 분석 진행 중 |
| `completed` | 분석 완료 (STT + LLM) |
| `failed` | STT 또는 LLM 분석 실패 |
| `partial` | 핵심 필드만 저장됨 (스키마 불일치 등) |
| `warning` | 분석 완료, 보조 필드 저장 실패 |

> ⚠️ **핵심 원칙**: workflow 생성 실패는 `analysis_status`를 변경하지 않는다.
> workflow 실패 시 `analysis_status = completed`로 유지하고, `workflow_status = failed`에 기록한다.

## workflow_status (워크플로 상태, Migration 031 추가)

| 값 | 의미 |
|----|------|
| `not_started` | 기존 데이터 (031 마이그레이션 전) |
| `pending` | 워크플로 생성 대기 |
| `running` | 워크플로 생성 중 |
| `completed` | 워크플로 레코드 생성 완료 |
| `failed` | 워크플로 생성 실패 (analysis는 성공) |
| `skipped` | 해당 intent는 자동 라우팅하지 않음 |

## 정상 시나리오별 상태 조합

| 시나리오 | analysis_status | workflow_status |
|----------|----------------|----------------|
| 분석+워크플로 모두 성공 | `completed` | `completed` |
| 분석 성공, 라우팅 보류 intent (checkin_checkout 등) | `completed` | `skipped` |
| 분석 성공, 워크플로 생성 실패 | `completed` | `failed` |
| STT 실패 | `failed` | `not_started` / null |
| LLM 분석 실패 | `failed` | `not_started` / null |

## confidence 기반 review 정책 (lib/utils/reviewPolicy.ts)

| confidence | decision | 조치 |
|-----------|----------|------|
| ≥ 0.7 | `normal` | 자동 통과 |
| 0.3 ~ 0.69 | `needs_review` | 검수 대기열 |
| < 0.3 | `low_confidence` | 낮은 신뢰도 — 재분석 권고 |

## 관련 DB 컬럼 (calls 테이블)

```
analysis_status          TEXT     — 분석 파이프라인 상태
analysis_error_code      TEXT     — 분석 실패 코드 (stt_failed, llm_call_failed 등)
analysis_error_message   TEXT     — 분석 실패 메시지
analysis_confidence      NUMERIC  — LLM confidence (0~1)

workflow_status          TEXT     — 워크플로 생성 상태 (031 추가)
workflow_error_code      TEXT     — 워크플로 실패 코드
workflow_error_message   TEXT     — 워크플로 실패 메시지
workflow_attempts        INTEGER  — 워크플로 시도 횟수
workflow_last_attempt_at TIMESTAMPTZ
workflow_completed_at    TIMESTAMPTZ
```

## 재처리

workflow_status = 'failed' 또는 'not_started' 인 건은 다음 스크립트로 재처리:

```bash
# dry-run (대상만 확인)
node reprocess-workflow.js --dry-run

# 특정 배치 재처리
node reprocess-workflow.js --job <JOB_ID>

# 전체 최대 10건
node reprocess-workflow.js --limit 10
```

## operation_cases severity contract

- **Allowed**: `medium`, `high`
- **Forbidden**: `normal`
- **Default**: complaint / maintenance / payment → `medium`

## failure type별 recovery guide

See `docs/WORKFLOW_RECOVERY_GUIDE.md`.
