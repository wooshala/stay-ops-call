import { getServiceSupabase } from "@/lib/supabase/server";
import type {
  OperationCaseRow,
  ReservationLeadRow,
  ServiceRequestRow,
} from "@/lib/types/database";

const DEBUG_WORKFLOW = process.env.DEBUG_WORKFLOW === "1";

export async function fetchWorkflowsForCall(callId: string): Promise<{
  operation_case: OperationCaseRow | null;
  service_request: ServiceRequestRow | null;
  reservation_lead: ReservationLeadRow | null;
}> {
  const supabase = getServiceSupabase();
  const [oc, sr, rl] = await Promise.all([
    supabase.from("operation_cases").select("*").eq("call_id", callId).maybeSingle(),
    supabase.from("service_requests").select("*").eq("call_id", callId).maybeSingle(),
    supabase.from("reservation_leads").select("*").eq("call_id", callId).maybeSingle(),
  ]);
  if (oc.error) throw oc.error;
  if (sr.error) throw sr.error;
  if (rl.error) throw rl.error;
  return {
    operation_case: (oc.data ?? null) as OperationCaseRow | null,
    service_request: (sr.data ?? null) as ServiceRequestRow | null,
    reservation_lead: (rl.data ?? null) as ReservationLeadRow | null,
  };
}

/** `call_id` unique → 동일 통화 재실행 시 update만 수행(중복 행 없음) */
export async function upsertOperationCase(payload: {
  call_id: string;
  room_no: string | null;
  case_type: string;
  issue_type: string | null;
  title: string;
  description: string | null;
  severity: "medium" | "high";
  status: "open" | "in_progress" | "resolved" | "closed";
  channel_type?: string | null;
  source_confidence?: number | null;
}): Promise<OperationCaseRow> {
  const supabase = getServiceSupabase();
  if (DEBUG_WORKFLOW) console.log("[workflow-debug] upsertOperationCase payload", payload);
  const { data, error } = await supabase
    .from("operation_cases")
    .upsert(
      {
        call_id: payload.call_id,
        room_no: payload.room_no,
        case_type: payload.case_type,
        issue_type: payload.issue_type,
        title: payload.title,
        description: payload.description,
        severity: payload.severity || "medium",
        status: payload.status,
        channel_type: payload.channel_type || "call",
        source_confidence: payload.source_confidence ?? 0.5,
      },
      { onConflict: "call_id" },
    )
    .select("*")
    .single();
  if (error) {
    console.error("[operation_cases] upsert", error);
    throw error;
  }
  return data as OperationCaseRow;
}

export async function upsertServiceRequest(payload: {
  call_id: string;
  room_no: string | null;
  request_type: string | null;
  item_requested: string | null;
  quantity: number | null;
  unit: string | null;
  title: string;
  description: string | null;
  status: "open" | "in_progress" | "completed" | "cancelled";
}): Promise<ServiceRequestRow> {
  const supabase = getServiceSupabase();
  if (DEBUG_WORKFLOW) console.log("[workflow-debug] upsertServiceRequest payload", payload);
  const { data, error } = await supabase
    .from("service_requests")
    .upsert(
      {
        call_id: payload.call_id,
        room_no: payload.room_no,
        request_type: payload.request_type,
        item_requested: payload.item_requested,
        quantity: payload.quantity,
        unit: payload.unit,
        title: payload.title,
        description: payload.description,
        status: payload.status,
      },
      { onConflict: "call_id" },
    )
    .select("*")
    .single();
  if (error) {
    console.error("[service_requests] upsert", error);
    throw error;
  }
  return data as ServiceRequestRow;
}

export async function upsertReservationLead(payload: {
  call_id: string;
  phone_number: string | null;
  normalized_phone: string | null;
  lead_type: string | null;
  guest_name: string | null;
  room_no: string | null;
  arrival_eta: string | null;
  occupancy_count: number | null;
  quoted_price: number | null;
  title: string;
  description: string | null;
  status: "new" | "contacted" | "converted" | "lost";
}): Promise<ReservationLeadRow> {
  const supabase = getServiceSupabase();
  if (DEBUG_WORKFLOW) console.log("[workflow-debug] upsertReservationLead payload", payload);
  const { data, error } = await supabase
    .from("reservation_leads")
    .upsert(
      {
        call_id: payload.call_id,
        phone_number: payload.phone_number,
        normalized_phone: payload.normalized_phone,
        lead_type: payload.lead_type,
        guest_name: payload.guest_name,
        room_no: payload.room_no,
        arrival_eta: payload.arrival_eta,
        occupancy_count: payload.occupancy_count,
        quoted_price: payload.quoted_price,
        title: payload.title,
        description: payload.description,
        status: payload.status,
      },
      { onConflict: "call_id" },
    )
    .select("*")
    .single();
  if (error) {
    console.error("[reservation_leads] upsert", error);
    throw error;
  }
  return data as ReservationLeadRow;
}
