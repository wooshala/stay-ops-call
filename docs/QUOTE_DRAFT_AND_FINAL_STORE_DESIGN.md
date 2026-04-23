# Quote Draft vs Final Quote Store Design

## 1) 목적과 원칙

이 문서는 견적 데이터를 아래 2계층으로 분리하기 위한 설계 초안이다.

- `calls.quote_draft`: 통화 후 자동 생성/수정되는 **임시 작업공간(draft workspace)**
- `quotes`(또는 `quote_documents`): 최종 확정/발송 이력을 관리하는 **최종 저장소(source of truth)**

핵심 원칙:

1. 수동 견적과 자동 견적의 최종 Source of Truth는 하나여야 한다.
2. `calls.quote_draft`는 통화 후 생성되는 임시 draft 저장소로만 사용한다.
3. 최종 확정/발송 시에는 통합 견적 DB(`quotes` 또는 `quote_documents`)에 저장한다.
4. 수동 견적(App Script/Google Sheet)과 자동 견적(JS)은 출처만 다르고 최종 데이터 모델은 동일해야 한다.

---

## 2) 역할 구분

### A. Draft Store (`calls.quote_draft`)

역할:

- 통화 직후 자동 견적 초안 생성 결과 보관
- 직원이 객실 선택/문구 편집하는 중간 상태 보관
- auto-save 대상

특징:

- 단일 JSON 필드 (빠른 구현, 유연한 구조)
- 변경이 잦고 임시 성격
- 장기 리포팅/정산/감사 이력의 기준으로 사용하지 않음

보관 예시 필드:

- `selectedRoomType`
- `priceSnapshot`
- `messageDraft`
- `status` (`draft`, `needs_review`)
- `needsReviewReason`, `needsReviewReasons`
- `updatedAt`

### B. Final Quote Store (`quotes` 또는 `quote_documents`)

역할:

- 최종 확정된 견적서 기록
- 발송 상태/발송 시각/확정 금액의 단일 기준
- 수동 견적과 자동 견적을 같은 모델로 통합

특징:

- 정규화된 컬럼 중심
- 조회/집계/감사 추적 친화적
- 외부 발송 시스템 연동 기준 데이터

---

## 3) 장기 통합 데이터 모델 초안 (`quotes`)

아래는 `quotes` 테이블 초안이다. (`quote_documents`로 이름만 바꿔도 동일)

```sql
quotes
- id (uuid, pk)
- call_id (uuid, nullable)                -- 통화 기반 생성이면 연결
- customer_phone_number (text, nullable)  -- 최종 발송 기준 번호
- requested_date (date, nullable)
- requested_weekday (text, nullable)      -- monday..sunday
- stay_type (text, not null)              -- overnight | dayuse
- room_type (text, nullable)              -- standard | deluxe | suite
- quoted_price (numeric, nullable)
- price_currency (text, default 'KRW')
- message_body (text, not null)
- quote_status (text, not null)           -- draft | confirmed | sent | cancelled
- source_kind (text, not null)            -- auto | manual
- source_system (text, nullable)          -- web_quote_engine | apps_script | gsheet_import ...
- source_reference_id (text, nullable)    -- 외부 시스템 row id 등
- finalized_by (text, nullable)           -- 직원 id/email 등
- finalized_at (timestamptz, nullable)
- sent_at (timestamptz, nullable)
- metadata_json (jsonb, nullable)         -- 확장 필드
- created_at (timestamptz, not null)
- updated_at (timestamptz, not null)
```

보조 테이블(선택):

```sql
quote_events
- id
- quote_id
- event_type        -- created | confirmed | sent | edited | cancelled ...
- actor
- payload_json
- created_at
```

---

## 4) Manual / Auto Source 구분 필드 설계

최종 통합 모델에서 출처 구분은 아래 3개로 충분하다.

1. `source_kind`
   - `auto`: JS quote-engine에서 자동 생성/진행
   - `manual`: 직원 수동 작성/외부 시트 입력

2. `source_system`
   - 예: `web_quote_engine`, `apps_script`, `google_sheet`, `legacy_import`

3. `source_reference_id`
   - 외부 시스템 원본 식별자(시트 row id, 앱스크립트 document id 등)

이렇게 하면:

- 자동/수동 모두 동일한 최종 `quotes` 스키마에 저장 가능
- 출처 추적은 유지하면서도 비즈니스 로직(상태/발송/집계)은 단일 모델로 처리 가능

---

## 5) 권장 데이터 흐름

1. 통화 종료 → `buildQuoteDraft` 생성 → `calls.quote_draft` 저장
2. 직원 편집/선택(auto-save) → 계속 `calls.quote_draft` 업데이트
3. 직원이 "최종 확정/발송 준비 완료" 클릭
4. `calls.quote_draft`를 정규화하여 `quotes`에 upsert/insert
5. 이후 발송 상태/이력은 `quotes` 중심으로 관리

규칙:

- `calls.quote_draft`는 작업 중 상태
- `quotes`가 최종 계약/발송 관점의 정본

---

## 6) 마이그레이션/도입 순서 제안

1. 현재 유지: `calls.quote_draft` 기반 UX 계속 사용
2. `quotes` 테이블 생성 (읽기/쓰기 API 추가)
3. 상세 화면에 "최종 확정" 액션 추가 (draft -> quote 승격)
4. 목록 화면을 점진 전환:
   - 작업목록: `calls.quote_draft`
   - 최종목록: `quotes`
5. 수동 견적(App Script/Sheet)도 `quotes` 적재 경로 통합

이 순서를 따르면 현재 MVP를 깨지 않고 장기 통합 구조로 이동할 수 있다.
