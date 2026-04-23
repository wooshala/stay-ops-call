# Implementation Request

## 1. 목표
파일 검수 파이프라인을 `calls` 단일 소스로 통합해 Step3/Step4/`/calls` 숫자를 항상 동일하게 만든다.

---

## 2. 사용자 시나리오 (완료 기준)

1. 파일 5건 선택 후 Step3 실행
2. 배치 생성 직후 `calls`에 5건이 `queued`로 생성
3. 각 call이 STT/분석 처리 후 `completed` 또는 `failed`로 저장
4. Step3/Step4/`/calls?batch_id=...`가 동일 집계를 표시

→ 이 시나리오가 끝까지 동작해야 완료

---

## 3. 수정 범위 (코드)

- `app/api/review/run/route.ts`
- `lib/batch-test/runBatchJobWorker.ts`
- `app/api/batch-test/jobs/[id]/route.ts`
- `app/api/calls/route.ts`
- `lib/db/calls.ts`
- `lib/db/batchJobs.ts`
- `lib/db/batchCallStats.ts` (신규)
- `lib/db/callDataViewer.ts`
- `components/review/ReviewFileFlow.tsx`

---

## 4. DB 스키마 변경

### 없음

- 기존 `calls.batch_job_id`, `source_file_name`, `analysis_status`, `analysis_error_message`, `analysis_error_code` 사용
- 스키마 변경 없음

---

## 5. 데이터 흐름

파일 선택 → `batch_jobs` 1건 생성 → 파일 수만큼 `calls` 선생성(`queued`) → call별 STT/분석 실행 → `calls`를 `completed`/`failed` 갱신 → UI는 `/api/calls?batch_id=...` 재조회

---

## 6. 상태 정의

- `queued`: 배치 생성 직후, 아직 처리 전
- `completed`: STT+분석(+workflow) 성공
- `failed`: 처리 실패, `analysis_error_message` 저장

---

## 7. 실패 처리 규칙

- 실패 판단: 경로 해석 실패, 업로드 실패, STT 실패, 분석 실패, 워크플로 실패, 예외 발생
- DB 기록: `markCallFailed(callId, code, message)`로
  - `analysis_status='failed'`
  - `analysis_error_code=code`
  - `analysis_error_message=message`

---

## 8. batch 연결 규칙

- 파일 검수 경로는 `createCallForBatch({ batch_job_id, source_file_name })`만 사용
- `batch_job_id`, `source_file_name` 없는 insert 금지

---

## 9. fallback 규칙

- `/api/calls?batch_id=...` 조회 실패 시 `{ rows: [], stats: 0, failureTop: [] }` 반환
- UI는 빈 데이터 렌더링으로 깨지지 않음

---

## 10. 검증 방법

### SQL

```sql
select
  id,
  batch_job_id,
  analysis_status,
  analysis_error_message
from calls
order by created_at desc
limit 5;
```
