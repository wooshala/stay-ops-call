# CALL-APK-INSTALL-GATE-001 — APK 설치 전 검증 게이트

> 상태: **BACKLOG (미착수)** · 등록 2026-08-01
> 선행: CALL-BUILD-ARTIFACT-001 (완료, `9ee9244`)
> **이번 등록은 문서화까지다. 스크립트 구현·CI 연결은 별도 PR 로 진행한다.**

---

## 1. 왜 필요한가

`.gitignore` 수정만으로는 **"오래된 로컬 APK 를 실수로 설치"** 하는 모든 경우를 막지 못한다.

실제 사고(CALL-DURATION-003):

```
git checkout --detach origin/main
  → tracked 였던 android/app/build/** 가 2026-04-24 커밋본으로 복원
  → 소스는 최신(e834bcd)인데 APK 만 4 개월 전 빌드
  → adb install -r  → Success
  → Room 마이그레이션 미발생, duration 코드 부재 → 검증 전체 무효
```

**소스만 확인하고 APK 를 재빌드하지 않은 것**이 직접 원인이다.
CALL-BUILD-ARTIFACT-001 로 checkout 복원 경로는 막혔지만, 다음은 여전히 가능하다.

- Gradle 빌드 실패 후 **직전 성공 산출물**이 그대로 남아 그걸 설치
- 다른 브랜치에서 빌드한 APK 가 남아 있는 상태로 설치
- 여러 워크트리(`/c/soc`, `/c/dev/stay-ops-call`)의 APK 를 혼동

---

## 2. 게이트 절차 (6단계)

```
1. stale APK 삭제        rm -f app/build/outputs/apk/debug/app-debug.apk
2. HEAD 기록             git rev-parse HEAD  +  git status --short (dirty 여부)
3. clean assembleDebug   ./gradlew :app:assembleDebug
4. APK 지문 기록          생성시각 · 크기 · SHA-256
5. APK 내용 확인          dex 문자열 / BuildConfig 필수 항목
6. 그 APK 만 설치         adb install -r <그 경로>
```

**1번이 핵심이다.** 먼저 지워야 3번이 실패했을 때 과거 산출물을 설치하는 상황이 원천 차단된다.

### 금지

- `adb uninstall`
- `pm clear` / 앱 데이터 삭제
- 이전에 빌드해 둔 APK 재사용
- 소스만 확인하고 재빌드 생략

---

## 3. 5번 "APK 내용 확인" 방법

APK 는 zip 이므로 dex 를 풀어 문자열을 직접 확인한다.

```bash
unzip -oq app-debug.apk 'classes*.dex' -d /tmp/apkx
cd /tmp/apkx
for pat in "$@"; do
  n=$(grep -ac "$pat" classes*.dex | awk -F: '{s+=$2} END{print s+0}')
  echo "$pat: $n"
done
```

**주의 — 실제로 겪은 함정 2 가지**

| 함정 | 증상 | 대응 |
|---|---|---|
| `strings` 명령 부재(Git Bash) | 모든 패턴이 0 으로 나와 **정상 APK 를 불량으로 오판** | `grep -a` 사용 |
| 검증 자체가 고장났는지 모름 | 위와 구분 불가 | **반드시 알려진 문자열(`MainActivity` 등)을 함께 검사**해 방법이 동작하는지 먼저 확인 |

기대 예시(duration 기능):

```
MainActivity          7   ← 대조군: >0 이어야 방법이 정상
callLogMatchDeltaSec  8
durationSec           9
duration_sec          2
MIGRATION_4_5         7
UPLOAD_DURATION       1
```

하나라도 0 이면 **설치하지 않고 중단**한다.

---

## 4. 산출물 (별도 PR 에서 구현)

- [ ] `scripts/verifyAndInstallApk.sh` — 1~6 단계 자동화, 실패 시 비영 종료
  - 인자로 필수 문자열 목록을 받고, 대조군 문자열을 항상 함께 검사
  - 설치 직전 HEAD·SHA-256·검증 결과를 콘솔에 요약 출력
- [ ] `docs/ops/apk-install-gate.md` — 수동 절차 문서(스크립트 못 쓰는 환경용)
- [ ] Room 스키마 버전이 올라간 릴리스는 **롤백 불가**임을 게이트 출력에 경고로 포함
      (v5 → v4 다운그레이드 불가 — 구버전 APK 는 v5 DB 를 열지 못한다)

---

## 5. 범위 밖

- CI 자동 배포
- 릴리스 APK 서명·스토어 업로드
- Android 소스 변경
- `android/app/build/**` 과거 커밋 히스토리 rewrite
