# 02. Information Architecture

## 앱 정보 구조

- Auth
  - 업장 계정 로그인
  - JWT/Bearer 보관
  - 기기 등록(device_uuid 중심)
- Setup
  - SAF 폴더 선택
  - 권한 유지(persistable permission)
- Capture & Queue
  - 폴더 스캔
  - 파일 해시 계산(중복 방지)
  - 업로드 큐 적재
- Sync
  - 업로드 실행/재시도
  - 서버 처리 상태 동기화
- Monitor
  - 최근 통화 목록
  - 검수 필요/실패 알림
  - 통화 상세 + 재업로드

## 모듈 관점

- `ui`: 화면, 상태표시, 사용자 액션
- `data/local`: Room 저장소
- `data/remote`: `/api/mobile` 연동
- `work`: WorkManager 기반 백그라운드 체인
- `core`: 기기 식별, 설정, 저장소 유틸

## 상태 라이프사이클

- `DISCOVERED` -> `QUEUED` -> `UPLOADING` -> `UPLOADED`
- `UPLOADED` -> `PROCESSING` -> `COMPLETED`
- 실패 시 `FAILED_UPLOAD` 또는 `FAILED_PROCESSING`
- 수동 복구 시 `RETRY_PENDING`
