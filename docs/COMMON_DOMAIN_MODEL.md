# COMMON DOMAIN MODEL

**공식 초안 (contract)** — 최종 DB 스키마가 아니라, 시스템 간 **용어·소유권·상태·식별자**를 맞추기 위한 기준 문서다.

- 각 프로젝트(Stay-Ops-Call, Chat, CRM, 숙박일지)가 **제각각 엔터티·enum·status**를 만들지 않게 하기 위한 공통 계약이다.
- 통합 전에 **용어 / 소유권 / 상태값**을 먼저 정리한다. DB 직접 연계보다 **도메인 모델을 먼저** 정렬한다.
- 구현 세부는 각 레포의 마이그레이션·타입 정의가 따르되, **충돌 시 이 문서를 갱신한 뒤** 코드·DB를 바꾼다.

관련 문서: `docs/CALL_STATUS_MODEL.md`, `docs/WORKFLOW_RECOVERY_GUIDE.md`, `docs/OPS_QUEUE_SECURITY.md`, `docs/DEPLOYMENT_CHECKLIST.md`.

---

## 1. 목적과 원칙

| 원칙 | 설명 |
|------|------|
| 단일 소유권 | 동일 비즈니스 개념에 대해 **마스터(source of truth)는 한 시스템**만 둔다. |
| 식별자 연계 | 시스템 로컬 PK는 유지하고, 통합 시 **`source_system` + `source_reference_id`**로 상호 참조한다. |
| 상태 분리 | **인터랙션 처리**(STT/분석)와 **업무 레코드 생성**(workflow) 상태를 혼동하지 않는다. (`CALL_STATUS_MODEL.md` 참고) |
| Intent vs 테이블 | `primary_intent`는 **분류·라우팅 입력**이지, DB 테이블 이름이나 처리 결과 타입과 동일시하지 않는다. |
| DB 제약 우선 | 공통 문서가 이상적이어도 **실제 DB check/enum**과 충돌하면 DB·코드 근거를 보고 문서 또는 구현을 정리한다. |

---

## 2. 시스템별 역할 정의

### Stay-Ops-Call

| 구분 | 내용 |
|------|------|
| 잘하는 것 | 음성 통화 업로드, STT, LLM 분석, **`calls` / `call_entities`**, 분석 결과 기반 **초기 workflow 레코드 생성**(`operation_cases`, `service_requests`, `reservation_leads`), 견적 파이프라인과 연동되는 **`quotes`** 등 |
| 소유 | 통화 단위 **Interaction(전화)**, 분석 산출물, 통화에 귀속된 1차 업무 레코드(위 테이블의 **생성 시점** 데이터) |
| 비소유 | CRM 고객 마스터의 최종 정본, 숙박일지의 현장 조치·인수인계 본문, 채팅 세션 메시지 본문 |

### Chat

| 구분 | 내용 |
|------|------|
| 잘하는 것 | 실시간/비동기 **대화**, 메시지 스레드, 채널(웹/카카오 등) 접점 |
| 소유 | **채팅 Interaction**(메시지, 세션, 채널 메타) |
| 비소유 | 통화 녹음 원본, CRM 고객 정본(동기화만 담당할 수 있음), Case/Lead의 비즈니스 최종 상태(다운스트림이 소유할 수 있음) |

### CRM

| 구분 | 내용 |
|------|------|
| 잘하는 것 | **고객(Customer) 마스터**, 관계, 파이프라인, **Lead/Quote** 집계·오너십 |
| 소유 | `customer_id` 체계, Lead/Quote의 **영업 단계·소유자·후속 일정** |
| 비소유 | 통화/채팅 원문 전체(링크·참조만), 숙박일지 실행 로그 |

### 숙박일지

| 구분 | 내용 |
|------|------|
| 잘하는 것 | **운영 실행 기록**, 현장 조치, 인수인계, 내부 운영 타임라인 |
| 소유 | Case/ServiceRequest에 대한 **실행·완료·현장 메모** 등 “했던 일”의 본문 |
| 비소유 | 통화 STT/분석 파이프라인, CRM Lead 단계 정의 |

---

## 3. 공통 엔터티 정의

| 엔터티 | 한 줄 정의 | 핵심 필드 예시 | SoT 후보 | 주로 다루는 시스템 |
|--------|------------|----------------|----------|-------------------|
| **Property** | 호텔/숙소 단위 | `name`, `timezone`, `external_pms_id` | PMS 또는 숙박일지 마스터 | 숙박일지 / CRM(거래처) / Stay-Ops-Call(참조) |
| **Customer** | 게스트·거래처 인물/조직 | `name`, `phones[]`, `crm_external_id` | **CRM** | CRM |
| **Interaction** | 단일 접촉 세션(통화·채팅 등) | `channel`, `started_at`, `ended_at`, `recording_ref` | 채널별 시스템 | Stay-Ops-Call(전화), Chat(채팅) |
| **Reservation** | 확정/가예약 숙박 계약 | `check_in`, `check_out`, `room_type`, `status` | PMS/CRS | CRM·PMS 연동 (Stay-Ops-Call은 직접 SoT 아님) |
| **Lead** | 예약·문의로 이어질 수 있는 판매 기회 | `lead_type`, `title`, `status`, `phone` | CRM 또는 Stay-Ops-Call 1차 생성 후 CRM 이관 | Stay-Ops-Call(`reservation_leads`) → CRM |
| **Case** | 민원·결제·유지보수 등 **조치·추적이 필요한 운영 이슈** | `case_type`, `severity`, `status`, `room_no` | 숙박일지+CRM 혼합 가능(합의 필요) | Stay-Ops-Call(`operation_cases`) 생성 → 숙박일지 실행 |
| **ServiceRequest** | 비품·배달 등 **상대적으로 단순한 요청** | `item_requested`, `quantity`, `status` | 숙박일지 또는 Ops | Stay-Ops-Call(`service_requests`) |
| **Quote** | 견적서/가격안 | `status`, `total_amount`, `sent_at` | CRM 또는 견적 전용 | Stay-Ops-Call(`quotes`, `QuoteRow` 타입) |

---

## 4. 시스템별 소유권(Ownership)

`create` = 최초 생성 주체, `update` = 일상적 변경 주체, `read` = 조회, `derived-only` = 다른 SoT에서 파생·동기화만, `none` = 담당하지 않음.

| 엔터티 | Stay-Ops-Call | Chat | CRM | 숙박일지 | Source of Truth (권장) |
|--------|---------------|------|-----|----------|------------------------|
| Property | read | read | read / update (거래처 정책에 따름) | read / update | 합의 (PMS/숙박일지 중 하나) |
| Customer | derived-only (전화번호 등) | read / derived-only | **create / update** | read | **CRM** |
| Interaction(call) | **create / read / update** | none | read | read | Stay-Ops-Call |
| Interaction(chat) | none | **create / read / update** | read | read | Chat |
| Reservation | read / derived-only | read / derived-only | read / update | read | PMS/CRS (프로젝트별) |
| Lead | create / read / update (초기) | derived-only | **create / read / update** (이관 후) | read | CRM (장기), Stay-Ops-Call은 유입 |
| Case | create / read / update (초기) | derived-only | read / update | **read / update** (실행) | 합의 (이슈 본문은 숙박일지 우선 가능) |
| ServiceRequest | create / read / update (초기) | derived-only | read | **read / update** | 숙박일지 (실행), Stay-Ops-Call (유입) |
| Quote | create / read / update | none | **read / update** | read | CRM (장기) 또는 견적 모듈 |

여러 시스템이 동일 엔터티를 동시에 **마스터**로 가지지 않도록, 이관 시점·`source_system`을 문서화한다.

---

## 5. 공통 식별자(ID) 규칙

| ID | 의미 |
|----|------|
| `property_id` | 숙소 단위 |
| `customer_id` | CRM 고객 |
| `interaction_id` | 통화·채팅 등 단일 접촉 (Stay-Ops-Call에서는 `calls.id` 등) |
| `reservation_id` | PMS/CRS 예약 |
| `lead_id` | 판매 리드 (`reservation_leads.id` 등) |
| `case_id` | 운영 케이스 (`operation_cases.id` 등) |
| `service_request_id` | 비품/서비스 요청 (`service_requests.id` 등) |
| `quote_id` | 견적 (`quotes.id` 등) |

**연계 필드 (필수 권장)**

| 필드 | 용도 |
|------|------|
| `source_system` | 레코드를 최초 생성하거나 authoritative로 보는 시스템 식별자 (예: `stay_ops_call`, `crm`, `chat`) |
| `source_reference_id` | 그 시스템 내 PK/업무 키 |

Stay-Ops-Call의 `quotes` 타입(`lib/db/quotes.ts`)에 이미 `source_system` / `source_reference_id` 컬럼이 있다. 다른 엔터티에도 동일 패턴을 확장할 때 이 문서를 먼저 갱신한다.

---

## 6. 공통 상태값 / enum 표준

아래는 **Stay-Ops-Call 현재 구현**과 맞춘 공통 표준의 기준점이다. 다른 시스템은 매핑 테이블을 두고 drift를 방지한다.

### Interaction (통화 기준: `calls`)

| 축 | 공통 개념 | Stay-Ops-Call (`lib/types/database.ts` 등) |
|----|-----------|---------------------------------------------|
| 업로드 | interaction ingest | `upload_status`: `uploaded` \| `failed` |
| STT | speech-to-text | `stt_status`: `pending` \| `processing` \| `completed` \| `failed` |
| 분석 | LLM 분석 파이프라인 | `analysis_status`: `queued`, `pending`, `processing`, `completed`, `failed`, `partial`, `warning` |
| 업무 레코드 생성 | workflow upsert | `workflow_status`: `not_started`, `pending`, `running`, `completed`, `failed`, `skipped` |

> **원칙**: workflow 생성 실패는 `analysis_status`를 깨지 않고 `workflow_status = failed`에 남긴다 (`CALL_STATUS_MODEL.md`).

### Recommended action priority (분석 JSON)

- `low` \| `normal` \| `high` (`RecommendedActionSchema`)

### Case severity (`operation_cases`)

- **허용**: `medium` \| `high` — **`normal` 금지** (`lib/workflows/contract.ts`, `CALL_STATUS_MODEL.md`)

### Case status (`operation_cases`)

- `open` \| `in_progress` \| `resolved` \| `closed`

### Lead status (`reservation_leads`)

- `new` \| `contacted` \| `converted` \| `lost`

### Service request status (`service_requests`)

- `open` \| `in_progress` \| `completed` \| `cancelled`

### Quote status (`QuoteStatus` in `lib/db/quotes.ts`)

- `draft` \| `ready` \| `sent` \| `accepted` \| `rejected` \| `expired`

### Quote message send status

- `pending` \| `sent` \| `failed`

새 상태값 추가 시 **이 문서 → 각 레포 enum** 순으로 반영한다.

---

## 7. 공통 intent taxonomy

### 7.1 크로스 시스템 기본 초안 (분류·라우팅용)

아래는 **여러 채널에서 공통으로 쓰기 좋은 최소 집합**이다.

| Intent | 설명 |
|--------|------|
| `reservation_inquiry` | 가용·요금·일정 문의 등 예약 전 단계 |
| `cancel_request` | 취소 의사·조건 문의 |
| `refund_request` | 환불·결제 역정산 |
| `complaint` | 청결·응대·품질·정책 관련 **불만** |
| `maintenance` | 고장·누락 등 **즉시 조치 가능한 물리·시설 이슈** |
| `payment` | 결제·입금·카드 등 |
| `checkin_checkout` | 입퇴실·연장 등 일정/키/시간 |
| `parking` | 주차 |
| `lost_and_found` | 분실물 |
| `other` | 분류 불가·보류 |

### 7.2 maintenance vs complaint (경계)

| 유형 | maintenance | complaint |
|------|-------------|-----------|
| 성격 | 물리적·기술적 **조치** 중심 | 서비스·정책·품질 **불만** 중심 |
| 예시 | 베개 **없음**(누락·비치) | 베개가 **낡음**(품질 불만) |

### 7.3 Stay-Ops-Call에 이미 있는 값 (스키마 기준)

`lib/analysis/schema.ts`의 `PrimaryIntentSchema`에는 위 외에도 예: `service_request`, `rate_inquiry`, `extension_request`, `quotation_intent`, `manual_review_required` 등이 있다.  
공통 문서에 없는 값을 쓰려면 **이 섹션을 먼저 확장**한 뒤 스키마·라우팅을 맞춘다.

---

## 8. workflow 라우팅 원칙

현재 Stay-Ops-Call의 `shouldCreateWorkflowForIntent` (`lib/workflows/rules.ts`) 기준:

| 방향 | 대상 테이블 | 비고 |
|------|-------------|------|
| 예약 전환 가능성 | **Lead** (`reservation_leads`) | `reservation_inquiry`, `rate_inquiry`, `extension_request`, `quotation_intent` |
| 운영 이슈·민원·결제 | **Case** (`operation_cases`) | `maintenance`, `complaint`, `payment` |
| 비품·배달형 요청 | **ServiceRequest** (`service_requests`) | `service_request` — **`request_type` 등 비품/서비스 요청 구조** |
| 자동 라우팅 보류 | 없음 (`null`) | `checkin_checkout`, `cancel_request`, `refund_request`, `parking`, `manual_review_required`, `other` → `workflow_status = skipped` 등으로 정리 가능 |

**원칙**

- 예약 전환 가능성 → **Lead**
- 운영 이슈·민원·조치 추적 → **Case**
- 단순 후속 비품/배달 → **ServiceRequest**
- 정책 미정·모호 → **review queue** 또는 `other` + 수동 (`manual_review_required`)

**금지**: `service_requests`에 민원·결제·시설 고장 등 **Case 성격**을 억지로 넣지 않는다. 테이블 의미·DB 제약을 먼저 본다.

---

## 9. 공통 entity 추출 원칙

- LLM은 **넓게** `entities`를 추출할 수 있다 (`EntitiesSchema`: room, guest, 금액, 주차 대수 등).
- **저장·workflow 빌더**는 intent별 **필요한 필드만** 사용한다 (`buildMaintenanceCase`, `buildReservationLeadRow` 등).

| Intent 계열 | 저장 시 우선 필드 예시 |
|--------------|-------------------------|
| reservation_inquiry 등 Lead | 날짜·인원·객실·채널·요약·전화 |
| complaint / maintenance | `room_no`, `issue_type`, 설명, severity 규칙 |
| payment | `payment_method`, `amount` / deposit 관련 |
| service_request | `item_requested`, `quantity`, `unit` |

**원칙**: *LLM 출력은 넓게, DB 저장은 좁게.*

---

## 10. 안티패턴 / 금지사항

- [ ] 시스템마다 별도의 **Customer 마스터**를 두고 동기화 없이 갱신한다.
- [ ] 같은 의미의 상태를 시스템마다 **다른 문자열**로만 쓴다 (매핑 테이블·이 문서 없이).
- [ ] 한 시스템이 다른 시스템 **내부 테이블을 직접 UPDATE**한다 (API·이벤트·승인된 동기화 경로만).
- [ ] 동일 이슈를 통화와 채팅에서 **각각 별도 Case**로만 만들고 통합 키가 없다.
- [ ] `service_request`(테이블/엔터티)를 **intent 이름**처럼 쓰거나, `primary_intent`를 테이블명과 동일시한다.

---

## 11. 통합 이벤트 초안

DB 직결보다 장기적으로 **이벤트 기반** 연동을 권장한다. 이름 수준 초안:

- `interaction.created`
- `interaction.analyzed`
- `lead.created`
- `case.opened`
- `service_request.created`
- `quote.created`
- `quote.sent`

페이로드에는 최소 `source_system`, `source_reference_id`, 관련 `interaction_id`를 포함한다.

---

## 12. Stay-Ops-Call 현재 매핑

| 공통 엔터티 | 현재 프로젝트 |
|-------------|----------------|
| Interaction(call) | `calls` (+ `stt_status`, `analysis_status`, `upload_status`) |
| Lead | `reservation_leads` (`lead_type` = 분석 `primary_intent` 등) |
| Case | `operation_cases` (`case_type`: complaint / maintenance / payment 등) |
| ServiceRequest | `service_requests` (`request_type`, `item_requested`, …) |
| Quote | `quotes` (+ `QuoteMessageRow`, `QuoteVersionRow`; `source_system` / `source_reference_id` 존재) |
| 추출 상세 | `call_entities` |

**상태·운영 (문서·코드와 정합)**

- `analysis_status`와 `workflow_status` **분리** (`CALL_STATUS_MODEL.md`).
- `/ops/queue` 운영 큐, HTTP `POST .../analyze` · `.../workflow` + `INTERNAL_API_TOKEN` Bearer (`OPS_QUEUE_SECURITY.md`).
- `operation_cases.severity`: **`medium` \| `high`만** (normal 금지).

---

## 13. 다음 적용 순서

1. 이 문서를 기준으로 **Stay-Ops-Call** 용어·enum·intent 스키마 정합성을 유지한다.
2. **Chat** 설계 시 이 문서를 먼저 참조해 `Interaction(chat)`·이벤트명을 맞춘다.
3. **CRM**은 Customer / Lead / Quote 중심으로 ID·상태를 맞춘다.
4. **숙박일지**는 Case / ServiceRequest / 실행 로그 중심으로 맞춘다.
5. enum·intent·status 추가는 **이 문서 업데이트 후** 각 레포에 반영한다.
