# Stay-Ops-Call Android MVP

`android/`는 기존 웹/API 코드와 완전히 분리된 Android Studio 독립 프로젝트입니다.

## 목표

- 업장폰 통화녹음 파일을 SAF 기반으로 감지
- 업로드 큐/재시도/상태조회 안정성 우선 구현
- 서버 파이프라인(STT/분석/검수/CRM) 연계를 위한 `/api/mobile` 클라이언트 기반 마련

## 기술 스택

- Kotlin + Gradle
- Jetpack Compose
- Room
- WorkManager
- Retrofit/OkHttp
- Hilt

## 현재 스캐폴딩 포함 항목

- Compose 화면 골격: Home, Login, Settings, Call List, Status
- Room 엔티티/DAO/DB 기본 구조
- WorkManager 워커 체인(스캔 -> 업로드 -> 상태동기화) 뼈대
- Retrofit `/api/mobile` API 인터페이스 placeholder
- 기기 식별자(installation UUID + Android ID 보조값) 생성 구조
- SAF 폴더 URI 저장소 placeholder

## 실행 방법

1. Android Studio에서 `android/` 폴더를 프로젝트로 열기
2. Gradle sync 수행 (프로젝트 루트에 **Gradle Wrapper** 포함: `gradlew` / `gradlew.bat`)
3. `app/build.gradle.kts`의 `BASE_URL`을 실제 서버 주소로 수정
4. 디버그 빌드/실행

### CLI에서 debug APK 빌드 (선택)

- **JDK 17+** 필요. Android Studio 내장 JBR 사용 예: `JAVA_HOME` = `.../Android Studio/jbr`
- Windows: `gradlew.bat assembleDebug`
- 생성물: `app/build/outputs/apk/debug/app-debug.apk`

### 단말 설치 (ADB)

```text
adb install -r app/build/outputs/apk/debug/app-debug.apk
```

### 설치 후 첫 실행 — 권한·설정 흐름 (점검)

1. **네트워크**: 서버 연동을 위해 Wi-Fi/LTE 허용 (인터넷 권한은 매니페스트 기준 자동)
2. **로그인**: `Login`에서 계정 로그인 → 토큰 저장 (실서버 `BASE_URL` 필요)
3. **통화녹음 폴더**: `Settings` → **Select Recording Folder** (SAF) → 폴더 선택 후 URI 유지 확인
4. **알림 (Android 13+)**: 매니페스트에 `POST_NOTIFICATIONS` 선언됨. 로컬 알림을 쓸 때는 설정에서 알림 허용 또는 앱에서 런타임 요청 추가 검토
5. **배터리/절전**: 일부 기기에서 백그라운드 워커 지연 가능 → 파일럿 시 배터리 최적화 예외 여부 확인

## 문서

### 기획·설계 (01~07)

- `docs/01-product-overview.md`
- `docs/02-information-architecture.md`
- `docs/03-screen-flows.md`
- `docs/04-local-db-schema.md`
- `docs/05-sync-upload-workers.md`
- `docs/06-api-contract.md`
- `docs/07-pilot-rollout-plan.md`

### 파일럿 운영 (실행 → 기록) — **아래 순서대로** 읽으면 됩니다

1. **당일 실행 절차** — `docs/09-pilot-day-runbook.md`
2. **테스트 체크리스트** — `docs/08-pilot-test-checklist.md`
3. **기록 양식(빈칸)** — `docs/10-pilot-record-template.md`
4. **샘플 기록 예시** — `docs/11-pilot-record-sample.md` (이 정도로 채우면 됨)
