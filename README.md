# Stay-Ops-Call

숙박 운영 통화 녹음을 업로드하면, 서버에서 **STT → LLM 분석(요약·분류·엔티티·추천 액션) → 업무 레코드 자동 생성**까지 한 번에 처리하는 MVP입니다. Next.js(App Router) API Route + Supabase(Postgres + Storage)이며, 기본 STT는 **OpenAI Audio Transcriptions**이고, **`STT_PROVIDER=mock`**으로 샘플 텍스트만 쓰는 테스트도 가능합니다.

## 필요 환경

- Node.js 20+ 권장
- Supabase 프로젝트(Postgres + Storage)

## 환경 변수 (`.env.local`)

로컬 개발 시 프로젝트 루트에 **`.env.local`** 파일을 만들고 아래를 설정합니다. (Git에 커밋하지 마세요.)

| 변수 | 필수 | 설명 |
|------|------|------|
| `NEXT_PUBLIC_SUPABASE_URL` | ✅ | Supabase 프로젝트 URL (`Settings` → `API` → Project URL) |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | ✅ | Supabase **anon public** 키 |
| `SUPABASE_SERVICE_ROLE_KEY` | ✅ | Supabase **service_role** 키. **서버 전용**. DB·Storage 업로드에 사용. 유출 금지. |
| `SUPABASE_RECORDINGS_BUCKET` | ❌ | 녹음 Storage 버킷 이름. 기본값: `recordings` |
| `STT_PROVIDER` | ❌ | `openai`(기본) 또는 `mock`(오디오 없이 샘플 STT) |
| `OPENAI_API_KEY` | OpenAI STT 시 ✅ | [OpenAI API 키](https://platform.openai.com/api-keys). `STT_PROVIDER=openai`일 때 필수 |
| `OPENAI_STT_MODEL` | ❌ | 기본 `gpt-4o-mini-transcribe`. 필요 시 `gpt-4o-transcribe` 등으로 변경 |
| `LLM_PROVIDER` | ❌ | `mock`(기본). 추후 실제 LLM 연동 시 변경 |
| `BATCH_TEST_FIXTURES_DIR` | ❌ | 배치 테스트용 오디오 디렉터리. 미설정 시 프로젝트 루트 `batch-test/fixtures` |

**최소 예시 (OpenAI STT 사용):**

```env
NEXT_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
SUPABASE_RECORDINGS_BUCKET=recordings
STT_PROVIDER=openai
OPENAI_API_KEY=sk-...
OPENAI_STT_MODEL=gpt-4o-mini-transcribe
LLM_PROVIDER=mock
```

### OpenAI STT 설정

1. OpenAI 대시보드에서 **API 키**를 발급하고 `OPENAI_API_KEY`에 넣는다.
2. `STT_PROVIDER=openai`(기본값)를 유지한다.
3. 업로드 시 **실제 오디오 파일**(예: `.m4a`)을 보낸다. 서버가 Supabase Storage에 저장한 뒤, 해당 객체를 내려받아 **`audio/transcriptions`** API(`OPENAI_STT_MODEL`)로 전송하고 `transcript_text`에 저장한다.
4. `stt_confidence`는 OpenAI 전사 응답에 세션 신뢰도가 없어 **null**로 둔다(스키마 nullable).
5. 녹음 없이 mock 샘플만 쓰려면 `STT_PROVIDER=mock`으로 바꾼다(이때는 Storage에 파일이 없어도 샘플 문구가 나온다).

참고: `.env.example`에도 동일 키 이름으로 적어 두었습니다.

### 배치 테스트 (검증용, `/batch-test`)

운영 기능이 아니라 **여러 통화 파일을 순차로 STT → 분석 → 워크플로까지 돌려 패턴 실패를 찾기 위한 도구**입니다. 대용량·장시간 STT에 대비해 **job + 폴링** 구조입니다(한 번의 HTTP로 전체를 끝내지 않음).

1. `batch-test/fixtures/`에 `.mp3`, `.wav`, `.m4a` 등 오디오 파일을 넣는다. Git에는 기본적으로 올라가지 않는다.
2. 브라우저에서 **`/batch-test`** → 목록 새로고침 → 파일 선택 → **job 생성 후 실행**.
3. `POST /api/batch-test/run`이 `job_id`만 즉시 반환하고, `POST /api/batch-test/jobs/[id]/start`가 백그라운드에서 순차 처리한다. UI는 `GET /api/batch-test/jobs/[id]`를 **약 2.5초마다** 폴링해 진행률·요약·항목을 갱신한다.
4. 결과 표에서 `stt_status`, `analysis_status`, `primary_intent`, `room_no`, `workflow_type` 등을 확인한다(트랜스크립트는 API에 넣지 않음, 통화 상세에서 확인).
5. **Supabase에 `005_create_batch_jobs.sql`을 적용**해 `batch_jobs`, `batch_job_items` 테이블이 있어야 한다.
6. `BATCH_TEST_FIXTURES_DIR`로 다른 디렉터리를 지정할 수 있다(절대 경로 또는 프로젝트 루트 기준 상대 경로).

## 데이터베이스 마이그레이션

**순서대로** Supabase SQL Editor에서 실행합니다.

1. `supabase/migrations/001_create_calls.sql` — 코어 통화·엔티티·추천·전화번호 테이블 및 `set_updated_at()` 함수
2. `supabase/migrations/002_create_workflow_tables.sql` — 운영 연동용 `operation_cases`, `service_requests`, `reservation_leads` 및 트리거
3. `supabase/migrations/003_patch_workflow_tables.sql` — **권장**: 3개 workflow 테이블을 한 번에 생성·보강(`CREATE IF NOT EXISTS` + `ADD COLUMN IF NOT EXISTS`). 끝에 `NOTIFY pgrst, 'reload schema'` 로 API 스키마 캐시 갱신. `service_requests` 등이 없다는 오류 시 이 파일 전체를 SQL Editor에서 실행.
4. `supabase/migrations/004_actionable_secondary_intents.sql` — `calls.actionable_secondary_intents` (jsonb, nullable): 복합 의도 참고용 배열; **워크플로는 여전히 `primary_intent`만** 사용.
5. `supabase/migrations/005_create_batch_jobs.sql` — 배치 테스트용 `batch_jobs`, `batch_job_items` (진행 상태·항목별 결과 저장, 폴링용).
6. `supabase/migrations/006_transcript_analysis_input.sql` — `calls.transcript_cleaned`, `calls.analysis_input_text` (반복 제거 STT·실제 분석 입력 텍스트 저장).
7. `supabase/migrations/007_call_entities_payment_fields.sql` — `call_entities`에 `amount`, `payment_method`, `payment_deposit`, `group_booking` (결제·단체 메타).
8. `supabase/migrations/008_quote_draft_and_quotation_entities.sql` — `calls.quote_draft`, `call_entities.room_count` / `deposit_amount` / `parking_count` (견적 초안·견적 엔티티).

그다음 **Storage**에서 버킷 `recordings`(또는 `SUPABASE_RECORDINGS_BUCKET` 값)를 생성합니다.

### Workflow 테이블 역할 (002)

| 테이블 | 용도 |
|--------|------|
| `operation_cases` | `maintenance`·`complaint` 모두 수용 (`case_type`으로 구분, `call_id` unique) |
| `service_requests` | `service_request` 비품/배달 요청 (`call_id` unique) |
| `reservation_leads` | `reservation_inquiry`, `rate_inquiry`, `extension_request` 리드 (`call_id` unique) |

`complaint`는 별도 `cs_cases` 없이 **`operation_cases`**에 `case_type='complaint'`로 저장합니다. `other` 등만 업무 레코드 없이 둘 수 있습니다.

#### primary_intent → workflow 매핑

| `primary_intent` | 생성 테이블 |
|------------------|-------------|
| `maintenance` | `operation_cases` (`case_type` = maintenance) |
| `complaint` | `operation_cases` (`case_type` = complaint) |
| `payment` | `operation_cases` (`case_type` = payment) |
| `service_request` | `service_requests` |
| `reservation_inquiry`, `rate_inquiry`, `extension_request`, `quotation_intent` | `reservation_leads` |
| `manual_review_required` | 업무 레코드 없음 (수동 검토 큐) |

구현: `lib/workflows/rules.ts`의 `shouldCreateWorkflowForIntent` · `buildComplaintCase` / `buildMaintenanceCase` / `buildPaymentCase`.

#### 결제·카드번호 전처리

- **`calls.transcript_text`**는 STT 원본 그대로 두고, 분석 직전에만 **`lib/transcript/mask.ts`**로 마스킹합니다.
- **전화번호 형태**는 `[PHONE]`으로 치환해 금액·카드와 구분합니다.
- **4자리×4 그룹 카드 형태** 또는 **긴 연속 숫자열**은 `**** **** **** ****` 또는 `****`로 치환합니다.
- 그다음 **`lib/transcript/preprocess.ts`**에서 반복 제거·(긴 통화 시) 키워드 축약을 적용합니다.
- **분석 실패 시** 짧은 분석 입력 대신 **마스킹만 적용한 전체 cleaned 텍스트**로 `analyzeCall`을 **한 번 더** 시도합니다. 그래도 실패하면 `primary_intent = manual_review_required`로 저장하고(요약에 사유 포함), `analysis_status`는 **completed**로 두어 수동 검토 대기로 표시합니다.
- **키워드 휴리스틱**: `결제`, `카드`, `계약금`, `입금`, `할부`, `영수증`, `계좌` 등이 있으면 `payment` 의도를 우선 검토합니다(`lib/analysis/heuristics.ts`).
- **견적·단체(`quotation_intent`)**: `단체`, `견적`, `패키지`, `행사`, `워크숍`, `객실 수`, `주차` 등이 있으면 일반 `reservation_inquiry` 대신 **`quotation_intent`**로 보정할 수 있습니다. 별도 **`quotation_extraction`** 휴리스틱(`lib/quotation/extract.ts`)이 **날짜·객실 수·금액·결제·예약금·인원·주차**를 `extractionInput`(키워드 문장 우선)에서 먼저 추출하고, LLM `entities`와 병합한 뒤 **`buildQuoteDraftFromExtracted`**로 `calls.quote_draft`에 견적서 초안 텍스트를 저장합니다.

분석 JSON에는 `secondary_tags`(자유 태그)와 별도로 **`actionable_secondary_intents`**(`PrimaryIntent` 배열 또는 `null`)가 올 수 있습니다. 예: primary가 `complaint`인데 연장 문의 성격이 있으면 `["extension_request"]`. 이번 단계에서는 **저장·상세 UI 표시만** 하며, 추가 워크플로 행은 생성하지 않습니다.

#### 긴 통화 STT 전처리

STT 원본은 **`calls.transcript_text`**에만 보관하고, 분석에는 **`lib/transcript/preprocess.ts`**의 결과를 씁니다.

1. **반복 제거** — 연속 동일 문단 제거, 유사 문장은 첫 번만 유지 → `transcript_cleaned`
2. **민감 숫자 마스킹·숫자 노이즈 완화** — 분석 입력 문자열만 처리(원본 `transcript_text` 불변)
3. **길이 가드** — 위 처리 후 텍스트가 매우 길면 예약·가격·객실·결제·접근성 등 키워드가 있는 문장 위주로 잘라 **`analysis_input_text`**에 저장하고, LLM·휴리스틱·`room_no` fallback에는 이 값을 우선 사용합니다.

#### `room_no` 보강 (transcript 정규식)

LLM이 `entities.room_no`를 비워도, **`runAnalysisForCall`**에서 분석에 쓴 텍스트·hint로 보강해 `call_entities.room_no`에 저장합니다. 워크플로 생성(`build*`) 시에도 동일한 우선순위(`resolveRoomNo`)를 씁니다.

| 순위 | 출처 |
|------|------|
| 1 | LLM `entities.room_no` |
| 2 | 분석 입력 텍스트 정규식 추출 (`analysis_input_text` → 없으면 `transcript_cleaned` → `transcript_text`, `lib/utils/roomNo.ts`) |
| 3 | `calls.room_no_hint` |

**오추출 방지 규칙 (요약):**

- **`숫자+호`** 패턴을 최우선으로 인정합니다.
- **`7926번`·`1234번`처럼 4자리+번**은 객실로 보지 않습니다(전화 뒷자리 등).
- **`숫자+번` 경로는 3자리(001–999)+번**만 허용하며, **「제 번호」「번호 떴」「전화번호」「뒷자리」** 등 전화·번호 확인 문맥이면 제외합니다.
- **하이픈으로 이어진 전화 형식** 근처는 제외합니다.
- **3~4자리 숫자만** 있는 경우는 4자리(특히 연도 1900–2099)는 건너뜁니다.

분석 단계에서 **`primary_intent`가 `other`로 나오는 경우**, 예약·내일·몇 시·방·가격 등 신호가 겹치면 **`lib/analysis/heuristics.ts`**에서 `reservation_inquiry`로 보정할 수 있습니다. 휠체어·접근성 문의는 **`secondary_tags`에 `accessibility_inquiry`**를 붙일 수 있습니다.

#### complaint 샘플( mock 분석 )

- Transcript 예: `청소팀이 카드키를 잘못 눌러서 고객이 놀랐어요`
- 기대: `primary_intent = complaint`, `operation_cases` 행 생성, `case_type = complaint`, `title = 객실미상 컴플레인`(또는 `room_no` 있으면 `{room_no} 컴플레인`), `secondary_tags`에 `urgent_issue` 있으면 `severity = high`.

## 자동 처리 플로우

**`POST /api/calls/upload`** 성공 시 서버가 **동일 요청 안에서** 순차 실행합니다.

1. `calls` 행 생성 + (파일 있으면) Storage 업로드 + `phone_contacts` 누적(외부/스마트콜)
2. **`runSttForCall`** — STT(기본 OpenAI, `STT_PROVIDER=mock` 시 샘플)
3. **`runAnalysisForCall`** — 반복 제거 → 카드/전화 마스킹 → (필요 시) 분석용 축약 → `transcript_cleaned` / `analysis_input_text` 저장 후 분석(실패 시 cleaned 풀텍스트 1회 재시도, 최종 실패 시 `manual_review_required`) + `call_entities` + `action_recommendations` + 분석 요약 반영 + 전화 DB last_* 갱신
4. **`createWorkflowFromCall`** — `primary_intent`에 따라 위 workflow 테이블 중 하나에 **upsert** (`call_id` unique로 중복 방지)

실패 시 **앞 단계 결과는 유지**합니다.

| 단계 실패 | HTTP | `calls` | 비고 |
|-----------|------|---------|------|
| Storage/DB insert (업로드 자체) | 5xx/4xx | 생성 안 됨 | 전체 실패 |
| STT | 200 | 유지 | `stt_status=failed`, 응답 `error_stage: "stt"` |
| 분석 | 200 | 유지 | `analysis_status=failed`, `error_stage: "analysis"` |
| Workflow | 200 | 분석까지 유지 | `error_stage: "workflow"`, `workflow_error` |

### 업로드 응답 예시

성공(전 구간):

```json
{
  "call": { "...": "..." },
  "stt": { "transcript": "...", "confidence": null, "provider": "openai" },
  "analysis": { "summary": "...", "primary_intent": "maintenance", "...": "..." },
  "workflow": { "createdType": "operation_case", "createdId": "uuid" }
}
```

`other`처럼 workflow를 만들지 않는 intent:

```json
"workflow": { "createdType": null, "createdId": null }
```

### Worker/큐로 분리할 때

이미 다음 **함수 경계**로 나뉘어 있어, 이후 백그라운드 job에서 그대로 호출하면 됩니다.

- `lib/pipeline/runSttForCall.ts` — STT만
- `lib/pipeline/runAnalysisForCall.ts` — 분석·엔티티·추천·phone 갱신만
- `lib/workflows/createWorkflowFromCall.ts` — 분석 결과 기준 업무 레코드 upsert만

업로드 API에서는 현재 이 셋을 **순서대로 await**하고 있으며, 나중에는 업로드는 `calls` 생성까지만 하고 메시지 큐에 `call_id`를 넣는 방식으로 바꾸면 됩니다.

## 실행 방법

```bash
npm install
npm run dev
```

[http://localhost:3000](http://localhost:3000) → **업로드**에서 등록하면 **상세 페이지로 이동할 때 이미 STT·분석·업무 레코드가 채워진 상태**를 기대합니다.

```bash
npm run build
npm start
```

## 업로드 → 자동 완료 (짧은 5단계 점검)

1. **`.env.local`** 설정 후 `npm run dev`
2. SQL Editor에서 **001 → 002** 마이그레이션 실행, Storage **`recordings`** 버킷 생성
3. **`/upload`**에서 방향·출처 등 필수 값 입력 (선택: **Mock STT 샘플 인덱스** `0`~`4`로 한국어 시나리오 고정)
4. 저장 후 이동한 **통화 상세**에서 Transcript·요약·**생성된 업무 레코드** 섹션 확인
5. 외부/스마트콜이면 **`/phone-contacts`**에서 번호·last_intent 확인

수동 재실행이 필요하면 상세의 **「수동 재실행 (디버그)」** 또는 `POST /api/calls/[id]/process-stt`, `POST /api/calls/[id]/analyze`를 사용합니다.

## 테스트 중 에러 시 확인 체크리스트

### 공통

- [ ] **`.env.local`** 키 오타·누락 없음, **`SUPABASE_SERVICE_ROLE_KEY`** 사용
- [ ] Network 응답 JSON의 **`error`**, **`error_stage`**, **`workflow_error`** 확인

### 업로드 (`POST /api/calls/upload`)

- [ ] **001·002 마이그레이션** 모두 적용됨 (`operation_cases` 등 테이블 존재)
- [ ] Storage 버킷 이름·정책·용량 제한

### STT 단계 (`error_stage: "stt"`)

- [ ] `stt_error_message`, `stt_status=failed` on `calls`
- [ ] **OpenAI STT**: `OPENAI_API_KEY` 설정, 할당량/결제, 모델명(`OPENAI_STT_MODEL`) 지원 여부
- [ ] **OpenAI STT**: 녹음 파일이 실제로 Storage에 올라갔는지(`recording_path` 존재). 파일 없이 mock 경로만 쓰면 `STT_PROVIDER=mock` 필요

### 분석 단계 (`error_stage: "analysis"`)

- [ ] `analysis_error_message`, `LLM_PROVIDER=mock`일 때 Zod 메시지

### Workflow 단계 (`error_stage: "workflow"`)

- [ ] **002 마이그레이션** 적용 여부 (테이블 없으면 upsert 실패)
- [ ] `workflow_error` 문자열
- [ ] 분석 데이터(`summary`, `primary_intent`)는 그대로인지 확인 (의도: 분석은 유지)

### 상세/목록 500

- [ ] Supabase 프로젝트 활성(Paused 아님)
- [ ] 서버 로그 스택 트레이스

## API 요약

| 메서드 | 경로 | 설명 |
|--------|------|------|
| `POST` | `/api/calls/upload` | 업로드 + **자동 STT·분석·workflow** |
| `POST` | `/api/calls/[id]/process-stt` | STT만 (디버그/재실행) |
| `POST` | `/api/calls/[id]/analyze` | 분석 + workflow (디버그/재실행) |
| `GET` | `/api/calls` | 목록 |
| `GET` | `/api/calls/[id]` | 상세 + entities + recommendations + **operation_case / service_request / reservation_lead** |
| `GET` | `/api/phone-contacts` | 전화번호 DB |

## 향후 확장

- STT/LLM: provider 인터페이스 + 환경 변수
- **Queue**: 업로드 핸들러는 enqueue만, worker가 `runSttForCall` → `runAnalysisForCall` → `createWorkflowFromCall` 실행
- CS/컴플레인: `complaint`는 이미 `operation_cases`로 연결; 추가 분기는 `rules.ts`에서 조정

## 라이선스

프로젝트 정책에 맞게 추가하세요.
