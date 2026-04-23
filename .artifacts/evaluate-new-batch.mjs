/**
 * Evaluate a batch export JSON (no gold labels available):
 * - intent_ok: primary_intent non-empty
 * - summary_ok: non-empty summary length >= 20
 * - workflow_ok: workflow_status appropriate for predicted intent (completed vs skipped)
 *
 * Also computes confidence buckets and top 3 error patterns.
 *
 * Usage:
 *   node .artifacts/evaluate-new-batch.mjs <IN_JSON> <OUT_JSON>
 */
import { readFileSync, writeFileSync, mkdirSync } from "fs";
import { dirname } from "path";

function readJson(p) {
  return JSON.parse(readFileSync(p, "utf8"));
}

function pct(n, d) {
  return d ? n / d : 0;
}

function expectedWorkflowForIntent(intent) {
  const i = (intent ?? "").trim();
  if (i === "reservation_inquiry") return "reservation_lead";
  if (i === "service_request") return "service_request";
  if (i === "maintenance" || i === "payment" || i === "complaint") return "operation_case";
  if (i === "checkin_checkout" || i === "other") return "skipped";
  return "skipped";
}

function workflowOk(row) {
  const expected = expectedWorkflowForIntent(row.primary_intent);
  const ws = row.workflow_status ?? null;
  if (expected === "skipped") return ws === "skipped";
  return ws === "completed";
}

function summaryOk(row) {
  if (typeof row.summary !== "string") return false;
  const t = row.summary.trim();
  return t.length >= 20;
}

function intentOk(row) {
  return typeof row.primary_intent === "string" && row.primary_intent.trim().length > 0;
}

function bucket(conf) {
  if (typeof conf !== "number" || !Number.isFinite(conf)) return "unknown";
  if (conf >= 0.7) return "normal";
  if (conf >= 0.3) return "needs_review";
  return "low_conf";
}

function topErrorPatterns(rows) {
  const errors = rows.filter((r) => !(r.intent_ok && r.summary_ok && r.workflow_ok));
  const byType = new Map();
  for (const r of errors) {
    const key = `${r.primary_intent ?? "null"}|wf=${r.workflow_status ?? "null"}|as=${r.analysis_status ?? "null"}`;
    byType.set(key, (byType.get(key) ?? 0) + 1);
  }
  const top = [...byType.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([k, n]) => ({ pattern: k, count: n }));
  return top;
}

async function main() {
  const inPath = process.argv[2];
  const outPath = process.argv[3];
  if (!inPath || !outPath) {
    console.error("Usage: node .artifacts/evaluate-new-batch.mjs <IN_JSON> <OUT_JSON>");
    process.exit(1);
  }
  const rows = readJson(inPath);
  const enriched = rows.map((r) => ({
    ...r,
    intent_ok: intentOk(r),
    summary_ok: summaryOk(r),
    workflow_ok: workflowOk(r),
    confidence_bucket: bucket(r.analysis_confidence),
  }));

  const total = enriched.length;
  const intentOkN = enriched.filter((r) => r.intent_ok).length;
  const summaryOkN = enriched.filter((r) => r.summary_ok).length;
  const workflowOkN = enriched.filter((r) => r.workflow_ok).length;

  const confVals = enriched
    .map((r) => r.analysis_confidence)
    .filter((x) => typeof x === "number" && Number.isFinite(x));
  const avgConf = confVals.length ? confVals.reduce((a, b) => a + b, 0) / confVals.length : null;

  const bucketCounts = { normal: 0, needs_review: 0, low_conf: 0, unknown: 0 };
  for (const r of enriched) bucketCounts[r.confidence_bucket] = (bucketCounts[r.confidence_bucket] ?? 0) + 1;

  const metrics = {
    intent_accuracy: pct(intentOkN, total),
    summary_quality: pct(summaryOkN, total),
    workflow_accuracy: pct(workflowOkN, total),
  };

  const out = {
    total,
    metrics,
    confidence: { avg: avgConf, ...bucketCounts },
    top_errors: topErrorPatterns(enriched),
    rows: enriched,
  };

  mkdirSync(dirname(outPath), { recursive: true });
  writeFileSync(outPath, JSON.stringify(out, null, 2), "utf8");
  console.log("wrote", outPath);
}

main().catch((e) => {
  console.error(e);
  process.exit(2);
});

