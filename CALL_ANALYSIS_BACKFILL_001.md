# CALL-ANALYSIS-BACKFILL-001 — `analysis_status='queued'` 적체 소급 처리 계획

> 상태: **BACKLOG (미착수)** · 등록 2026-07-31
> 선행 조건: CALL-ANALYSIS-QUEUE-002(완료) · QUEUE-003(진행) · duration_sec NULL(미착수)
> **운영 DB 쓰기를 포함하므로 PR 하나로 끝낼 작업이 아니다. 별도 운영 계획으로 관리한다.**

---

## 1. 규모 (실측)

배포된 감시 지표로 처음 전체 규모를 측정했다.

```
GET /api/health (Bearer INTERNAL_API_TOKEN)
→ analysisQueue: { stuckCount: 360, oldestAgeMinutes: 188712 }
```

| 항목 | 값 |
|---|---|
| 적체 건수 | **360건** (`analysis_status='queued'` + `stt_status='completed'` + 1시간 초과) |
| 최고령 | **188,712분 ≈ 131일** |
| 측정 시각 | 2026-07-31 (merge `562ae62` 직후) |

> 초기 보고했던 33건은 **최근 100건 표본 내 수치**였다. 전체는 360건이다.

### 사유 분포 (최근 100건 표본 기준 추정)

| 사유 | 표본 내 건수 | 비율 |
|---|---|---|
| `repetitive_transcript` | 22 | 67% |
| `short_transcript` | 9 | 27% |
| 둘 다 | 1 | 3% |
| transcript 조회 실패 | 1 | 3% |

**360건 전체의 사유 분포는 미측정.** 착수 전 전수 조회 필요.

---

## 2. 왜 단순 UPDATE 가 아닌가

### 2-1. 비용 — 재분석 여부 결정 필요

| 선택지 | 내용 | 비용 | 적합 대상 |
|---|---|---|---|
| **(a) 재라벨만** | `queued → warning` + 보류 사유 기록. LLM 미실행 | 0 | 진짜 불확실 건 |
| **(b) 재분석** | `runAnalysisForCall()` 재실행 | LLM 360회 | QUEUE-003 이후 정상 판정될 건 |
| **(c) 혼합** | 사유별로 분기 | 부분 | **권장** |

QUEUE-003 으로 `repetitive` 임계치가 2→3 회로 완화되면, 표본 기준 **repetitive 22건 중 20건이 정상 분석 대상**이 된다. 360건 전체로 환산하면 상당수가 (b) 대상이다.

**따라서 QUEUE-003 배포 후 재판정을 먼저 돌려 (a)/(b) 를 나눈 뒤 착수해야 한다.** 지금 (a) 로 일괄 종결하면, 곧 정상 분석 가능해질 건까지 "분석 보류"로 굳는다.

### 2-2. `pending_events` 중복 위험

이 360건은 STT 직후 `updatePendingEventAfterStt()` 로 **이미 uncertain 요약이 푸시되어 있다.**

- 소급 시 `pending_events` 를 재푸시하면 **운영자에게 중복 알림**이 간다
- `pending_events` 는 3일 TTL 파생 알림이므로 오래된 건은 이미 만료됐다 — 재푸시할 이유도 없다
- **소급은 `calls` 만 갱신할 것.** `pending_events` 는 건드리지 않는다

### 2-3. UI 반영

`calls.analysis_status` 가 `queued → warning` 으로 바뀌면 univer-ops 통화내역에서:

- 분석 배지: (없음) → **"주의"** (`callHistoryFormat.ts` `analysisBadge`)
- 요약 칸: "요약 없음" → 보류 안내 문구

360건이 한꺼번에 바뀌므로 **운영자에게 사전 공지가 필요하다.** 예고 없이 과거 통화 표시가 일괄 변경되면 장애로 오인된다.

### 2-4. 워크플로 부작용

`warning` 은 `analysisStatusIsUsableForWorkflow()` 에서 **true** 다(QUEUE-002 조사 참조).
자동 경로는 영향 없으나, 소급 후 운영자가 과거 통화에서 **수동 workflow 실행** 시 이전과 다르게 생성이 진행된다. 자동 오동작은 아니지만 사전 인지 필요.

---

## 3. 착수 조건 (전부 충족 후 시작)

- [ ] QUEUE-002 배포 후 **신규 queued 증가 0** 확인 (`stuckCount` 가 360 에서 정지)
- [ ] QUEUE-003(repetitive 완화) 배포 완료
- [ ] `duration_sec` NULL 원인 해결 — `short_audio`/`hallucination` 판정이 죽어 있어 재판정 결과가 왜곡된다
- [ ] 360건 **전수** 사유 분포 조사 (표본 아님)
- [ ] 재분석 대상 건수 × LLM 단가로 비용 산정
- [ ] 운영자 사전 공지

> **유입을 먼저 막고, 오탐을 줄이고, 마지막에 청소한다.** 순서를 지키지 않으면 밑 빠진 독이 된다.

---

## 4. 실행 계획 (안)

### Phase 1 — 전수 조사 (읽기 전용)

360건의 `id / created_at / transcript 길이 / 재판정 결과` 를 산출한다.
QUEUE-003 임계치를 적용해 (a) 보류 유지 / (b) 재분석 대상으로 분류.

산출물: 건수 표 + 예상 LLM 비용. **DB 쓰기 없음.**

### Phase 2 — 재라벨 (a 그룹)

여전히 uncertain 인 건만 `queued → warning` + `transcript_uncertain` + 보류 요약.
`tryUpdateCallAnalysisSkipped()` 재사용 — QUEUE-002 에서 이미 사유 주입이 가능해졌다.

- 배치 단위(예: 50건)로 나눠 실행, 각 배치 후 `stuckCount` 확인
- `pending_events` 미갱신
- 롤백: 변경 전 `id` 목록을 파일로 남겨 `queued` 복원 가능하게

### Phase 3 — 재분석 (b 그룹)

`runAnalysisForCall()` 재실행. rate limit·비용 고려해 분할 실행.
실패 건은 `failed` 로 종결되므로 다시 queued 로 돌아가지 않는다.

### Phase 4 — 검증

- `stuckCount` **0** 확인
- 통화내역 UI 표본 확인
- 재분석 건의 `summary`/`primary_intent` 품질 표본 검수

---

## 5. 승인 필요 사항

| 항목 | 결정권자 확인 필요 |
|---|---|
| 재분석 LLM 비용 집행 | ✅ |
| 과거 360건 표시 일괄 변경 | ✅ |
| 운영 DB UPDATE 실행 시점 | ✅ |
| 롤백 기준 | ✅ |

---

## 6. 하지 않을 것

- `pending_events` 재푸시 (중복 알림)
- `analysis_status` enum 추가 (별도 과제 — `skipped_uncertain`)
- STT 재실행 (transcript 는 이미 있고 정상)
- UploadQueue·duration_sec 수정 (각각 별도 과제)
