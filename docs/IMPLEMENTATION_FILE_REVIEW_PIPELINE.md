# Implementation Request — 파일 검수 → 분석 → DB → 배치 조회 → 라벨링

## 1. 목표

`uploads/calls` 오디오를 선택·배치 실행하면 **통화(`calls`) row가 항상 생성**되고, **성공/실패가 DB에 기록**되며, **`batch_job_id`로 `/calls`에서 조회**·라벨링까지 끊기지 않게 한다.

---

## 2. 사용자 시나리오 (완료 기준)

1. `uploads/calls`에 오디오를 둔다.
2. **파일 검수**(`/file-review`) Step1에서 목록이 보인다.
3. 선택 후 Step3 분석 실행 → `batch_jobs` + `batch_job_items` + `calls` row 생성.
4. `analysis_status`가 `completed` / `failed` / `partial` / `warning` / `skipped`(짧은 통화) 등으로 저장되고, 실패 시 `analysis_error_message`(및 가능 시 `analysis_error_code`)가 남는다.
5. 모든 배치 생성 통화에 `calls.batch_job_id`가 채워진다.
6. Step3·Step4 요약이 **DB 집계**와 일치한다.
7. `/calls?batch_id=…`로 해당 배치만 조회·실패 사유 확인이 가능하다.

→ 이 시나리오가 끝까지 동작해야 완료

---

## 3. 수정 범위 (코드)

| 영역 | 파일 |
|------|------|
| 마이그레이션 | `supabase/migrations/018_calls_analysis_status_queued_and_error_codes.sql` |
| DB·파이프라인 | `lib/db/calls.ts`, `lib/pipeline/runAnalysisForCall.ts`, `lib/pipeline/runSttForCall.ts`, `lib/batch-test/processFixture.ts` |
| 집계·폴백 | `lib/batch-test/reviewOutcome.ts`, `lib/db/callDataViewer.ts`, `lib/db/review.ts` |
| API | `app/api/review/run`, `app/api/review/summary` (기존 + column fallback) |
| UI 라우트 | `app/file-review/page.tsx`, `app/review/page.tsx` → `/file-review` 리다이렉트 |
| 네비 | `components/Nav.tsx` |
| 타입 | `lib/types/database.ts` (`AnalysisStatus`에 `queued`) |

---

## 4. DB 스키마 변경

### `public.calls`

| 컬럼 | 타입 | 비고 |
|------|------|------|
| `analysis_status` | text | 기본값 `queued` (레거시 `pending` → 마이그레이션에서 `queued`로 통일) |
| `analysis_error_code` | text null | 없으면 마이그레이션에서 추가 |
| `batch_job_id` | uuid null | `017` 등 기존 마이그레이션과 함께 |
| `source_file_name` | text null | 동일 |

### `public.batch_jobs`

- `id` uuid PK, `name` text null (기존 `005` 등과 동일)

---

## 5. 데이터 흐름

**파일 선택 → `POST /api/review/run` → `batch_jobs` 생성 → 워커가 파일별 `processBatchFixture` → `createCallRecord`(batch·source_file_name) → STT → 분석 → `calls` 상태 갱신 → `GET /api/batch-test/jobs/:id`·`reviewOutcome` 집계 → `/calls?batch_id=` 조회**

---

## 6. 상태 정의 (`analysis_status`)

계약값: `queued`, `processing`, `completed`, `failed`, `partial`, `warning`  
(레거시·특수: `pending`, `skipped` — DB/기존 행 호환)

- 신규 생성: `queued` (`createCallRecord`)
- STT 실패: `failed` + 메시지 + `stt_failed` 코드
- 분석 실패: `failed` + 메시지 + 코드(예: `no_transcript`, `analysis_exception`)

---

## 7. 실패 처리 규칙

- 파이프라인 **전체 throw로 중단하지 않음** (워커·`processFixture`는 행 단위 반환).
- STT/분석 실패 시 **`analysis_status = failed`**, **`analysis_error_message`** 필수.
- `tryUpdateCallAnalysisFailed`는 컬럼 누락 시 **코드 없이 재시도**.

---

## 8. batch 연결 규칙

- 검수 실행 시 `insertBatchJob` + `batch_job_id`를 `createCallRecord`에 전달.
- **기본 경로**: `calls.batch_job_id`가 최우선.
- 없을 때만 `batch_job_items` 매핑(조회 폴백).

---

## 9. fallback 규칙

- `source_file_name` / `batch_job_id` 컬럼 없음 → `lib/supabase/columnError` + 요약·목록 API에서 **500 금지**, `console.warn`.
- 상세: `app/api/review/summary`, `lib/db/callDataViewer.ts`, `lib/batch-test/reviewOutcome.ts`.

---

## 10. 검증 방법

### SQL

```sql
select id, batch_job_id, analysis_status, analysis_error_code, analysis_error_message
from public.calls
order by created_at desc
limit 10;
```

- row 존재, `batch_job_id` 채움, `analysis_status` 계약 범위, 실패 시 메시지 존재.

### UI

- `/file-review` Step3·4 숫자와 `/calls?batch_id=…` 건수 일치(집계 기준 동일).
- 실패 행에 사유 표시(`CallDataList`).

---

## 11. 구현 순서 (ops-contract)

1. DB migration (`018` …)  
2. API·pipeline (`calls.ts`, `runSttForCall`, `runAnalysisForCall`, `processFixture`)  
3. 집계·조회 (`reviewOutcome`, `callDataViewer`, `review.ts`)  
4. UI 라우트 (`/file-review`, 리다이렉트)  
5. 본 문서·검증 쿼리

---

## 12. 완료 기준 체크리스트

- [ ] 분석 실패해도 `calls` row 유지·`failed` 기록  
- [ ] STT 실패 시 `failed` + STT 메시지  
- [ ] 신규 행 `analysis_status` 기본 `queued`  
- [ ] 배치 필터·요약이 DB와 맞음  
- [ ] 컬럼 없을 때 API 500 없음  
