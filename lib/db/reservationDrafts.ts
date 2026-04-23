import { z } from "zod";

import type { AnalysisResult } from "@/lib/analysis/schema";
import { PrimaryIntentSchema } from "@/lib/analysis/schema";
import { getCallById } from "@/lib/db/calls";
import { createReservation } from "@/lib/db/reservations";
import type { ReservationStatus } from "@/lib/db/reservations";
import type { CallEntityRow, CallRow } from "@/lib/types/database";
import { normalizePhone } from "@/lib/utils/phone";
import { getServiceSupabase } from "@/lib/supabase/server";
import type { WorkflowCreateOutcome } from "@/lib/workflows/createWorkflowFromCall";
import {
  appendSheetRow,
  buildAiReservationLogRow,
  isGoogleSheetsConfigured,
  shouldSkipSheetAppend,
} from "@/lib/services/googleSheets";

export type ReservationDraftStatus = "pending" | "approved" | "dismissed";

export interface ReservationDraftRow {
  id: string;
  call_id: string | null;
  review_status: ReservationDraftStatus;
  draft_json: Record<string, unknown>;
  final_json: Record<string, unknown> | null;
  reviewed_by: string | null;
  reviewed_at: string | null;
  sheet_appended_at: string | null;
  created_at: string;
  updated_at: string;
}

/** AI 초안 / 승인 최종 JSON 공통 스키마 (reservation_manual_logs 와 호환) */
export const draftPayloadSchema = z.object({
  phone_number: z.string().nullable().optional(),
  guest_name: z.string().nullable().optional(),
  check_in_date: z.string().min(1),
  check_in_time: z.string().nullable().optional(),
  room_type: z.string().nullable().optional(),
  vehicle_info: z.string().nullable().optional(),
  occupancy_count: z.coerce.number().int().nullable().optional(),
  status: z.enum(["inquiry", "tentative", "confirmed", "follow_up", "cancelled"]),
  memo: z.string().nullable().optional(),
});

export type DraftPayload = z.infer<typeof draftPayloadSchema>;

function parsePayload(data: unknown): DraftPayload {
  return draftPayloadSchema.parse(data);
}

export async function listReservationDrafts(params: {
  status?: ReservationDraftStatus;
  limit?: number;
}): Promise<ReservationDraftRow[]> {
  const supabase = getServiceSupabase();
  const limit = Math.min(100, Math.max(1, params.limit ?? 50));
  let q = supabase
    .from("reservation_drafts")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(limit);
  if (params.status) q = q.eq("review_status", params.status);
  const { data, error } = await q;
  if (error) throw error;
  return (data ?? []) as ReservationDraftRow[];
}

export async function getReservationDraft(id: string): Promise<ReservationDraftRow | null> {
  const supabase = getServiceSupabase();
  const { data, error } = await supabase
    .from("reservation_drafts")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  return (data as ReservationDraftRow) ?? null;
}

async function appendSheetForPayload(
  payload: DraftPayload,
  opts: { callId: string | null; reviewer: string | null },
): Promise<void> {
  console.log("[sheets] appendSheetForPayload called");
  console.log("[sheets] shouldSkip =", shouldSkipSheetAppend());
  console.log("[sheets] configured =", isGoogleSheetsConfigured());

  // TEMP: force skip Google Sheets append in local dev to verify approval flow
  if (process.env.NODE_ENV !== "production") {
    console.log("[sheets] dev mode force skip");
    return;
  }

  if (shouldSkipSheetAppend()) {
    console.warn("[sheets] GOOGLE_SHEETS_SKIP_APPEND active — sheet append skipped");
    return;
  }
  if (!isGoogleSheetsConfigured()) {
    throw new Error(
      "Google Sheets is not configured. Set GOOGLE_SHEETS_SPREADSHEET_ID and credentials, or GOOGLE_SHEETS_SKIP_APPEND=1 for dev.",
    );
  }
  const row = buildAiReservationLogRow({
    reviewedAtIso: new Date().toISOString(),
    callId: opts.callId,
    phone: payload.phone_number ?? null,
    guestName: payload.guest_name ?? null,
    checkInDate: payload.check_in_date,
    checkInTime: payload.check_in_time ?? null,
    roomType: payload.room_type ?? null,
    occupancy: payload.occupancy_count ?? null,
    status: payload.status,
    memo: payload.memo ?? null,
    reviewer: opts.reviewer,
    source: "AI초안",
  });
  await appendSheetRow(row);
}

async function insertManualLogFromPayload(
  payload: DraftPayload,
  opts: { callId: string | null; createdBy: string | null },
): Promise<void> {
  await createReservation({
    phone_number: payload.phone_number ? normalizePhone(payload.phone_number) : null,
    guest_name: payload.guest_name ?? null,
    check_in_date: payload.check_in_date,
    check_in_time: payload.check_in_time ?? null,
    room_type: payload.room_type ?? null,
    vehicle_info: payload.vehicle_info ?? null,
    occupancy_count: payload.occupancy_count ?? null,
    status: payload.status as ReservationStatus,
    memo: payload.memo ?? null,
    pms_confirmed: false,
    call_id: opts.callId,
    created_by: opts.createdBy,
  });
}

export async function approveReservationDraft(
  id: string,
  reviewedBy: string | null,
): Promise<ReservationDraftRow> {
  console.log("[reservation_drafts] approve start", { draftId: id });

  const draft = await getReservationDraft(id);
  if (!draft || draft.review_status !== "pending") {
    console.error("[reservation_drafts] draft fetch FAILED or not pending", { draftId: id, status: draft?.review_status });
    throw new Error("draft not found or not pending");
  }
  console.log("[reservation_drafts] draft fetched OK", { draftId: id, review_status: draft.review_status });

  const payload = parsePayload(draft.draft_json);
  await appendSheetForPayload(payload, {
    callId: draft.call_id,
    reviewer: reviewedBy,
  });

  const supabase = getServiceSupabase();
  const now = new Date().toISOString();
  const { data, error } = await supabase
    .from("reservation_drafts")
    .update({
      review_status: "approved",
      final_json: payload as unknown as Record<string, unknown>,
      reviewed_by: reviewedBy,
      reviewed_at: now,
      sheet_appended_at: now,
    })
    .eq("id", id)
    .eq("review_status", "pending")
    .select("*")
    .single();
  if (error) {
    console.error("[reservation_drafts] draft approved update FAILED", error);
    throw error;
  }
  if (!data) {
    console.error("[reservation_drafts] draft approved update FAILED — concurrent approval?");
    throw new Error("concurrent approval");
  }
  console.log("[reservation_drafts] draft approved update OK", { draftId: id });

  try {
    await insertManualLogFromPayload(payload, {
      callId: draft.call_id,
      createdBy: reviewedBy,
    });
    console.log("[reservation_drafts] reservation_manual_logs insert OK", { draftId: id, check_in_date: payload.check_in_date });
  } catch (e) {
    console.error("[reservation_drafts] reservation_manual_logs insert FAILED", e);
    console.error("[reservation_drafts] payload was:", JSON.stringify(payload));
  }

  return data as ReservationDraftRow;
}

const draftPayloadPartialSchema = draftPayloadSchema.partial();

export async function approveReservationDraftWithEdit(
  id: string,
  patch: Record<string, unknown>,
  reviewedBy: string | null,
): Promise<ReservationDraftRow> {
  console.log("[reservation_drafts] approve-edit start", { draftId: id });

  const draft = await getReservationDraft(id);
  if (!draft || draft.review_status !== "pending") {
    console.error("[reservation_drafts] draft fetch FAILED or not pending", { draftId: id, status: draft?.review_status });
    throw new Error("draft not found or not pending");
  }
  console.log("[reservation_drafts] draft fetched OK", { draftId: id, review_status: draft.review_status });

  const base = parsePayload(draft.draft_json);
  const partial = draftPayloadPartialSchema.parse(patch);
  const merged = draftPayloadSchema.parse({ ...base, ...partial });
  await appendSheetForPayload(merged, {
    callId: draft.call_id,
    reviewer: reviewedBy,
  });

  const supabase = getServiceSupabase();
  const now = new Date().toISOString();
  const { data, error } = await supabase
    .from("reservation_drafts")
    .update({
      review_status: "approved",
      final_json: merged as unknown as Record<string, unknown>,
      reviewed_by: reviewedBy,
      reviewed_at: now,
      sheet_appended_at: now,
    })
    .eq("id", id)
    .eq("review_status", "pending")
    .select("*")
    .single();
  if (error) {
    console.error("[reservation_drafts] draft approved update FAILED", error);
    throw error;
  }
  if (!data) {
    console.error("[reservation_drafts] draft approved update FAILED — concurrent approval?");
    throw new Error("concurrent approval");
  }
  console.log("[reservation_drafts] draft approved update OK", { draftId: id });

  try {
    await insertManualLogFromPayload(merged, {
      callId: draft.call_id,
      createdBy: reviewedBy,
    });
    console.log("[reservation_drafts] reservation_manual_logs insert OK", { draftId: id, check_in_date: merged.check_in_date });
  } catch (e) {
    console.error("[reservation_drafts] reservation_manual_logs insert FAILED", e);
    console.error("[reservation_drafts] payload was:", JSON.stringify(merged));
  }

  return data as ReservationDraftRow;
}

export async function dismissReservationDraft(
  id: string,
  reviewedBy: string | null,
): Promise<ReservationDraftRow> {
  const supabase = getServiceSupabase();
  const now = new Date().toISOString();
  const { data, error } = await supabase
    .from("reservation_drafts")
    .update({
      review_status: "dismissed",
      reviewed_by: reviewedBy,
      reviewed_at: now,
    })
    .eq("id", id)
    .eq("review_status", "pending")
    .select("*")
    .single();
  if (error) throw error;
  if (!data) throw new Error("draft not found or not pending");
  return data as ReservationDraftRow;
}

// ── 통화 분석 → 자동 draft (승인 전 시트/RML 없음) ───────────────────────────

/** 예약 문의·요금·연장·견적 의도 또는 reservation_leads 생성된 통화 */
const RESERVATION_INTENTS_FOR_DRAFT = new Set<string>([
  "reservation_inquiry",
  "rate_inquiry",
  "extension_request",
  "quotation_intent",
]);

export function shouldAutoCreateReservationDraft(
  primaryIntent: string | null | undefined,
  hasReservationLeadWorkflow: boolean,
): boolean {
  if (hasReservationLeadWorkflow) return true;
  if (primaryIntent && RESERVATION_INTENTS_FOR_DRAFT.has(primaryIntent)) return true;
  return false;
}

function firstIsoDate(s: string | null | undefined): string | null {
  if (!s?.trim()) return null;
  const m = /^\d{4}-\d{2}-\d{2}/.exec(s.trim());
  return m ? m[0] : null;
}

function inferReservationDraftStatus(
  summary: string,
  primaryIntent: string,
): ReservationStatus {
  const follow = ["다시 연락", "나중에", "재연락", "보류", "다시 전화"];
  if (follow.some((k) => summary.includes(k))) return "follow_up";
  const tentative = ["확정", "예약 완료", "입금", "결제 완료", "잡아달", "룸"];
  if (tentative.some((k) => summary.includes(k))) return "tentative";
  if (primaryIntent === "quotation_intent") return "inquiry";
  return "inquiry";
}

async function getFirstEntityForDraft(callId: string): Promise<CallEntityRow | null> {
  const supabase = getServiceSupabase();
  const { data, error } = await supabase
    .from("call_entities")
    .select("*")
    .eq("call_id", callId)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return (data as CallEntityRow) ?? null;
}

export function buildDraftJsonFromCallAnalysis(
  call: CallRow,
  analysis: AnalysisResult,
  entity: CallEntityRow | null,
  hasReservationLeadWorkflow: boolean,
): Record<string, unknown> {
  const ent = analysis.entities;
  const checkInDate =
    firstIsoDate(ent.checkin_date ?? entity?.checkin_date ?? null) ??
    new Date().toISOString().slice(0, 10);

  const status = inferReservationDraftStatus(
    analysis.summary ?? "",
    analysis.primary_intent,
  );

  return {
    phone_number: call.phone_number ?? null,
    guest_name: ent.guest_name ?? entity?.guest_name ?? null,
    check_in_date: checkInDate,
    check_in_time: null,
    room_type: ent.room_no ?? entity?.room_no ?? null,
    occupancy_count: ent.occupancy_count ?? entity?.occupancy_count ?? null,
    vehicle_info: null,
    status,
    memo: analysis.summary?.trim() || null,
    source: "call_analysis",
    primary_intent: analysis.primary_intent,
    summary: analysis.summary,
    analysis_confidence: analysis.confidence,
    call_created_at: call.created_at,
    workflow_reservation_lead: hasReservationLeadWorkflow,
  };
}

export async function findReservationDraftByCallId(
  callId: string,
): Promise<ReservationDraftRow | null> {
  const supabase = getServiceSupabase();
  const { data, error } = await supabase
    .from("reservation_drafts")
    .select("*")
    .eq("call_id", callId)
    .maybeSingle();
  if (error) throw error;
  return (data as ReservationDraftRow) ?? null;
}

/**
 * 분석 직후 호출. 동일 call_id draft 가 이미 있으면(상태 무관) 생성하지 않음.
 */
export async function maybeCreateReservationDraftFromAnalysis(params: {
  callId: string;
  analysis: AnalysisResult;
  workflow: WorkflowCreateOutcome;
}): Promise<
  "created" | "skipped_exists" | "skipped_not_eligible" | "skipped_error"
> {
  try {
    const existing = await findReservationDraftByCallId(params.callId);
    if (existing) return "skipped_exists";

    const hasLead =
      params.workflow.ok && params.workflow.createdType === "reservation_lead";
    if (
      !shouldAutoCreateReservationDraft(
        params.analysis.primary_intent,
        hasLead,
      )
    ) {
      return "skipped_not_eligible";
    }

    const call = await getCallById(params.callId);
    if (!call) return "skipped_error";

    const entity = await getFirstEntityForDraft(params.callId);
    const draftJson = buildDraftJsonFromCallAnalysis(
      call,
      params.analysis,
      entity,
      hasLead,
    );

    const supabase = getServiceSupabase();
    const { error } = await supabase.from("reservation_drafts").insert({
      call_id: params.callId,
      review_status: "pending",
      draft_json: draftJson,
    });
    if (error) {
      if (error.code === "23505") return "skipped_exists";
      throw error;
    }
    return "created";
  } catch (e) {
    console.error("[reservation_drafts] maybeCreateReservationDraftFromAnalysis", e);
    return "skipped_error";
  }
}

/** @deprecated 이름 호환 — maybeCreateReservationDraftFromAnalysis 와 동일 목적 */
export async function createReservationDraftFromCall(
  callId: string,
  analysis: AnalysisResult,
  workflow: WorkflowCreateOutcome,
): ReturnType<typeof maybeCreateReservationDraftFromAnalysis> {
  return maybeCreateReservationDraftFromAnalysis({ callId, analysis, workflow });
}

function analysisResultFromStoredCall(
  call: CallRow,
  entity: CallEntityRow | null,
): AnalysisResult | null {
  const intentParsed = PrimaryIntentSchema.safeParse(call.primary_intent);
  if (!intentParsed.success) return null;
  return {
    summary: call.summary ?? "",
    primary_intent: intentParsed.data,
    secondary_tags: Array.isArray(call.secondary_tags)
      ? (call.secondary_tags as string[])
      : [],
    actionable_secondary_intents: null,
    confidence: call.analysis_confidence ?? 0,
    entities: {
      room_no: entity?.room_no ?? null,
      guest_name: entity?.guest_name ?? null,
      issue_type: entity?.issue_type ?? null,
      item_requested: entity?.item_requested ?? null,
      quantity: entity?.quantity ?? null,
      unit: entity?.unit ?? null,
      arrival_eta: entity?.arrival_eta ?? null,
      occupancy_count: entity?.occupancy_count ?? null,
      checkin_date: entity?.checkin_date ?? null,
      checkout_date: entity?.checkout_date ?? null,
      quoted_price: entity?.quoted_price ?? null,
      complaint_reason: entity?.complaint_reason ?? null,
      amount: entity?.amount ?? null,
      payment_method: entity?.payment_method ?? null,
      payment_deposit: entity?.payment_deposit ?? null,
      group_booking: entity?.group_booking ?? null,
      room_count: entity?.room_count ?? null,
      deposit_amount: entity?.deposit_amount ?? null,
      parking_count: entity?.parking_count ?? null,
    },
    recommended_actions: [],
  };
}

export async function runBackfillReservationDrafts(opts: {
  days: number;
  limit: number;
}): Promise<{
  scanned: number;
  matched: number;
  created: number;
  skipped_existing: number;
  skipped_not_reservation: number;
  skipped_no_analysis: number;
  errors: number;
}> {
  const supabase = getServiceSupabase();
  const since = new Date(
    Date.now() - Math.max(1, opts.days) * 86_400_000,
  ).toISOString();

  const { data: rows, error } = await supabase
    .from("calls")
    .select(
      "id, primary_intent, summary, analysis_confidence, analysis_status, phone_number, created_at",
    )
    .gte("created_at", since)
    .in("analysis_status", ["completed", "warning"])
    .order("created_at", { ascending: false })
    .limit(Math.min(2000, Math.max(1, opts.limit)));

  if (error) throw error;
  const calls = (rows ?? []) as CallRow[];

  let matched = 0;
  let created = 0;
  let skipped_existing = 0;
  let skipped_not_reservation = 0;
  let skipped_no_analysis = 0;
  let errors = 0;

  for (const c of calls) {
    const existing = await findReservationDraftByCallId(c.id);
    if (existing) {
      skipped_existing++;
      continue;
    }

    const { data: leadRow } = await supabase
      .from("reservation_leads")
      .select("id")
      .eq("call_id", c.id)
      .maybeSingle();

    const hasLead = Boolean(leadRow);
    if (!shouldAutoCreateReservationDraft(c.primary_intent, hasLead)) {
      skipped_not_reservation++;
      continue;
    }
    matched++;

    const entity = await getFirstEntityForDraft(c.id);
    const fullCall = await getCallById(c.id);
    if (!fullCall) {
      errors++;
      continue;
    }
    const analysis = analysisResultFromStoredCall(fullCall, entity);
    if (!analysis) {
      skipped_no_analysis++;
      continue;
    }

    const wf: WorkflowCreateOutcome =
      hasLead && leadRow
        ? {
            ok: true,
            createdType: "reservation_lead",
            createdId: leadRow.id as string,
          }
        : { ok: true, createdType: null, createdId: null };

    const r = await maybeCreateReservationDraftFromAnalysis({
      callId: c.id,
      analysis,
      workflow: wf,
    });
    if (r === "created") created++;
    else if (r === "skipped_exists") skipped_existing++;
    else if (r === "skipped_not_eligible") skipped_not_reservation++;
    else if (r === "skipped_error") errors++;
  }

  return {
    scanned: calls.length,
    matched,
    created,
    skipped_existing,
    skipped_not_reservation,
    skipped_no_analysis,
    errors,
  };
}
