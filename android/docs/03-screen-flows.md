# 03. Screen Flows

## 화면 목록

- Home(대시보드)
- Login(업장 계정 로그인)
- Settings(SAF 폴더 지정/동기화 정책)
- Calls(최근 통화 및 처리 결과)
- Status(업로드/처리 상태 요약)
- Call Detail(재업로드/에러 원인 확인) - 다음 단계 구현

## 핵심 플로우

1. 앱 최초 실행 -> Login
2. 로그인 성공 -> Device Register
3. Settings에서 통화녹음 폴더 선택(SAF)
4. 스캔 워커가 신규 파일을 큐에 적재
5. 업로드 워커가 업로드 + 재시도 수행
6. 상태 워커가 서버 처리결과 반영
7. Calls/Status 화면에서 운영자 확인

## 알림 플로우

- `review_needed = true` 수신 시 로컬 알림 생성
- 업로드 실패 누적 시 경고 알림 생성
- 알림 탭 -> 해당 통화 상세 화면 진입
