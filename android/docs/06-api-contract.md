# 06. API Contract (`/api/mobile`)

## 인증

- 방식: JWT/Bearer
- 헤더: `Authorization: Bearer <access_token>`
- 토큰 갱신: `POST /api/mobile/auth/refresh`

## 엔드포인트 초안

- `POST /api/mobile/auth/login`
  - request: `shopAccount`, `password`
  - response: `accessToken`, `refreshToken`

- `POST /api/mobile/auth/refresh`
  - request: `refreshToken`
  - response: `accessToken`, `refreshToken?`

- `POST /api/mobile/devices/register`
  - request: `deviceUuid`, `androidId?`, `model`, `osVersion`
  - response: `registered`, `deviceId`

- `POST /api/mobile/calls/upload-url`
  - request: `fileName`, `contentType`, `fingerprint`, `idempotencyKey`
  - response: `uploadUrl`, `objectKey`, `uploadSessionId`

- `POST /api/mobile/calls`
  - request: `objectKey`, `recordedAt`, `fingerprint`, `idempotencyKey`, `uploadSessionId`
  - response: `callId`, `status`, `isDuplicate`

- `GET /api/mobile/calls/{callId}/status`
  - response: `callId`, `status`, `reviewNeeded`

## 상태값 제안

- `RECEIVED`, `STT_DONE`, `ANALYZED`, `REVIEW_NEEDED`, `DONE`, `FAILED`

## 멱등성 규약 (운영 필수)

### 키 정의

- `fingerprint`: 클라이언트가 계산한 파일 SHA-256
- `idempotencyKey`: `deviceUuid + fingerprint` 기반 고정 키(예: `deviceUuid:fingerprint`)

### 요청별 규약

- `POST /calls/upload-url`
  - 동일 `idempotencyKey` 재요청 시 **동일 objectKey 재사용** 또는 동일 업로드 세션 반환
  - 서버는 새 objectKey 남발 금지
- `POST /calls`
  - 동일 `idempotencyKey` 재요청 시 **기존 callId 재반환**
  - 중복 call row 생성 금지
  - `isDuplicate=true`로 클라이언트에 힌트 제공 가능

### 클라이언트 책임

- fingerprint 계산 일관성 유지(파일 바이트 기준)
- 재시도 시 동일 파일에 동일 `idempotencyKey` 사용
- DB에 `remoteCallId` 저장 후 동일 건 재등록 방지

### 서버 책임

- `idempotencyKey`를 고유 키로 보장(적어도 기간 내 유니크)
- 중복 요청에도 결과 일관성 보장(같은 callId/objectKey)
- 실패 응답 시 재시도 가능 여부를 명확한 코드/메시지로 제공

## 모바일-서버 연동 체크포인트

- callId 부재 레코드의 재시도 규칙 합의
- `reviewNeeded` 이벤트 알림 조건 합의
- 멱등 키 보존 기간(TTL) 확정
