# Stay-Ops-Call Engineering Contract (Ops Contract)

## 목적
이 프로젝트의 모든 구현은 “기능 요구”가 아니라 “구현 계약(Contract)” 기준으로 진행한다.
Cursor는 설계를 하지 않는다. 설계는 항상 사전에 확정되어야 한다.

---

## 절대 규칙 (MUST)

1. 모든 작업은 아래 6요소를 포함해야 한다.
- 목표
- 수정 파일
- DB 스키마 변경
- 데이터 흐름
- fallback 규칙
- 검증 방법

이 6요소가 없으면 구현 시작 금지.

---

2. DB 스키마 없이 기능 구현 금지
- 새로운 기능이 DB 컬럼/테이블을 필요로 하면
  → 반드시 migration 먼저 작성
- DB 없는 상태에서 UI/API 구현 금지

---

3. 상태값 계약 (변경 금지)

analysis_status:
- queued
- processing
- completed
- failed
- partial
- warning

UI와 DB는 반드시 동일 상태값 사용

---

4. 실패 처리 규칙

- throw로 전체 흐름 중단 금지
- 모든 실패는 DB에 기록
- 필수 저장:
  - analysis_status = 'failed'
  - analysis_error_message

---

5. Batch 연결 규칙

- 모든 call은 batch_job_id를 가져야 한다
- batch_job_id 없는 데이터는 fallback 허용
- 하지만 기본 경로는 항상 calls.batch_job_id

---

6. Fallback 규칙

- 컬럼/테이블 없으면 500 금지
- optional select 또는 try/catch 처리
- console.warn으로 경고만 출력

---

7. 구현 순서 (고정)

1. DB migration
2. API
3. pipeline
4. UI
5. 검증

순서 변경 금지

---

8. 완료 기준 (반드시 통과)

다음 시나리오가 끝까지 동작해야 완료:

1. 파일 업로드
2. 분석 실행
3. calls row 생성
4. analysis_status 저장
5. batch_job_id 저장
6. /calls에서 조회 가능

---

9. 금지사항

- DB 없이 UI 먼저 구현 금지
- 상태값 임의 변경 금지
- 에러 무시 금지
- batch 연결 없는 저장 금지

---

## 핵심 원칙

Cursor는 구현만 한다.
설계는 항상 사전에 완전히 정의되어야 한다.