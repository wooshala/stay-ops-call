"use client";

import { DndContext, type DragEndEvent } from "@dnd-kit/core";
import { useCallback, useEffect, useMemo, useState } from "react";

import FileCard from "@/components/review/FileCard";
import PipelineColumn from "@/components/review/PipelineColumn";

type ReviewStage = "raw" | "review" | "failed" | "passed";
const DEBUG_REVIEW = process.env.NODE_ENV === "development";

type FileItem = {
  name: string;
  bytes: number;
  mtime: string;
  fingerprint: string;
  call: CallItem | null;
};

type CallItem = {
  id: string;
  source_file_name: string | null;
  file_size_kb: number | null;
  analysis_status: string | null;
  analysis_error_code: string | null;
  analysis_error_message: string | null;
  primary_intent: string | null;
  confidence: number | null;
  analysis_confidence: number | null;
  auto_score?: number | null;
  auto_decision?: "pass" | "reject" | "review" | null;
  cluster_id?: string | null;
  review_status: string | null;
  label_status: string | null;
  entity_checkin_date?: string | null;
  entity_people_count?: number | null;
  created_at: string;
};

type PipelineData = {
  raw: FileItem[];
  review: CallItem[];
  failed: CallItem[];
  passed: CallItem[];
  autoRejected: CallItem[];
};

function normalizeStage(call: CallItem): ReviewStage {
  const review = (call.review_status ?? "").toLowerCase();
  const analysis = (call.analysis_status ?? "").toLowerCase();
  if (review === "verified" || review === "passed") return "passed";
  if (analysis === "failed" || review === "rejected" || review === "failed") return "failed";
  if (
    analysis === "completed" ||
    analysis === "analyzed" ||
    review === "needs_review" ||
    review === "review_ready"
  ) {
    return "review";
  }
  return "raw";
}

function getErrorSummary(code: string | null): string {
  if (!code) return "분석 실패";
  if (code.includes("stt")) return "STT 실패";
  if (code.includes("llm_json")) return "JSON 파싱 실패";
  if (code.includes("llm_call")) return "LLM 호출 실패";
  if (code.includes("db")) return "DB 저장 오류";
  return "분석 오류";
}

export default function ReviewPipelineBoard() {
  const [files, setFiles] = useState<FileItem[]>([]);
  const [calls, setCalls] = useState<CallItem[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [sizeMinKb, setSizeMinKb] = useState("");
  const [failedOnly, setFailedOnly] = useState(false);
  const [showAutoRejected, setShowAutoRejected] = useState(false);
  const [pendingCardIds, setPendingCardIds] = useState<Set<string>>(new Set());
  const isCardPending = useCallback((id: string) => pendingCardIds.has(id), [pendingCardIds]);
  const debugLog = useCallback((...args: unknown[]) => {
    if (DEBUG_REVIEW) console.log(...args);
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [filesRes, pipelineRes] = await Promise.all([
        fetch("/api/review/files", { cache: "no-store" }),
        fetch("/api/review/pipeline?status=raw,needs_review,verified,rejected&include_rejected=1", {
          cache: "no-store",
        }),
      ]);
      const filesJson = await filesRes.json();
      const pipelineJson = await pipelineRes.json();
      if (!filesRes.ok) throw new Error(filesJson.error ?? "files load failed");
      if (!pipelineRes.ok) throw new Error(pipelineJson.error ?? "pipeline load failed");
      setFiles(Array.isArray(filesJson.files) ? filesJson.files : []);
      const rows = Array.isArray(pipelineJson.rows) ? (pipelineJson.rows as CallItem[]) : [];
      setCalls(rows);
      debugLog("[review-debug] PIPELINE_AFTER_REFRESH", {
        summary: {
          files: Array.isArray(filesJson.files) ? filesJson.files.length : 0,
          rows: rows.length,
        },
      });
      for (const row of rows) {
        debugLog("[review-debug] PIPELINE_AFTER_REFRESH", {
          id: row.id,
          review_status: row.review_status,
          analysis_status: row.analysis_status,
          stage: normalizeStage(row),
        });
      }
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "load failed");
    } finally {
      setLoading(false);
    }
  }, [debugLog]);

  const refreshPipeline = useCallback(async () => {
    await load();
  }, [load]);

  useEffect(() => {
    void load();
  }, [load]);

  const filteredFiles = useMemo(() => {
    return files.filter((f) => {
      const term = search.trim().toLowerCase();
      if (term && !f.name.toLowerCase().includes(term)) return false;
      if (failedOnly) return false;
      if (sizeMinKb && f.bytes < Number(sizeMinKb) * 1024) return false;
      const ts = new Date(f.mtime).getTime();
      if (dateFrom && ts < new Date(`${dateFrom}T00:00:00`).getTime()) return false;
      if (dateTo && ts > new Date(`${dateTo}T23:59:59`).getTime()) return false;
      return !f.call || f.call.analysis_status == null;
    });
  }, [dateFrom, dateTo, failedOnly, files, search, sizeMinKb]);

  const filteredCalls = useMemo(() => {
    return calls.filter((c) => {
      const name = c.source_file_name ?? c.id;
      const term = search.trim().toLowerCase();
      if (term && !name.toLowerCase().includes(term)) return false;
      if (failedOnly && c.analysis_status !== "failed") return false;
      const ts = new Date(c.created_at).getTime();
      if (dateFrom && ts < new Date(`${dateFrom}T00:00:00`).getTime()) return false;
      if (dateTo && ts > new Date(`${dateTo}T23:59:59`).getTime()) return false;
      return true;
    });
  }, [calls, dateFrom, dateTo, failedOnly, search]);

  const data: PipelineData = useMemo(() => {
    const review: CallItem[] = [];
    const failed: CallItem[] = [];
    const passed: CallItem[] = [];
    const autoRejected: CallItem[] = [];
    for (const call of filteredCalls) {
      const stage = normalizeStage(call);
      if (call.auto_decision === "reject" && call.analysis_status === "completed") {
        debugLog("[review-debug] COLUMN_ASSIGN", {
          id: call.id,
          review_status: call.review_status,
          analysis_status: call.analysis_status,
          stage,
          normalizedStage: stage,
        });
        autoRejected.push(call);
        continue;
      }
      debugLog("[review-debug] COLUMN_ASSIGN", {
        id: call.id,
        review_status: call.review_status,
        analysis_status: call.analysis_status,
        stage,
        normalizedStage: stage,
      });
      if (stage === "review") review.push(call);
      if (stage === "failed") failed.push(call);
      if (stage === "passed") passed.push(call);
    }
    return { raw: filteredFiles, review, failed, passed, autoRejected };
  }, [debugLog, filteredCalls, filteredFiles]);

  const summary = useMemo(() => {
    return {
      total:
        data.raw.length +
        data.review.length +
        data.failed.length +
        data.passed.length +
        (showAutoRejected ? data.autoRejected.length : 0),
      raw: data.raw.length,
      review: data.review.length,
      failed: data.failed.length,
      passed: data.passed.length,
      autoRejected: data.autoRejected.length,
    };
  }, [data, showAutoRejected]);

  const callReviewAction = useCallback(async (callId: string, action: "verify" | "reject" | "reanalyze") => {
    debugLog(`[review-debug] CALLBACK_ENTER ${action} ${callId}`);
    const url = `/api/review/calls/${callId}/review`;
    const bodyObj = { action, reviewed_by: "system" };
    debugLog(`[review-debug] FETCH_START ${action} ${callId} ${url}`, bodyObj);
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(bodyObj),
    });
    const raw = await res.text();
    let json: Record<string, unknown> = {};
    try {
      json = raw ? (JSON.parse(raw) as Record<string, unknown>) : {};
    } catch {
      json = { raw };
    }
    if (!res.ok) {
      const msg =
        (typeof json.error === "string" && json.error) ||
        (typeof json.message === "string" && json.message) ||
        raw ||
        "review action failed";
      debugLog("[review-debug] FETCH_DONE", action, callId, res.status, json);
      throw new Error(msg);
    }
    debugLog("[review-debug] FETCH_DONE", action, callId, res.status, json);
  }, [debugLog]);

  const runAnalyze = useCallback(async (fileNames: string[]) => {
    debugLog(`[review-debug] CALLBACK_ENTER analyze ${fileNames.join(",")}`);
    const url = "/api/review/analyze";
    const bodyObj = { files: fileNames };
    debugLog(`[review-debug] FETCH_START analyze ${fileNames.join(",")} ${url}`, bodyObj);
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(bodyObj),
    });
    const raw = await res.text();
    let json: Record<string, unknown> = {};
    try {
      json = raw ? (JSON.parse(raw) as Record<string, unknown>) : {};
    } catch {
      json = { raw };
    }
    if (!res.ok) {
      const msg =
        (typeof json.error === "string" && json.error) ||
        (typeof json.message === "string" && json.message) ||
        raw ||
        "analyze failed";
      debugLog("[review-debug] FETCH_DONE analyze", fileNames.join(","), res.status, json);
      throw new Error(msg);
    }
    debugLog("[review-debug] FETCH_DONE analyze", fileNames.join(","), res.status, json);
  }, [debugLog]);

  const executeAction = useCallback(
    async (cardId: string, label: string, fn: () => Promise<void>) => {
      if (isCardPending(cardId)) return;
      debugLog(`[review-debug] ACTION_START ${label} ${cardId}`);
      setPendingCardIds((prev) => {
        const next = new Set(prev);
        next.add(cardId);
        return next;
      });
      setLoading(true);
      setMessage(null);
      try {
        await fn();
        await refreshPipeline();
        setMessage("처리 완료되었습니다");
      } catch (e) {
        setMessage(e instanceof Error ? e.message : "요청 처리 중 오류가 발생했습니다");
      } finally {
        setPendingCardIds((prev) => {
          const next = new Set(prev);
          next.delete(cardId);
          return next;
        });
        setLoading(false);
      }
    },
    [debugLog, isCardPending, refreshPipeline],
  );

  const runSelectedAnalyze = useCallback(async () => {
    const names = [...selected];
    if (names.length === 0) return;
    setLoading(true);
    setMessage(null);
    try {
      await runAnalyze(names);
      setSelected(new Set());
      await refreshPipeline();
      setMessage("처리 완료되었습니다");
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "요청 처리 중 오류가 발생했습니다");
    } finally {
      setLoading(false);
    }
  }, [refreshPipeline, runAnalyze, selected]);

  const onDragEnd = useCallback(
    async (event: DragEndEvent) => {
      const fromStage = event.active.data.current?.stage as ReviewStage | undefined;
      const activeId = event.active.data.current?.id as string | undefined;
      const toStage = event.over?.data.current?.stage as ReviewStage | undefined;
      if (!fromStage || !toStage || !activeId || fromStage === toStage) return;

      const allowed =
        (fromStage === "raw" && toStage === "review") ||
        (fromStage === "failed" && toStage === "passed") ||
        (fromStage === "failed" && toStage === "review") ||
        (fromStage === "review" && toStage === "passed");
      if (!allowed) return;

      setLoading(true);
      try {
        if (fromStage === "raw" && toStage === "review") {
          await runAnalyze([activeId]);
        } else if (fromStage === "failed" && toStage === "passed") {
          await callReviewAction(activeId, "verify");
        } else if (fromStage === "failed" && toStage === "review") {
          await callReviewAction(activeId, "reanalyze");
        } else if (fromStage === "review" && toStage === "passed") {
          await callReviewAction(activeId, "verify");
        }
        await refreshPipeline();
        setMessage("처리 완료되었습니다");
      } catch (e) {
        setMessage(e instanceof Error ? e.message : "요청 처리 중 오류가 발생했습니다");
      } finally {
        setLoading(false);
      }
    },
    [callReviewAction, refreshPipeline, runAnalyze],
  );

  const reviewClusters = useMemo(() => {
    const map = new Map<string, CallItem[]>();
    for (const row of data.review) {
      const key = row.cluster_id ?? "none_none";
      const list = map.get(key) ?? [];
      list.push(row);
      map.set(key, list);
    }
    return [...map.entries()].sort((a, b) => b[1].length - a[1].length);
  }, [data.review]);

  const applyClusterAction = useCallback(
    async (clusterId: string, action: "verify" | "reject") => {
      const target = data.review.filter((r) => (r.cluster_id ?? "none_none") === clusterId);
      if (target.length === 0) return;
      setLoading(true);
      try {
        for (const t of target) {
          await callReviewAction(t.id, action);
        }
        await refreshPipeline();
        setMessage("처리 완료되었습니다");
      } catch (e) {
        setMessage(e instanceof Error ? e.message : "요청 처리 중 오류가 발생했습니다");
      } finally {
        setLoading(false);
      }
    },
    [callReviewAction, data.review, refreshPipeline],
  );

  const logBoardCardRender = useCallback(
    (input: {
      id: string;
      stage: "raw" | "review" | "failed" | "passed";
      normalizedStage: "raw" | "review" | "failed" | "passed";
      columnKey: "raw" | "review" | "failed" | "passed" | "autoRejected";
      onPass?: (() => void) | undefined;
      onReject?: (() => void) | undefined;
      onReanalyze?: (() => void) | undefined;
    }) => {
      debugLog("[review-debug] BOARD_CARD_RENDER", {
        id: input.id,
        stage: input.stage,
        normalizedStage: input.normalizedStage,
        columnKey: input.columnKey,
        hasOnPass: typeof input.onPass === "function",
        hasOnReject: typeof input.onReject === "function",
        hasOnReanalyze: typeof input.onReanalyze === "function",
      });
    },
    [debugLog],
  );

  const autoKpi = useMemo(() => {
    const analyzed = calls.filter((c) => c.analysis_status === "completed");
    const total = analyzed.length || 1;
    const pass = analyzed.filter((c) => c.auto_decision === "pass").length;
    const reject = analyzed.filter((c) => c.auto_decision === "reject").length;
    const review = analyzed.filter((c) => c.auto_decision === "review" || !c.auto_decision).length;
    return {
      pass,
      reject,
      review,
      total: analyzed.length,
      passPct: Math.round((pass / total) * 100),
      rejectPct: Math.round((reject / total) * 100),
      reviewPct: Math.round((review / total) * 100),
    };
  }, [calls]);

  return (
    <main className="mx-auto max-w-[1600px] px-4 py-6">
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-xl font-semibold">파일 검수 파이프라인 (RAW / REVIEW / FAILED / PASSED)</h1>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => void load()}
            className="rounded border border-zinc-600 px-3 py-1 text-sm"
            disabled={loading}
          >
            새로고침
          </button>
          <button
            type="button"
            onClick={() => void runSelectedAnalyze()}
            className="rounded bg-emerald-900 px-3 py-1 text-sm"
            disabled={loading || selected.size === 0}
          >
            선택 분석
          </button>
        </div>
      </div>

      {message ? <p className="mb-3 text-sm text-amber-300">{message}</p> : null}

      <div className="mb-4 grid grid-cols-2 gap-2 md:grid-cols-5">
        <SummaryCard label="전체" value={summary.total} />
        <SummaryCard label="RAW" value={summary.raw} />
        <SummaryCard label="REVIEW" value={summary.review} />
        <SummaryCard label="FAILED" value={summary.failed} />
        <SummaryCard label="PASSED" value={summary.passed} />
      </div>
      <p className="mb-4 text-xs text-zinc-400">
        AUTO KPI · PASS {autoKpi.pass}({autoKpi.passPct}%) / REJECT {autoKpi.reject}({autoKpi.rejectPct}
        %) / REVIEW {autoKpi.review}({autoKpi.reviewPct}%)
      </p>

      <div className="mb-4 grid grid-cols-1 gap-2 md:grid-cols-5">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="파일명 검색"
          className="rounded border border-zinc-600 bg-zinc-950 px-2 py-1 text-sm"
        />
        <input
          type="date"
          value={dateFrom}
          onChange={(e) => setDateFrom(e.target.value)}
          className="rounded border border-zinc-600 bg-zinc-950 px-2 py-1 text-sm"
        />
        <input
          type="date"
          value={dateTo}
          onChange={(e) => setDateTo(e.target.value)}
          className="rounded border border-zinc-600 bg-zinc-950 px-2 py-1 text-sm"
        />
        <input
          type="number"
          min={0}
          value={sizeMinKb}
          onChange={(e) => setSizeMinKb(e.target.value)}
          placeholder="최소 크기(KB)"
          className="rounded border border-zinc-600 bg-zinc-950 px-2 py-1 text-sm"
        />
        <label className="flex items-center gap-2 rounded border border-zinc-700 px-2 py-1 text-sm">
          <input type="checkbox" checked={failedOnly} onChange={(e) => setFailedOnly(e.target.checked)} />
          failed만 보기
        </label>
        <label className="flex items-center gap-2 rounded border border-zinc-700 px-2 py-1 text-sm">
          <input
            type="checkbox"
            checked={showAutoRejected}
            onChange={(e) => setShowAutoRejected(e.target.checked)}
          />
          자동 거절 보기
        </label>
      </div>

      <DndContext onDragEnd={(e) => void onDragEnd(e)}>
        <div className="grid gap-3 lg:grid-cols-4">
          <PipelineColumn title="RAW" items={data.raw} stage="raw">
            {data.raw.map((f) => {
              logBoardCardRender({
                id: f.name,
                stage: "raw",
                normalizedStage: "raw",
                columnKey: "raw",
                onPass: undefined,
                onReject: undefined,
                onReanalyze: undefined,
              });
              return (
                <FileCard
                  key={f.fingerprint}
                  id={f.name}
                  name={f.name}
                  sizeLabel={`${(f.bytes / 1024).toFixed(1)} KB`}
                  createdAtLabel={new Date(f.mtime).toLocaleString("ko-KR")}
                  statusLabel="raw"
                  stage="raw"
                  tone="raw"
                  selected={selected.has(f.name)}
                  infoLines={["상태: RAW"]}
                  actionsDisabled={isCardPending(f.name)}
                  onSelect={() => {
                    debugLog("[review-debug] CALLBACK_ENTER select", f.name);
                    setSelected((prev) => {
                      const n = new Set(prev);
                      if (n.has(f.name)) n.delete(f.name);
                      else n.add(f.name);
                      return n;
                    });
                  }}
                  onPass={undefined}
                  onFail={undefined}
                  onAnalyze={() => {
                    debugLog("[review-debug] CALLBACK_ENTER analyze", f.name);
                    void executeAction(f.name, "analyze", async () => {
                      await runAnalyze([f.name]);
                    });
                  }}
                  onReanalyze={undefined}
                  onDetail={undefined}
                />
              );
            })}
          </PipelineColumn>

          <PipelineColumn title="REVIEW" items={data.review} stage="review">
            {reviewClusters.map(([clusterId, rows]) => (
              <div key={clusterId} className="rounded border border-zinc-700 bg-zinc-900/40 p-2">
                <div className="mb-2 flex items-center justify-between">
                  <div className="text-xs text-cyan-300">[{clusterId}] → {rows.length}개 파일 묶음</div>
                  <div className="flex gap-1">
                    <button
                      type="button"
                      className="rounded border border-emerald-700 px-2 py-1 text-xs"
                      onClick={() => void applyClusterAction(clusterId, "verify")}
                      disabled={loading}
                    >
                      묶음 통과
                    </button>
                    <button
                      type="button"
                      className="rounded border border-rose-700 px-2 py-1 text-xs"
                      onClick={() => void applyClusterAction(clusterId, "reject")}
                      disabled={loading}
                    >
                      묶음 실패
                    </button>
                  </div>
                </div>
                <div className="space-y-2">
                  {rows.map((c) => {
                    const onPass = () => {
                      debugLog("[review-debug] CALLBACK_ENTER verify", c.id);
                      void executeAction(c.id, "verify", async () => {
                        await callReviewAction(c.id, "verify");
                      });
                    };
                    const onReject = () => {
                      debugLog("[review-debug] CALLBACK_ENTER reject", c.id);
                      void executeAction(c.id, "reject", async () => {
                        await callReviewAction(c.id, "reject");
                      });
                    };
                    const onReanalyze = () => {
                      debugLog("[review-debug] CALLBACK_ENTER reanalyze", c.id);
                      const sourceName = c.source_file_name;
                      if (!sourceName) {
                        setMessage("source_file_name 없음: 재분석 불가");
                        return;
                      }
                      void executeAction(c.id, "reanalyze", async () => {
                        await runAnalyze([sourceName]);
                      });
                    };
                    logBoardCardRender({
                      id: c.id,
                      stage: "review",
                      normalizedStage: normalizeStage(c),
                      columnKey: "review",
                      onPass,
                      onReject,
                      onReanalyze,
                    });
                    return (
                      <FileCard
                        key={c.id}
                        id={c.id}
                        name={c.source_file_name ?? c.id}
                        sizeLabel={c.file_size_kb != null ? `${c.file_size_kb} KB` : "-"}
                        createdAtLabel={new Date(c.created_at).toLocaleString("ko-KR")}
                        statusLabel="⚠ 검수 필요"
                        stage="review"
                        tone="tested"
                        infoLines={[
                          `intent: ${c.primary_intent ?? "-"}`,
                          `score: ${(c.auto_score ?? 0).toFixed(2)}`,
                          `AUTO: ${c.auto_decision ?? "review"}`,
                          `confidence: ${(c.confidence ?? c.analysis_confidence ?? 0).toFixed(2)}`,
                        ]}
                        onSelect={undefined}
                        actionsDisabled={isCardPending(c.id)}
                        onPass={onPass}
                        onFail={onReject}
                        onReanalyze={onReanalyze}
                        onDetail={() => {
                          debugLog("[review-debug] CALLBACK_ENTER detail", c.id);
                          window.location.href = `/calls/${c.id}`;
                        }}
                      />
                    );
                  })}
                </div>
              </div>
            ))}
          </PipelineColumn>

          <PipelineColumn title="FAILED" items={data.failed} stage="failed">
            {data.failed.map((c) => {
              const onReanalyze = () => {
                debugLog("[review-debug] CALLBACK_ENTER reanalyze", c.id);
                const sourceName = c.source_file_name;
                if (!sourceName) {
                  setMessage("source_file_name 없음: 재분석 불가");
                  return;
                }
                void executeAction(c.id, "reanalyze", async () => {
                  await runAnalyze([sourceName]);
                });
              };
              logBoardCardRender({
                id: c.id,
                stage: "failed",
                normalizedStage: normalizeStage(c),
                columnKey: "failed",
                onPass: undefined,
                onReject: undefined,
                onReanalyze,
              });
              return (
                <FileCard
                  key={c.id}
                  id={c.id}
                  name={c.source_file_name ?? c.id}
                  sizeLabel={c.file_size_kb != null ? `${c.file_size_kb} KB` : "-"}
                  createdAtLabel={new Date(c.created_at).toLocaleString("ko-KR")}
                  statusLabel={`❌ ${getErrorSummary(c.analysis_error_code)}`}
                  stage="failed"
                  tone="failed"
                  infoLines={[
                    c.analysis_error_code ? `(${c.analysis_error_code})` : "(unknown)",
                    c.analysis_error_message ?? "",
                    `AUTO: ${c.auto_decision ?? "-"}`,
                  ].filter(Boolean)}
                  onSelect={undefined}
                  actionsDisabled={isCardPending(c.id)}
                  onPass={undefined}
                  onFail={undefined}
                  onReanalyze={onReanalyze}
                  onDetail={() => {
                    debugLog("[review-debug] CALLBACK_ENTER detail", c.id);
                    window.location.href = `/calls/${c.id}`;
                  }}
                />
              );
            })}
          </PipelineColumn>

          <PipelineColumn title="PASSED" items={data.passed} stage="passed">
            {data.passed.map((c) => {
              logBoardCardRender({
                id: c.id,
                stage: "passed",
                normalizedStage: normalizeStage(c),
                columnKey: "passed",
                onPass: undefined,
                onReject: undefined,
                onReanalyze: undefined,
              });
              return (
                <FileCard
                  key={c.id}
                  id={c.id}
                  name={c.source_file_name ?? c.id}
                  sizeLabel={c.file_size_kb != null ? `${c.file_size_kb} KB` : "-"}
                  createdAtLabel={new Date(c.created_at).toLocaleString("ko-KR")}
                  statusLabel={`✅ ${c.primary_intent ?? "-"}`}
                  stage="passed"
                  tone="passed"
                  infoLines={[
                    `인원: ${c.entity_people_count != null ? `${c.entity_people_count}명` : "-"}`,
                    `날짜: ${c.entity_checkin_date ?? "-"}`,
                    `score: ${(c.auto_score ?? 0).toFixed(2)}`,
                    `AUTO: ${c.auto_decision ?? "pass"}`,
                    `confidence: ${(c.confidence ?? c.analysis_confidence ?? 0).toFixed(2)}`,
                  ]}
                  onSelect={undefined}
                  actionsDisabled={isCardPending(c.id)}
                  onPass={undefined}
                  onFail={undefined}
                  onReanalyze={undefined}
                  onDetail={() => {
                    debugLog("[review-debug] CALLBACK_ENTER detail", c.id);
                    window.location.href = `/calls/${c.id}`;
                  }}
                />
              );
            })}
          </PipelineColumn>
        </div>
      </DndContext>

      {showAutoRejected ? (
        <section className="mt-4 rounded border border-zinc-700 p-3">
          <h3 className="mb-2 text-sm font-semibold text-zinc-300">AUTO REJECT (숨김 해제)</h3>
          <div className="grid gap-2 lg:grid-cols-3">
            {data.autoRejected.map((c) => {
              logBoardCardRender({
                id: c.id,
                stage: "failed",
                normalizedStage: normalizeStage(c),
                columnKey: "autoRejected",
                onPass: undefined,
                onReject: undefined,
                onReanalyze: undefined,
              });
              return (
                <FileCard
                  key={c.id}
                  id={c.id}
                  name={c.source_file_name ?? c.id}
                  sizeLabel={c.file_size_kb != null ? `${c.file_size_kb} KB` : "-"}
                  createdAtLabel={new Date(c.created_at).toLocaleString("ko-KR")}
                  statusLabel="AUTO REJECT"
                  stage="failed"
                  tone="failed"
                  infoLines={[
                    "이유: transcript too short 또는 intent 없음",
                    `score: ${(c.auto_score ?? 0).toFixed(2)}`,
                    `AUTO: ${c.auto_decision ?? "reject"}`,
                  ]}
                  onSelect={undefined}
                  actionsDisabled={isCardPending(c.id)}
                  onPass={undefined}
                  onFail={undefined}
                  onReanalyze={undefined}
                  onDetail={() => {
                    debugLog("[review-debug] CALLBACK_ENTER detail", c.id);
                    window.location.href = `/calls/${c.id}`;
                  }}
                />
              );
            })}
          </div>
        </section>
      ) : null}

      {loading ? <p className="mt-3 text-sm text-zinc-400">처리 중...</p> : null}
    </main>
  );
}

function SummaryCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded border border-zinc-700 bg-zinc-900/50 p-3">
      <div className="text-xs text-zinc-400">{label}</div>
      <div className="text-xl font-semibold tabular-nums">{value}</div>
    </div>
  );
}
