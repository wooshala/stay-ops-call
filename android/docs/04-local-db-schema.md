# 04. Local DB Schema (Draft)

## 테이블: `device_registration`

- `deviceUuid` (PK): app-generated UUID
- `androidId` (nullable): 보조 식별자
- `model`: 기기 모델
- `osVersion`: OS 버전
- `registeredAt` (nullable): 서버 등록 시각
- `accessToken` / `refreshToken` (nullable)

## 테이블: `call_recordings`

- `id` (PK, auto)
- `fileName`
- `fileUri` (SAF URI)
- `fileSize`
- `lastModifiedAt`
- `sha256` (unique index)
- `status` (index)
- `retryCount`
- `remoteCallId` (nullable)
- `remoteStatus` (nullable)
- `errorMessage` (nullable)
- `createdAt` (index)
- `updatedAt`

## 테이블: `app_settings`

- `key` (PK)
- `value`
- `updatedAt`

## 주요 인덱스/제약

- `call_recordings.sha256` unique: 중복 업로드 방지 핵심
- `call_recordings.status`: 워커 배치 조회 성능
- `call_recordings.createdAt`: 최근 통화 목록 정렬
