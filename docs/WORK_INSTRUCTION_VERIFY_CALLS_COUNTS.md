# 작업지시서 — calls 실패·대기 원인 집계 및 UI·DB 일치 검증

## 전제

- **`018` 마이그레이션( `analysis_error_code`, `pending`/`null` → `queued` )는 적용 완료로 간주**한다.
- 현재 스냅샷 예시: `analysis_status = failed` **73건**, `queued` **11건** (전체 `calls` 기준). 실제 건수는 검증 시점에 SQL로 재확인한다.

---

## 1. 목표

1. **`failed` / `queued` 각각에 대해 최근 50건**(`created_at desc` 기준)의 **실패 원인·대기 원인 분포**를 DB에서 집계한다.
2. **파일 검수 Step3·Step4**와 **`/calls?batch_id=…`**에 표시되는 숫자가 **동일 기준의 DB 집계**와 일치하는지 검증한다.

---

## 2. 집계 대상 정의

| 구분 | 조건 | “원인” 필드 |
|------|------|----------------|
| 실패 | `analysis_status = 'failed'` | `analysis_error_code`, `analysis_error_message` (보조: `stt_status`, `stt_error_message`) |
| 대기 | `analysis_status = 'queued'` | 주로 **아직 분석 파이프라인 미진입** — `stt_status`(`pending`/`processing`/`completed`/`failed`), `analysis_status` |

※ `queued`는 계약상 “분석 대기”; STT만 끝나고 분석 전이면 `stt_status = completed` + `analysis_status = queued` 조합이 나올 수 있다.

---

## 3. SQL — 실패 최근 50건 원인 분포

아래는 **`failed` 중 `created_at` 최신 50건**만 대상으로 코드·메시지를 묶는 예시다. (PostgreSQL / Supabase SQL Editor)

```sql
WITH last_failed AS (
  SELECT id, analysis_error_code, analysis_error_message, stt_status, created_at
  FROM public.calls
  WHERE analysis_status = 'failed'
  ORDER BY created_at DESC
  LIMIT 50
)
SELECT
  coalesce(nullif(trim(analysis_error_code), ''), '(no code)') AS error_code,
  left(coalesce(analysis_error_message, ''), 120) AS msg_sample,
  count(*)::int AS cnt
FROM last_failed
GROUP BY 1, 2
ORDER BY cnt DESC, 1, 2;
```

**상위 실패 유형만 보려면** (코드 단위):

```sql
WITH last_failed AS (
  SELECT analysis_error_code, analysis_error_message
  FROM public.calls
  WHERE analysis_status = 'failed'
  ORDER BY created_at DESC
  LIMIT 50
)
SELECT
  coalesce(nullif(trim(analysis_error_code), ''), '(no code)') AS error_code,
  count(*)::int AS cnt
FROM last_failed
GROUP BY 1
ORDER BY cnt DESC;
```

**보고 항목 예시**

- `error_code`별 건수 (합계 = 50 이하, 중복 메시지로 그룹 나뉘면 합계 50)
- `(no code)` 비율이 높으면 앱에서 `tryUpdateCallAnalysisFailed`에 `code` 미전달 경로 점검

---

## 4. SQL — 대기(queued) 최근 50건 “대기 원인” 분포

`queued`는 **STT·분석 단계**에 따라 원인이 갈린다.

```sql
WITH last_queued AS (
  SELECT id, stt_status, analysis_status, stt_error_message, created_at
  FROM public.calls
  WHERE analysis_status = 'queued'
  ORDER BY created_at DESC
  LIMIT 50
)
SELECT
  coalesce(stt_status::text, '(null)') AS stt_status,
  count(*)::int AS cnt
FROM last_queued
GROUP BY 1
ORDER BY cnt DESC;
```

**메시지가 있는 경우** (STT 실패인데 analysis가 아직 `queued`인 레거시 등):

```sql
WITH last_queued AS (
  SELECT stt_status, stt_error_message
  FROM public.calls
  WHERE analysis_status = 'queued'
  ORDER BY created_at DESC
  LIMIT 50
)
SELECT
  coalesce(stt_status::text, '(null)') AS stt_status,
  left(coalesce(stt_error_message, ''), 80) AS stt_err_sample,
  count(*)::int AS cnt
FROM last_queued
GROUP BY 1, 2
ORDER BY cnt DESC;
```

**보고 항목 예시**

- `stt_status = pending` 다수 → 업로드 후 STT 미실행·백로그
- `stt_status = failed` + `analysis_status = queued` → 파이프라인/상태 불일치 가능, 별도 이슈

---

## 5. 전체 건수 스냅샷 (검증 시 필수)

```sql
SELECT analysis_status, count(*) AS cnt
FROM public.calls
GROUP BY analysis_status
ORDER BY cnt DESC;
```

`failed = 73`, `queued = 11` 등 **문서/대시보드에 적을 숫자**는 이 쿼리 결과를 기준으로 한다.

---

## 6. Step3·Step4·`/calls` 숫자의 DB 정의 (일치 검증용)

검증은 **반드시 특정 `batch_job_id` 하나**를 잡고 수행한다 (파일 검수 직후 생성된 UUID).

### 6.1 Step3 요약 카드 (`GET /api/batch-test/jobs/:id` 응답의 `outcome`)

| UI 필드 | DB/코드 출처 |
|---------|----------------|
| `selected_count` | `batch_jobs.total_count` |
| `completed_count` | `batch_jobs.processed_count` |
| `success_count` | `batch_jobs.success_count` (파이프라인 성공 판정) |
| `failed_count` | `batch_jobs.failed_count` |
| `pending_count` | `max(0, total_count - processed_count)` |
| `call_failed_count` | `calls` where `batch_job_id = :id` AND `analysis_status = 'failed'` |
| `call_pending_count` | `calls` where `batch_job_id = :id` AND `analysis_status IN ('queued','pending','processing')` |
| `label_ready_count` | `calls` where `batch_job_id = :id` AND `analysis_status IN ('completed','partial','warning')` |

**검증 SQL (배치 단위)**

```sql
-- :batch_id 에 바꿔 넣기
SELECT
  count(*) FILTER (WHERE analysis_status = 'failed') AS call_failed,
  count(*) FILTER (WHERE analysis_status IN ('queued','pending','processing')) AS call_pending,
  count(*) FILTER (WHERE analysis_status IN ('completed','partial','warning')) AS label_ready
FROM public.calls
WHERE batch_job_id = '00000000-0000-0000-0000-000000000000';
```

API의 `outcome`과 위 세 숫자가 **같아야** 한다 (폴백 경로 제외).

### 6.2 Step4 카드 A/B/C/D

| 카드 | 의미 | `/calls` 쿼리스트링 |
|------|------|---------------------|
| A | 라벨링 가능 | `?batch_id=…&analysis_usable=1` |
| B | 분석 실패 | `?batch_id=…&analysis_status=failed` |
| C | 미처리(대기·진행) | `?batch_id=…&analysis_pending=1` |
| D | 제외 파일 수 | 파일 검수 DB (`review_file_state`) — `calls`와 직접 비교하지 않음 |

**B 검증:** Step4에 표시된 B 숫자 = 위 SQL `call_failed` (동일 `batch_job_id`).

**C 검증:** UI 숫자 = `call_pending` (동일 기준).

### 6.3 `/calls` 목록 건수

- 필터 적용 후 **“일치 N건”**은 `lib/db/callDataViewer.ts`의 메모리 필터 결과와 같다.
- **페이지네이션:** 한 페이지에 최대 `pageSize`만 표시되므로, **총건 비교**는 UI의 “일치 N건”과 DB count를 맞춘다.

```sql
-- 실패만, 해당 배치
SELECT count(*) FROM public.calls
WHERE batch_job_id = :batch_id AND analysis_status = 'failed';
```

`analysis_pending=1` URL일 때:

```sql
SELECT count(*) FROM public.calls
WHERE batch_job_id = :batch_id
  AND analysis_status IN ('queued','pending','processing');
```

---

## 7. 검증 절차 (체크리스트)

1. [ ] **5절** 전체 `analysis_status` 분포를 기록한다.
2. [ ] **3절·4절**로 `failed`/`queued` 각 **최근 50건** 원인 분포를 저장한다 (스프레드시트 또는 이슈 코멘트).
3. [ ] 파일 검수로 **새 배치 1건** 실행 후 `batch_job_id`를 복사한다.
4. [ ] 브라우저 **Step3** `outcome` 스크린샷 또는 JSON과 **6.1 SQL** 결과를 비교한다.
5. [ ] **Step4** A/B/C 숫자와 **6.2 SQL** 결과를 비교한다.
6. [ ] **`/calls?batch_id=…&analysis_status=failed`** 총건 = **6.3** `failed` count.
7. [ ] **`/calls?batch_id=…&analysis_pending=1`** 총건 = **6.3** `pending` 계열 count.

**불일치 시 확인할 것**

- `calls.batch_job_id`가 null인 행이 배치에 섞였는지
- `018` 미적용 DB에 `pending`이 남았는지
- 구형 클라이언트 캐시가 아닌지 (하드 리프레시)

---

## 8. 산출물

- **실패/대기 원인 분포표** (최근 50건 기준, 집계일 명시)
- **배치 1건에 대한 Step3·Step4·/calls vs SQL 대조표**
- 불일치 0건 또는 **이슈 티켓 링크**

---

## 9. 참고 코드 위치

- 배치 outcome: `lib/batch-test/reviewOutcome.ts` — `getBatchJobReviewOutcome`
- Step3 폴링: `components/review/ReviewFileFlow.tsx` — `GET /api/batch-test/jobs/:id`
- 통화 목록 필터: `lib/db/callDataViewer.ts` — `analysis_usable`, `analysis_pending`, `batch_id`

---

## 10. 완료 기준

- [ ] `failed` / `queued` 최근 50건 원인 집계가 문서화됨
- [ ] 선택한 `batch_job_id`에 대해 Step3·Step4·`/calls` 숫자가 **SQL과 일치**함을 확인했거나, 불일치 시 원인이 기록됨
