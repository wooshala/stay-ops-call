# 배포 체크리스트 (운영)

## 목적

- [ ] 프로덕션에 **실수로 무방비 배포**되지 않았는지 확인한다.
- [ ] 내부 HTTP API(`INTERNAL_API_TOKEN` + Bearer)와 Ops UI(서버 액션)가 **의도한 보안 경계** 안에서 동작하는지 검증한다.
- [ ] 통화 **분석**(`analysis_status`)과 **워크플로 레코드 생성**(`workflow_status`)이 구분되어 기대대로 갱신되는지 확인한다.

## 필수 환경 변수 (ENV)

앱 서버(Next.js)에 설정한다. 값은 비밀 저장소·CI 시크릿 등으로 관리한다.

### Supabase / 코어

- [ ] `NEXT_PUBLIC_SUPABASE_URL`
- [ ] `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- [ ] `SUPABASE_SERVICE_ROLE_KEY` (서버 전용, 클라이언트 번들에 넣지 않음)
- [ ] `SUPABASE_RECORDINGS_BUCKET` (미설정 시 기본 `recordings` — 버킷 존재 확인)

### 내부 HTTP API (운영 권장)

- [ ] `INTERNAL_API_TOKEN` — 비어 있지 않은 강한 랜덤 문자열. **`NEXT_PUBLIC_` 접두사 금지.**
- [ ] 프로덕션(`NODE_ENV=production`)에서 토큰 미설정 시, 보호 API는 **401**으로 막힌다(`lib/auth/internalApi.ts`).

### STT / LLM (배포 환경에 맞게)

- [ ] `STT_PROVIDER` (`openai` / `mock` 등) 및 `OPENAI_API_KEY` 등 README `docs`·`README.md` 표와 일치
- [ ] `LLM_PROVIDER` 등 분석 경로에 필요한 변수 설정

### 혼동 방지

- [ ] `proxy.ts`의 `INTERNAL_API_KEY` / `x-api-key`는 **미들웨어에 연결되어 있지 않아** 현재 트래픽에서 사용되지 않는다. 운영 인증의 기준은 **`INTERNAL_API_TOKEN` + Bearer**이다.

## API 보호 검증

보호 대상(구현 기준):

- `GET /api/ops/queue`
- `POST /api/calls/{id}/analyze`
- `POST /api/calls/{id}/workflow`

인증: `Authorization: Bearer <INTERNAL_API_TOKEN>` (앱에 설정한 값과 일치해야 함).

`INTERNAL_API_TOKEN`이 **설정된** 상태에서:

- [ ] **토큰 없이** 호출 → **401**, 본문 `{ "error": "Unauthorized" }`
- [ ] **잘못된** Bearer → **401**
- [ ] **올바른** Bearer → **200** (queue는 `type=failed|review|retry` 쿼리 필요)

예시 (`BASE`를 실제 오리진으로 바꿈):

```bash
export INTERNAL_API_TOKEN='...'

# 401 기대 (헤더 없음)
curl -sS -o /dev/null -w "%{http_code}\n" "$BASE/api/ops/queue?type=failed"

# 401 기대 (잘못된 토큰)
curl -sS -o /dev/null -w "%{http_code}\n" \
  -H "Authorization: Bearer wrong" "$BASE/api/ops/queue?type=failed"

# 200 기대
curl -sS -H "Authorization: Bearer $INTERNAL_API_TOKEN" \
  "$BASE/api/ops/queue?type=failed"

curl -sS -X POST \
  -H "Authorization: Bearer $INTERNAL_API_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{}' \
  "$BASE/api/calls/<CALL_ID>/analyze"

curl -sS -X POST \
  -H "Authorization: Bearer $INTERNAL_API_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{}' \
  "$BASE/api/calls/<CALL_ID>/workflow"
```

개발 환경에서만: `INTERNAL_API_TOKEN` **미설정**이면 위 라우트는 우회될 수 있으며, 서버 콘솔에  
`[auth][internal-api] INTERNAL_API_TOKEN missing; bypass enabled in development` 경고가 난다. **운영 배포 전에는 토큰을 반드시 설정할 것.**

## Ops Queue 동작 검증

경로: **`/ops/queue`** (`app/ops/queue`). 데이터·재실행은 서버 액션(`app/ops/queue/actions.ts`, `app/calls/actions.ts`)을 통해 처리되며 브라우저에 `INTERNAL_API_TOKEN`이 내려가지 않는다.

- [ ] **Failed / Needs Review / Retry** 탭 전환 시 로딩 후 테이블 또는 empty state 표시
- [ ] 행의 **Call ID** 링크가 **`/calls/{id}`**로 이동하는지 확인
- [ ] **Re-run Analysis** 클릭 시 버튼 비활성(대기) → 완료 후 **성공/실패 배너** 표시
- [ ] **Re-run Workflow** 동일
- [ ] 작업 후 목록이 **다시 로드(refetch)** 되어 상태 배지가 갱신되는지 확인
- [ ] 대상이 없을 때 **empty state**(점선 박스 + 탭별 메시지) 표시

## 서버 액션 보안 경계

- [ ] **Server Action은 Bearer 검증과 별도 경로**이다. HTTP 라우트만 `assertInternalApiAuthorized`를 탄다.
- [ ] 브라우저는 동일 오리진에서 액션을 호출할 수 있으므로, **토큰을 클라이언트에 싣지 않아도** 액션 자체는 세션 없이 호출 가능한 모델이다.
- [ ] 운영에서 추가 보호가 필요하면 다음 중 실제로 적용했는지 확인한다:
  - [ ] **내부망** / VPN 뒤에만 앱 노출
  - [ ] **관리자 인증**(세션·IdP 등) — 현재 코드베이스의 최소 Bearer와는 별개로 검토
  - [ ] **Reverse proxy**에서 IP 허용목록, 경로 제한, mTLS 등

자세한 설명: `docs/OPS_QUEUE_SECURITY.md`.

## 데이터/DB 상태

- [ ] Supabase에 README에 안내된 **마이그레이션 순서**가 프로덕션에 적용되어 있다(특히 `calls`, workflow 관련 테이블).
- [ ] `calls`에 **`analysis_status`**와 **`workflow_status`**가 각각 존재하며, 장애 구분 시 둘을 함께 본다(`docs/CALL_STATUS_MODEL.md` 참고).
- [ ] Storage 녹음 버킷이 배포 환경 변수와 일치한다.

## 분석 파이프라인

- [ ] 샘플 통화 업로드 또는 기존 데이터로 **STT → 분석 완료**까지 `analysis_status`가 기대 상태로 진행되는지 확인.
- [ ] 분석 실패·재시도 정책이 운영 기대와 맞는지 확인(코드: `lib/pipeline/runAnalysisForCall.ts` 등).

## Workflow 생성

- [ ] `primary_intent`에 따라 `operation_cases` / `service_requests` / `reservation_leads` 등이 생성되는지 확인(`lib/workflows/rules.ts` 매핑).
- [ ] **`operation_cases.severity`**는 DB 제약상 **`medium` | `high`만** 허용된다. `normal` 등 금지(`docs/WORKFLOW_RECOVERY_GUIDE.md`, `lib/workflows/contract.ts`).
- [ ] **`POST /api/calls/{id}/workflow`**(Bearer) 또는 Ops UI **Re-run Workflow**로 `workflow_status` 재처리가 가능한지 필요 시 확인.

## 스크립트 실행 환경

저장소 내 **HTTP로 analyze를 호출**하는 스크립트 예:

- `reprocess-workflow.js`
- `scripts/reprocess-all.js`
- (로컬 디버그) `.artifacts/find-and-test-empty-summary.mjs`, `.artifacts/debug-analyze-one-call.mjs`

- [ ] 앱 서버에 `INTERNAL_API_TOKEN`을 설정했다면, 스크립트 실행 셸에도 **동일 값**을 `export INTERNAL_API_TOKEN=...` 하여 프로세스 환경에 넣는다(스크립트는 설정 시에만 `Authorization` 헤더를 붙임).
- [ ] 스크립트 내 하드코딩된 URL·포트가 배포 대상과 맞는지 확인한다.

## 로그 및 모니터링

- [ ] 인증 거부 시 서버 로그에 `[auth][internal-api]` 및 라우트별 로그(예: `[api][ops-queue][auth] rejected`)가 남는지 샘플 확인.
- [ ] 프로덕션에서 토큰 누락 시: `[auth][internal-api] INTERNAL_API_TOKEN is required in production` 에러 로그 확인.

## Known Risks

1. **Server Action 보호 한계** — Bearer로 막은 HTTP API와 달리, 동일 오리진에서 액션 호출 가능. 네트워크·인증·프록시 경계로 보완 필요.
2. **`INTERNAL_API_TOKEN` 단일 공유 시크릿** — 유출 시 전체 내부 HTTP API가 위험. 주기적 회전·최소 권한 원칙 권장.
3. **`proxy.ts`의 `INTERNAL_API_KEY`** — 현재 **미들웨어 미연결**로 실제 요청에 사용되지 않을 수 있음. 문서·운영 런북에서 Bearer 토큰을 기준으로 통일할 것.

## 배포 전 최종 체크

- [ ] `INTERNAL_API_TOKEN` 프로덕션 값 설정 및 curl로 **401/200** 시나리오 확인 완료
- [ ] `/ops/queue` 수동 시나리오(탭·링크·Re-run·배너·empty) 확인
- [ ] 서버 액션에 대한 **네트워크/인증** 보완 여부 합의 및 적용
- [ ] DB 마이그레이션·Storage·필수 ENV 반영

## 최종 결론 기준

> 모든 체크 완료 시 → **"운영 배포 가능 상태"**  
> 하나라도 실패 시 → **"배포 금지"**
