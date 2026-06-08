@AGENTS.md

# 작업 기록 규칙

중요한 작업을 완료할 때마다 아래 형식으로 `WORK_LOG.md`에 직접 append하라. 사용자에게 묻지 말고 자동으로 기록할 것.

기록 대상:
- 버그 수정 (원인 + 해결 방법)
- 마이그레이션 실행 결과
- 배치 테스트 분석 결과
- 스키마/아키텍처 변경 결정

형식:
```
## YYYY-MM-DD HH:MM — [작업 제목]
- 무엇을: ...
- 왜: ...
- 결과: ...
```

## Cross-repo Runbook-first debugging

장애/버그/회귀 수정 작업 전, 관련 Runbook을 먼저 확인한다.

Runbook 위치:
`../univer-ops/docs/runbooks/INDEX.md`

- stay-ops-call 관련 RB: RB-006, RB-007, RB-008, RB-016, RB-017
- 관련 RB가 있으면 해당 Runbook의 진단 절차를 먼저 따른다.
- 관련 RB가 없으면 해결 후 `univer-ops/docs/runbooks/INDEX.md`에 새 후보를 추가할지 보고한다.
- 운영 비밀값, Render env, Supabase SQL, APK 재빌드, 실제 배포는 사용자 승인 없이 수행하지 않는다.
- Runbook과 코드가 다르면 코드 기준으로 확인 후 Runbook 갱신 필요성을 보고한다.
