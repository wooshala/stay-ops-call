# 05. Sync / Upload Workers

## 워커 구조

- `ScanRecordingFolderWorker`
  - SAF 폴더의 신규 파일 탐색
  - 파일 메타 + 해시 기반 큐 삽입
- `UploadQueueWorker`
  - `QUEUED/RETRY_PENDING` 업로드 수행
  - 실패 시 `retryCount` 증가 + backoff
- `StatusSyncWorker`
  - 업로드된 통화의 서버 처리 상태 조회
  - `PROCESSING/COMPLETED/FAILED/REVIEW_NEEDED` 반영

## 오케스트레이션

- One-time 체인: Scan -> Upload -> StatusSync
- Periodic: 15분 주기 StatusSync
- 네트워크 연결 제약 하에서만 실행

## 안정성 원칙

- 백그라운드 실패를 정상 시나리오로 간주
- 재시도 정책 내장(지수 백오프)
- idempotent 업로드 설계(sha256 + 서버 object key)
- 로컬 DB가 단일 소스 오브 트루스

## 1차/2차 계획

- 1차: SAF 수동 폴더 지정 + 스캔 안정화
- 2차: 삼성 경로 자동 탐지 보조 + 사용자 확인 플로우
