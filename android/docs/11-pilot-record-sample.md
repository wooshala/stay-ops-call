# 11. Pilot Record Sample (1st Run)

`10-pilot-record-template.md` 기준으로 작성한 샘플 예시.  
현장 담당자가 같은 형태로 채우면 된다.

## A. 기본 정보

- 날짜: 2026-03-24
- 매장명: 강남 1호점
- 담당자: 김OO
- 기기 모델: Samsung Galaxy A34 5G
- OS 버전: Android 14 (One UI 6.1)
- 앱 버전: 0.1.0-mvp
- 네트워크 환경(Wi-Fi/LTE): 매장 Wi-Fi 기본, 일부 구간 LTE 전환

## B. 운영 집계 (회차 기준)

- 운영 시작 시각: 10:00
- 운영 종료 시각: 18:00
- 통화 발생 수: 43건
- 스캔 감지 수: 41건
- 업로드 성공 수: 39건
- 업로드 실패 수: 2건
- `retry_pending` 건수: 1건 (종료 시점 미복구)
- `failed_upload` 건수: 1건 (최대 재시도 초과)
- call 생성 수(`serverCallId` 존재): 39건

## C. 단계별 확인 체크 (Yes/No)

- [x] 로그인 성공 및 토큰 저장 확인
- [x] SAF 녹음 폴더 선택/유지 확인
- [x] 기준 통화 1건 E2E `synced` 확인
- [x] 실패 필터에서 원인 확인 가능
- [x] 재시도 후 복구 케이스 확인
- [x] 최종 실패 건(`failed_upload`) 수기 기록 완료

## D. 상태 전이 관찰 기록

| 파일명 | 최초 상태 | 최종 상태 | retryCount | errorMessage | serverCallId | 비고 |
|---|---|---|---:|---|---|---|
| call_20260324_101522.m4a | pending | synced | 0 | - | c_8f24a1 | 기준 통화, 정상 완료 |
| call_20260324_112901.m4a | pending | synced | 1 | Socket timeout (1회) | c_90bd33 | 네트워크 순간 끊김 후 재시도 복구 |
| call_20260324_134455.m4a | pending | retry_pending | 2 | AUTH_EXPIRED: token missing | - | 점심 이후 토큰 만료, 재로그인 전 대기 |
| call_20260324_145010.m4a | pending | failed_upload | 3 | RELOGIN_REQUIRED: refresh failed | - | 최대 재시도 초과, 수동 재로그인 필요 |
| call_20260324_165842.m4a | pending | synced | 0 | - | c_b4de02 | 대용량(약 220MB) 파일, 스트리밍 업로드 완료 |

## E. 특이사항 / 장애 로그

- 시간: 11:28  
  증상: 업로드 중 1건 timeout 발생  
  화면상 상태/메시지: `retry_pending`, `Socket timeout`  
  재현 여부(항상/간헐): 간헐  
  임시 조치: 5분 후 Step 3 재실행  
  결과: 정상 복구, `synced` 전환

- 시간: 13:41  
  증상: 401 응답 후 call 생성 중단  
  화면상 상태/메시지: `AUTH_EXPIRED`  
  재현 여부(항상/간헐): 간헐  
  임시 조치: 재로그인 수행  
  결과: 이후 신규 건 정상 업로드

- 시간: 14:52  
  증상: 특정 건 refresh 실패 반복  
  화면상 상태/메시지: `RELOGIN_REQUIRED`, 이후 `failed_upload`  
  재현 여부(항상/간헐): 단건  
  임시 조치: 해당 건 파일명/시간대 별도 기록, 다음 회차 재검증 대상 지정  
  결과: 당일 미복구(최종 실패 1건)

## F. 당일 결론

- 총평(정상/주의/실패): **주의(운영 가능)**  
  - 전체 흐름은 안정적으로 동작했고, 대다수 통화가 `synced` 완료됨.
  - 인증 만료 구간에서 2건 이슈가 발생했으나 원인 추적 가능.

- 즉시 수정 필요 항목:
  1. refresh 실패 시 사용자 안내 문구를 더 명확히 표시(재로그인 유도 강화)
  2. `retry_pending` 장기 잔류 건에 대한 알림 표시 강화

- 다음 회차 전 준비사항:
  1. 파일럿 시작 전 재로그인 시각/토큰 만료 예상 시간 운영 가이드 추가
  2. 점심/교대 시간대 네트워크 품질 체크 절차 추가
  3. `failed_upload` 발생 시 현장 즉시 조치 플로우(재로그인 -> 수동 재업로드) 체크리스트화
