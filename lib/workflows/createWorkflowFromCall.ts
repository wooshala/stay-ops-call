import {
  type AnalysisResult,
  PrimaryIntentSchema,
} from "@/lib/analysis/schema";
import { analysisStatusIsUsableForWorkflow, getCallById } from "@/lib/db/calls";
import { getServiceSupabase } from "@/lib/supabase/server";
import type { CallEntityRow } from "@/lib/types/database";
import {
  upsertOperationCase,
  upsertReservationLead,
  upsertServiceRequest,
} from "@/lib/db/workflows";
import { assertOperationCaseEnumValues } from "@/lib/workflows/contract";
import {
  buildComplaintCase,
  buildMaintenanceCase,
  buildPaymentCase,
  buildReservationLeadRow,
  buildServiceRequestRow,
  shouldCreateWorkflowForIntent,
} from "@/lib/workflows/rules";

const DEBUG_WORKFLOW = process.env.DEBUG_WORKFLOW === "1";

export type WorkflowCreateOutcome =
  | {
      ok: true;
      createdType: "operation_case" | "service_request" | "reservation_lead";
      createdId: string;
    }
  | {
      ok: true;
      createdType: null;
      createdId: null;
    }
  | { ok: false; error: string };

async function getFirstEntity(callId: string): Promise<CallEntityRow | null> {
  const supabase = getServiceSupabase();
  const { data, error } = await supabase
    .from("call_entities")
    .select("*")
    .eq("call_id", callId)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data as CallEntityRow | null;
}

/**
 * 분석이 끝난 통화에 대해 intent별 업무 레코드를 upsert한다.
 * complaint는 operation_cases(case_type=complaint)로 통합한다.
 */
export async function createWorkflowFromCall(
  callId: string,
  analysisOverride?: AnalysisResult,
): Promise<WorkflowCreateOutcome> {
  try {
    if (DEBUG_WORKFLOW) {
      console.log("[workflow-debug] enter", { callId, hasOverride: Boolean(analysisOverride) });
    }
    const call = await getCallById(callId);
    if (!call) {
      return { ok: false, error: "Call not found" };
    }
    if (!analysisStatusIsUsableForWorkflow(call.analysis_status) || !call.primary_intent) {
      if (DEBUG_WORKFLOW) {
        console.log("[workflow-debug] skip:not_usable", {
          callId,
          analysis_status: call.analysis_status,
          primary_intent: call.primary_intent,
        });
      }
      return {
        ok: true,
        createdType: null,
        createdId: null,
      };
    }

    const entity = await getFirstEntity(callId);

    let analysis: AnalysisResult;
    if (analysisOverride) {
      analysis = analysisOverride;
    } else {
      const intentParsed = PrimaryIntentSchema.safeParse(call.primary_intent);
      if (!intentParsed.success) {
        return { ok: true, createdType: null, createdId: null };
      }
      analysis = {
        summary: call.summary ?? "",
        primary_intent: intentParsed.data,
        secondary_tags: Array.isArray(call.secondary_tags)
          ? (call.secondary_tags as string[])
          : [],
        actionable_secondary_intents:
          call.actionable_secondary_intents == null
            ? null
            : Array.isArray(call.actionable_secondary_intents)
              ? (call.actionable_secondary_intents as AnalysisResult["actionable_secondary_intents"])
              : null,
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

    const kind = shouldCreateWorkflowForIntent(analysis.primary_intent);
    if (!kind) {
      if (DEBUG_WORKFLOW) {
        console.log("[workflow-debug] skip:no_policy", { callId, primary_intent: analysis.primary_intent });
      }
      return { ok: true, createdType: null, createdId: null };
    }

    if (kind === "operation_case") {
      const built =
        analysis.primary_intent === "complaint"
          ? buildComplaintCase(call, entity, analysis)
          : analysis.primary_intent === "payment"
            ? buildPaymentCase(call, entity, analysis)
            : buildMaintenanceCase(call, entity, analysis);
      // DB write 전에 enum/value 검증을 강제한다.
      // 허용되지 않는 값이면 DB에 쓰지 않고 명시적 에러로 반환.
      assertOperationCaseEnumValues({
        severity: built.severity,
        status: built.status,
        channel_type: built.channel_type,
      });
      if (DEBUG_WORKFLOW) {
        console.log("[workflow-debug] target:operation_cases", {
          callId,
          case_type: built.case_type,
          status: built.status,
          severity: built.severity,
          room_no: built.room_no,
          issue_type: built.issue_type,
        });
      }
      const row = await upsertOperationCase({
        call_id: callId,
        room_no: built.room_no,
        case_type: built.case_type,
        issue_type: built.issue_type,
        title: built.title,
        description: built.description,
        severity: built.severity,
        status: built.status,
        channel_type: built.channel_type,
        source_confidence: built.source_confidence,
      });
      return {
        ok: true,
        createdType: "operation_case",
        createdId: row.id,
      };
    }

    if (kind === "service_request") {
      const built = buildServiceRequestRow(call, entity, analysis);
      if (DEBUG_WORKFLOW) {
        console.log("[workflow-debug] target:service_requests", {
          callId,
          status: built.status,
          room_no: built.room_no,
          request_type: built.request_type,
          item_requested: built.item_requested,
          quantity: built.quantity,
          unit: built.unit,
        });
      }
      const row = await upsertServiceRequest({
        call_id: callId,
        room_no: built.room_no,
        request_type: built.request_type,
        item_requested: built.item_requested,
        quantity: built.quantity,
        unit: built.unit,
        title: built.title,
        description: built.description,
        status: built.status,
      });
      return {
        ok: true,
        createdType: "service_request",
        createdId: row.id,
      };
    }

    const built = buildReservationLeadRow(call, entity, analysis);
    if (DEBUG_WORKFLOW) {
      console.log("[workflow-debug] target:reservation_leads", {
        callId,
        status: built.status,
        lead_type: built.lead_type,
        room_no: built.room_no,
        occupancy_count: built.occupancy_count,
        quoted_price: built.quoted_price,
      });
    }
    const row = await upsertReservationLead({
      call_id: callId,
      phone_number: built.phone_number,
      normalized_phone: built.normalized_phone,
      lead_type: built.lead_type,
      guest_name: built.guest_name,
      room_no: built.room_no,
      arrival_eta: built.arrival_eta,
      occupancy_count: built.occupancy_count,
      quoted_price: built.quoted_price,
      title: built.title,
      description: built.description,
      status: built.status,
    });
    return {
      ok: true,
      createdType: "reservation_lead",
      createdId: row.id,
    };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Workflow upsert failed";
    console.error("[workflow] createWorkflowFromCall failed", { callId, error: e });
    return { ok: false, error: msg };
  }
}
