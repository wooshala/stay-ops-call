# Intent Taxonomy (2026-04-17 기준)

## 현재 유효한 intent 목록

| intent | 한국어 설명 | 자동 라우팅 | 생성 레코드 |
|--------|------------|------------|------------|
| `maintenance` | 시설/비품 고장 (TV, 에어컨, 잠금장치 등) | ✅ | operation_cases (case_type=maintenance) |
| `complaint` | 불만 접수, 분실 신고, 서비스 불만 | ✅ | operation_cases (case_type=complaint) |
| `payment` | 실제 결제·입금 행위 (계좌이체, 카드결제, 입금 확인) | ✅ | operation_cases (case_type=payment) |
| `reservation_inquiry` | 예약 문의, 방 타입/가격 확인, 예약 변경, 단체견적 | ✅ | reservation_leads |
| `checkin_checkout` | 체크인/아웃 시간 조정, 연장 투숙, 오늘 입실 확인 | ⏸ 보류 | — |
| `cancel_request` | 예약 취소 요청 | ⏸ 보류 | — |
| `refund_request` | 환불 요청 | ⏸ 보류 | — |
| `parking` | 주차 문의 | ⏸ 보류 | — |
| `service_request` | 비품/어메니티 객실 배달 (수건, 핸드크림 등) | ✅ | service_requests |
| `other` | 위 카테고리에 해당하지 않거나 분류 불가 | ❌ 없음 | — |

> **보류(⏸)**: 수신은 되지만 자동 레코드를 만들지 않음. 향후 적절한 워크플로 설계 후 활성화 예정.

## 구 taxonomy → 신규 taxonomy 매핑

| 구 intent | 신규 intent | 이유 |
|-----------|------------|------|
| `extension_request` | `checkin_checkout` | 체크인/아웃 시간 조정으로 통합 |
| `rate_inquiry` | `reservation_inquiry` | 요금 문의 = 예약 문의의 하위 개념 |
| `quotation_intent` | `reservation_inquiry` | 단체/패키지 견적도 예약 리드로 처리 |
| `service_request` | `other` | 자동 라우팅 보류 (backfill) — 새 통화는 `service_request` 유지 |
| `manual_review_required` | `other` | 분류 불가 → other로 단순화 |

Migration 032에서 DB 백필 완료.

## 주요 disambiguation 규칙

### checkin_checkout vs reservation_inquiry
- **checkin_checkout**: 이미 예약된 상태에서 입퇴실 시간을 바꾸거나 오늘 체크인 확인
  - "체크인 시간 앞당겨주세요", "퇴실 2시간 연장 가능해요?", "오늘 몇 시에 들어가요?"
- **reservation_inquiry**: 아직 예약하지 않은 상태에서 문의하거나 새 예약을 요청
  - "방 있어요?", "이번 주 토요일 예약 가능해요?", "가격이 얼마에요?"

### payment vs reservation_inquiry
- **payment**: 실제 결제 행위가 이루어짐
  - "계좌이체 할게요", "입금했어요", "카드로 결제할게요"
- **reservation_inquiry**: 가격/결제 방법을 묻는 것에 그침
  - "얼마에요?", "어떻게 결제해요?" (결제 행위 없음)

### service_request vs other
- 어떤 물품이든 "가져다 달라", "배달해 달라"면 → **service_request**
- 단순 문의나 질문이면 → **other**
