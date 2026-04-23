"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";

import type { BatchJobItemRow, BatchJobRow } from "@/lib/types/database";
import type { BatchPipelineMode, BatchRunSummary } from "@/lib/batch-test/types";

const INTENT_OPTIONS = [
  { value: "", label: "전체" },
  { value: "maintenance", label: "maintenance" },
  { value: "service_request", label: "service_request" },
  { value: "reservation_inquiry", label: "reservation_inquiry" },
  { value: "rate_inquiry", label: "rate_inquiry" },
  { value: "extension_request", label: "extension_request" },
  { value: "complaint", label: "complaint" },
  { value: "other", label: "other" },
];

const PIPELINE_OPTIONS: { value: BatchPipelineMode; label: string }[] = [
  { value: "stt", label: "STT만 (비용 최소)" },
  { value: "stt_analysis", label: "STT + 분석" },
  { value: "full", label: "전체 (STT + 분석 + 워크플로)" },
];

const LIMIT_OPTIONS: { value: string; label: string }[] = [
  { value: "10", label: "최대 10" },
  { value: "50", label: "최대 50" },
  { value: "100", label: "최대 100" },
  { value: "", label: "제한 없음 (최대 500)" },
];

const POLL_MS = 2500;

function toOperatorStatus(status: string | null | undefined): string {
  if (status === "pending") return "대기 중";
  if (status === "running") return "처리 중";
  if (status === "completed") return "처리 완료";
  if (status === "failed") return "처리 실패";
  return "상태 확인 필요";
}

function formatElapsed(ms: number): string {
  const sec = Math.max(0, Math.floor(ms / 1000));
  const min = Math.floor(sec / 60);
  const remSec = sec % 60;
  return `${min}분 ${remSec}초`;
}

export default function BatchTestPage() {
  const [fixturesDir, setFixturesDir] = useState<string>("");
  const [fileList, setFileList] = useState<Array<{ name: string; bytes: number }>>(
    [],
  );
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [loadingList, setLoadingList] = useState(true);
  const [starting, setStarting] = useState(false);
  const [jobId, setJobId] = useState<string | null>(null);
  const [job, setJob] = useState<BatchJobRow | null>(null);
  const [items, setItems] = useState<BatchJobItemRow[]>([]);
  const [summary, setSummary] = useState<BatchRunSummary | null>(null);
  const [runMeta, setRunMeta] = useState<{
    pipeline?: BatchPipelineMode;
    truncated?: boolean;
    cap?: number;
    requestedFileCount?: number;
  } | null>(null);
  const [failuresOnly, setFailuresOnly] = useState(false);
  const [intentFilter, setIntentFilter] = useState("");
  const [pipelineChoice, setPipelineChoice] =
    useState<BatchPipelineMode>("full");
  const [limitChoice, setLimitChoice] = useState<string>("100");

  const loadFiles = useCallback(async () => {
    setLoadingList(true);
    try {
      const res = await fetch("/api/batch-test/files");
      const data = (await res.json()) as {
        fixturesDir?: string;
        files?: Array<{ name: string; bytes: number }>;
      };
      setFixturesDir(data.fixturesDir ?? "");
      setFileList(Array.isArray(data.files) ? data.files : []);
    } catch {
      setFileList([]);
    } finally {
      setLoadingList(false);
    }
  }, []);

  useEffect(() => {
    void loadFiles();
  }, [loadFiles]);

  useEffect(() => {
    if (!jobId) return;

    let stopped = false;
    let timer: ReturnType<typeof setInterval> | null = null;

    const tick = async () => {
      if (stopped) return;
      const res = await fetch(`/api/batch-test/jobs/${jobId}`);
      if (!res.ok) return;
      const data = (await res.json()) as {
        job: BatchJobRow;
        items: BatchJobItemRow[];
        summary: BatchRunSummary;
      };
      setJob(data.job);
      setItems(data.items ?? []);
      setSummary(data.summary ?? null);
      if (data.job.status === "completed" || data.job.status === "failed") {
        stopped = true;
        if (timer) clearInterval(timer);
      }
    };

    void (async () => {
      await tick();
      if (stopped) return;
      timer = setInterval(() => void tick(), POLL_MS);
    })();

    return () => {
      stopped = true;
      if (timer) clearInterval(timer);
    };
  }, [jobId]);

  const toggle = (name: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  };

  const selectAll = () => {
    setSelected(new Set(fileList.map((f) => f.name)));
  };

  const clearSel = () => setSelected(new Set());

  const runBatch = async () => {
    const files = Array.from(selected);
    if (files.length === 0) return;
    setStarting(true);
    setJobId(null);
    setJob(null);
    setItems([]);
    setSummary(null);
    setRunMeta(null);
    try {
      const limitParam =
        limitChoice === "" ? undefined : Number.parseInt(limitChoice, 10);

      let runRes: Response;
      try {
        runRes = await fetch("/api/batch-test/run", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            files,
            pipeline: pipelineChoice,
            ...(limitParam != null && Number.isFinite(limitParam)
              ? { limit: limitParam }
              : {}),
          }),
        });
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        alert(`fetch 실패: 배치 run 요청을 보낼 수 없습니다. (${msg})`);
        return;
      }

      if (!runRes.ok) {
        const errText = await runRes.text().catch(() => "");
        alert(
          `batch run HTTP 오류: ${runRes.status}${errText ? ` — ${errText.slice(0, 800)}` : ""}`,
        );
        return;
      }

      let runData: {
        ok?: boolean;
        job_id?: string;
        total_count?: number;
        meta?: typeof runMeta;
        error?: string;
      };
      try {
        runData = (await runRes.json()) as typeof runData;
      } catch {
        alert("batch run 응답 JSON 파싱 실패: 유효한 JSON이 아닙니다.");
        return;
      }

      setRunMeta(runData.meta ?? null);
      const jid = runData.job_id;
      if (!jid) {
        alert("job_id 없음");
        return;
      }

      let startRes: Response;
      try {
        startRes = await fetch(`/api/batch-test/jobs/${jid}/start`, {
          method: "POST",
        });
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        alert(`fetch 실패: job start 요청을 보낼 수 없습니다. (${msg})`);
        return;
      }

      if (!startRes.ok) {
        const errText = await startRes.text().catch(() => "");
        alert(
          `job start HTTP 오류: ${startRes.status}${errText ? ` — ${errText.slice(0, 800)}` : ""}`,
        );
        return;
      }

      let startData: {
        ok?: boolean;
        accepted?: boolean;
        reason?: string;
      };
      try {
        startData = (await startRes.json()) as typeof startData;
      } catch {
        alert("job start 응답 JSON 파싱 실패: 유효한 JSON이 아닙니다.");
        return;
      }

      if (startData.accepted === false) {
        console.warn("start skipped:", startData.reason);
      }

      setJobId(jid);
    } finally {
      setStarting(false);
    }
  };

  const visibleItems = useMemo(() => {
    let rows = items;
    if (failuresOnly) {
      rows = rows.filter((r) => r.status === "failed");
    }
    if (intentFilter) {
      rows = rows.filter((r) => r.primary_intent === intentFilter);
    }
    return rows;
  }, [items, failuresOnly, intentFilter]);

  const intentEntries = Object.entries(summary?.intentDistribution ?? {}).sort(
    (a, b) => b[1] - a[1],
  );

  const startedAtMs = useMemo(() => {
    if (!job?.started_at) return null;
    const ms = new Date(job.started_at).getTime();
    return Number.isFinite(ms) ? ms : null;
  }, [job?.started_at]);

  const elapsedMs = useMemo(() => {
    if (!startedAtMs) return null;
    return Date.now() - startedAtMs;
  }, [startedAtMs, job?.status, items.length]);

  const isRunning = job?.status === "running";
  const delayed = Boolean(isRunning && elapsedMs != null && elapsedMs >= 2 * 60 * 1000);
  const needCheck = Boolean(isRunning && elapsedMs != null && elapsedMs >= 5 * 60 * 1000);

  const progressText = useMemo(() => {
    if (!job) return "";
    if (job.total_count <= 0) return "처리 대상을 준비 중입니다.";
    if (job.processed_count <= 0) return `${job.total_count}건 중 처리 시작을 기다리는 상태입니다.`;
    if (job.processed_count < job.total_count) {
      return `${job.total_count}건 중 ${job.processed_count}건 완료, 계속 처리 중입니다.`;
    }
    return `${job.total_count}건 처리가 완료되었습니다.`;
  }, [job]);

  const successFailText = useMemo(() => {
    if (!job) return "";
    if (job.success_count === 0 && job.failed_count === 0) return "아직 완료된 파일이 없습니다.";
    if (job.success_count > 0 && job.failed_count === 0) return `정상 완료 ${job.success_count}건`;
    if (job.success_count === 0 && job.failed_count > 0) return `실패 ${job.failed_count}건`;
    return `정상 완료 ${job.success_count}건, 실패 ${job.failed_count}건`;
  }, [job]);

  return (
    <main className="mx-auto max-w-6xl px-4 py-8">
      <h1 className="text-2xl font-semibold">배치 처리 운영 화면</h1>
      <p className="mt-2 max-w-3xl text-sm text-zinc-600 dark:text-zinc-400">
        <code className="rounded bg-zinc-100 px-1 dark:bg-zinc-900">batch-test/fixtures</code>
        에 오디오를 넣고 실행합니다. 처리 작업을 시작하면 이 화면이{" "}
        <strong>{POLL_MS / 1000}초</strong>마다 상태를 자동 확인합니다.
      </p>
      {fixturesDir ? (
        <p className="mt-1 font-mono text-xs text-zinc-500">{fixturesDir}</p>
      ) : null}

      <section className="mt-8 border border-zinc-200 p-4 dark:border-zinc-800">
        <h2 className="text-lg font-medium">테스트 파일 선택</h2>
        {loadingList ? (
          <p className="mt-2 text-sm text-zinc-500">불러오는 중…</p>
        ) : fileList.length === 0 ? (
          <p className="mt-2 text-sm text-zinc-500">
            오디오 파일이 없습니다. 디렉터리를 만들고 .mp3 등 파일을 넣은 뒤 새로고침하세요.
          </p>
        ) : (
          <ul className="mt-3 max-h-64 space-y-1 overflow-auto text-sm">
            {fileList.map((f) => (
              <li key={f.name} className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={selected.has(f.name)}
                  onChange={() => toggle(f.name)}
                  id={`f-${f.name}`}
                />
                <label htmlFor={`f-${f.name}`} className="cursor-pointer">
                  {f.name}{" "}
                  <span className="text-zinc-400">
                    ({(f.bytes / 1024).toFixed(1)} KB)
                  </span>
                </label>
              </li>
            ))}
          </ul>
        )}
        <div className="mt-4 flex flex-wrap items-end gap-4">
          <label className="flex flex-col gap-1 text-xs text-zinc-500">
            처리 방식
            <select
              className="rounded border border-zinc-300 bg-white px-2 py-1.5 text-sm text-zinc-900 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100"
              value={pipelineChoice}
              onChange={(e) =>
                setPipelineChoice(e.target.value as BatchPipelineMode)
              }
            >
              {PIPELINE_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-xs text-zinc-500">
            최대 처리 개수
            <select
              className="rounded border border-zinc-300 bg-white px-2 py-1.5 text-sm text-zinc-900 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100"
              value={limitChoice}
              onChange={(e) => setLimitChoice(e.target.value)}
            >
              {LIMIT_OPTIONS.map((o) => (
                <option key={o.value || "all"} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </label>
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          <button
            type="button"
            className="rounded border border-zinc-300 px-3 py-1 text-sm dark:border-zinc-600"
            onClick={selectAll}
            disabled={fileList.length === 0}
          >
            전체 선택
          </button>
          <button
            type="button"
            className="rounded border border-zinc-300 px-3 py-1 text-sm dark:border-zinc-600"
            onClick={clearSel}
          >
            선택 해제
          </button>
          <button
            type="button"
            className="rounded bg-zinc-900 px-4 py-2 text-sm text-white disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900"
            onClick={() => void runBatch()}
            disabled={starting || selected.size === 0}
          >
            {starting ? "시작 중…" : "처리 작업 시작"}
          </button>
          <button
            type="button"
            className="rounded border border-zinc-300 px-3 py-1 text-sm dark:border-zinc-600"
            onClick={() => void loadFiles()}
          >
            목록 새로고침
          </button>
        </div>
      </section>

      {jobId && job ? (
        <section className="mt-6 rounded border border-zinc-300 bg-zinc-50 p-4 dark:border-zinc-700 dark:bg-zinc-900/40">
          <h2 className="text-sm font-semibold">현재 상태 요약</h2>
          <p className="mt-1 font-mono text-xs text-zinc-500">{jobId}</p>
          <dl className="mt-3 grid gap-2 text-sm sm:grid-cols-2 lg:grid-cols-4">
            <div>
              <dt className="text-zinc-500">처리 상태</dt>
              <dd className="font-medium">{toOperatorStatus(job.status)}</dd>
            </div>
            <div>
              <dt className="text-zinc-500">진행</dt>
              <dd className="font-medium">
                {job.processed_count} / {job.total_count}
              </dd>
            </div>
            <div>
              <dt className="text-zinc-500">성공 / 실패</dt>
              <dd className="font-medium">
                {job.success_count} / {job.failed_count}
              </dd>
            </div>
            <div>
              <dt className="text-zinc-500">경과 시간</dt>
              <dd className="font-medium">
                {elapsedMs != null ? formatElapsed(elapsedMs) : "시작 대기 중"}
              </dd>
            </div>
          </dl>
          <div className="mt-3 space-y-1 text-sm">
            <p>처리 작업이 시작되었습니다.</p>
            <p>{progressText}</p>
            <p>{successFailText}</p>
            {delayed ? (
              <p className="text-amber-700 dark:text-amber-400">
                2분 이상 같은 상태입니다. 지연 가능성이 있습니다.
              </p>
            ) : null}
            {needCheck ? (
              <p className="text-red-700 dark:text-red-400">
                5분 이상 같은 상태입니다. 점검이 필요할 수 있습니다. 새로고침 후 다시 확인해
                주세요.
              </p>
            ) : null}
            {job.status === "completed" ? (
              <p>
                처리 완료 후 파일 검수에서 결과를 확인하세요. (REVIEW / FAILED / PASSED)
              </p>
            ) : null}
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            <Link
              href="/file-review"
              className="rounded bg-zinc-900 px-3 py-1 text-sm text-white dark:bg-zinc-100 dark:text-zinc-900"
            >
              파일 검수로 이동
            </Link>
            <button
              type="button"
              className="rounded border border-zinc-300 px-3 py-1 text-sm dark:border-zinc-600"
              onClick={() => void loadFiles()}
            >
              목록 새로고침
            </button>
            <button
              type="button"
              className="rounded border border-zinc-300 px-3 py-1 text-sm dark:border-zinc-600"
              onClick={() => void runBatch()}
              disabled={starting || selected.size === 0}
            >
              다시 실행
            </button>
          </div>
          {job.error_message ? (
            <p className="mt-2 text-sm text-red-600 dark:text-red-400">
              {job.error_message}
            </p>
          ) : null}
        </section>
      ) : null}

      {summary && job ? (
        <section className="mt-8 rounded border border-zinc-300 bg-zinc-50 p-4 dark:border-zinc-700 dark:bg-zinc-900/40">
          <h2 className="text-lg font-semibold">처리 결과 요약</h2>
          {runMeta?.truncated ? (
            <p className="mt-2 text-sm text-amber-700 dark:text-amber-400">
              선택 {runMeta.requestedFileCount}개 중 상한({runMeta.cap}개)으로 잘라
              처리했습니다.
            </p>
          ) : null}
          <dl className="mt-3 grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-3">
            <div>
              <dt className="text-zinc-500">처리 방식</dt>
              <dd className="font-medium">
                {summary.pipeline === "full"
                  ? "전체 분석"
                  : summary.pipeline === "stt_analysis"
                    ? "음성 변환 + 분석"
                    : "음성 변환만"}
              </dd>
            </div>
            <div>
              <dt className="text-zinc-500">처리 건수</dt>
              <dd className="font-medium">{summary.total}</dd>
            </div>
            <div>
              <dt className="text-zinc-500">성공 / 실패</dt>
              <dd className="font-medium">
                {summary.successCount} / {summary.failureCount}
              </dd>
              <p className="mt-1 text-xs text-zinc-500">
                {summary.successCount === 0 && summary.failureCount === 0
                  ? "아직 완료된 파일이 없습니다."
                  : summary.successCount > 0 && summary.failureCount === 0
                    ? `정상 완료 ${summary.successCount}건`
                    : summary.successCount === 0 && summary.failureCount > 0
                      ? `실패 ${summary.failureCount}건`
                      : `정상 완료 ${summary.successCount}건, 실패 ${summary.failureCount}건`}
              </p>
            </div>
            <div className="sm:col-span-2 lg:col-span-3">
              <dt className="text-zinc-500">primary_intent 분포</dt>
              <dd className="mt-1 font-mono text-xs">
                {intentEntries.length === 0 ? (
                  <span className="text-zinc-400">(아직 없음)</span>
                ) : (
                  intentEntries.map(([k, v]) => (
                    <span key={k} className="mr-3 inline-block">
                      {k}: {v}
                    </span>
                  ))
                )}
              </dd>
            </div>
            <div>
              <dt className="text-zinc-500">room_no 추출률</dt>
              <dd className="font-medium">
                {summary.roomNo.eligible === 0
                  ? "— (분석 완료 건 없음)"
                  : `${summary.roomNo.ratePercent}% (${summary.roomNo.withRoomNo}/${summary.roomNo.eligible})`}
              </dd>
            </div>
            <div>
              <dt className="text-zinc-500">워크플로 (full만 해당)</dt>
              <dd className="text-sm leading-relaxed">
                {summary.pipeline !== "full" ? (
                  <span className="text-zinc-400">스킵됨</span>
                ) : (
                  <>
                    단계 성공률:{" "}
                    {summary.workflow.eligible === 0
                      ? "—"
                      : `${summary.workflow.stepRatePercent}% (${summary.workflow.stepSuccess}/${summary.workflow.eligible})`}
                    <br />
                    레코드 생성률:{" "}
                    {summary.workflow.eligible === 0
                      ? "—"
                      : `${summary.workflow.recordRatePercent}% (${summary.workflow.createdRecord}/${summary.workflow.eligible})`}
                  </>
                )}
              </dd>
            </div>
          </dl>
          <p className="mt-4 text-sm text-zinc-600 dark:text-zinc-300">
            분석이 끝난 파일은 파일 검수 화면에서 REVIEW / FAILED / PASSED 상태로 확인할 수
            있습니다.
          </p>
          <div className="mt-3 flex gap-2">
            <Link
              href="/file-review"
              className="rounded border border-zinc-300 px-3 py-1 text-sm dark:border-zinc-600"
            >
              파일 검수로 이동
            </Link>
            <p className="self-center text-xs text-zinc-500">
              팁: 이번 처리 결과는 파일명/상태 필터로 좁혀서 확인하세요.
            </p>
          </div>
        </section>
      ) : null}

      {items.length > 0 ? (
        <section className="mt-10">
          <h2 className="text-lg font-medium">파일별 상세 결과</h2>
          <div className="mt-3 flex flex-wrap items-center gap-4 text-sm">
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={failuresOnly}
                onChange={(e) => setFailuresOnly(e.target.checked)}
              />
              실패한 것만 보기
            </label>
            <label className="flex items-center gap-2">
              <span className="text-zinc-500">intent</span>
              <select
                className="rounded border border-zinc-300 bg-white px-2 py-1 dark:border-zinc-600 dark:bg-zinc-900"
                value={intentFilter}
                onChange={(e) => setIntentFilter(e.target.value)}
              >
                {INTENT_OPTIONS.map((o) => (
                  <option key={o.value || "all"} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </label>
            <span className="text-zinc-500">
              표시 {visibleItems.length} / 전체 {items.length}
            </span>
          </div>

          <div className="mt-4 overflow-x-auto">
            <table className="min-w-full border-collapse text-left text-xs">
              <thead>
                <tr className="border-b border-zinc-200 dark:border-zinc-700">
                  <th className="p-2">파일명</th>
                  <th className="p-2">처리 결과</th>
                  <th className="p-2">통화 상세</th>
                  <th className="p-2">음성 변환 상태</th>
                  <th className="p-2">분석 상태</th>
                  <th className="p-2">저장 상태</th>
                  <th className="p-2">주요 의도</th>
                  <th className="p-2">room_no</th>
                  <th className="p-2">후속 처리</th>
                  <th className="p-2">오류 단계</th>
                  <th className="p-2">오류 메시지</th>
                </tr>
              </thead>
              <tbody>
                {visibleItems.map((r) => (
                  <tr
                    key={r.id}
                    className="border-b border-zinc-100 dark:border-zinc-800"
                  >
                    <td className="p-2 align-top">{r.file_name}</td>
                    <td className="p-2 align-top">{r.status}</td>
                    <td className="p-2 align-top font-mono">
                      {r.call_id ? (
                        <Link className="text-blue-600 underline" href={`/calls/${r.call_id}`}>
                          {r.call_id.slice(0, 8)}…
                        </Link>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="p-2 align-top">{r.stt_status ?? "—"}</td>
                    <td className="p-2 align-top">{r.analysis_status ?? "—"}</td>
                    <td className="p-2 align-top font-mono">
                      {r.analysis_persist_level ?? "—"}
                    </td>
                    <td className="p-2 align-top">{r.primary_intent ?? "—"}</td>
                    <td className="p-2 align-top">{r.room_no ?? "—"}</td>
                    <td className="p-2 align-top">{r.workflow_type ?? "—"}</td>
                    <td className="p-2 align-top">{r.error_stage ?? "—"}</td>
                    <td className="max-w-md p-2 align-top whitespace-pre-wrap text-red-600 dark:text-red-400">
                      {r.error_message ?? "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}
    </main>
  );
}
