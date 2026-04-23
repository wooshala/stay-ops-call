import { getServiceSupabase } from "@/lib/supabase/server";
import type { CallDirection, CallSourceType } from "@/lib/types/database";
import { normalizePhone } from "@/lib/utils/phone";

interface UpsertFromNewCallInput {
  phone_number: string | null;
  normalized_phone: string | null;
  direction: CallDirection | null;
  source_type: CallSourceType | null;
}

/**
 * Increment call counters when a new call row is created for external/smartcall lines.
 */
export async function upsertPhoneContactFromNewCall(
  input: UpsertFromNewCallInput,
): Promise<void> {
  if (!input.normalized_phone) return;
  if (input.source_type !== "external" && input.source_type !== "smartcall") {
    return;
  }

  const supabase = getServiceSupabase();
  const now = new Date().toISOString();
  const displayPhone = input.phone_number ?? input.normalized_phone;

  const { data: existing, error: selErr } = await supabase
    .from("phone_contacts")
    .select("*")
    .eq("normalized_phone", input.normalized_phone)
    .maybeSingle();

  if (selErr) {
    console.error("[phoneContacts] select error", selErr);
    throw selErr;
  }

  const inboundInc = input.direction === "inbound" ? 1 : 0;
  const outboundInc = input.direction === "outbound" ? 1 : 0;

  if (!existing) {
    const { error: insErr } = await supabase.from("phone_contacts").insert({
      phone_number: displayPhone,
      normalized_phone: input.normalized_phone,
      first_seen_at: now,
      last_seen_at: now,
      total_calls: 1,
      inbound_calls: inboundInc,
      outbound_calls: outboundInc,
    });
    if (insErr) {
      console.error("[phoneContacts] insert error", insErr);
      throw insErr;
    }
    return;
  }

  const { error: updErr } = await supabase
    .from("phone_contacts")
    .update({
      phone_number: displayPhone,
      last_seen_at: now,
      total_calls: (existing.total_calls ?? 0) + 1,
      inbound_calls: (existing.inbound_calls ?? 0) + inboundInc,
      outbound_calls: (existing.outbound_calls ?? 0) + outboundInc,
    })
    .eq("normalized_phone", input.normalized_phone);

  if (updErr) {
    console.error("[phoneContacts] update error", updErr);
    throw updErr;
  }
}

export async function updatePhoneContactAfterAnalysis(input: {
  normalized_phone: string | null;
  last_intent: string | null;
  last_summary: string | null;
}): Promise<void> {
  if (!input.normalized_phone) return;

  const supabase = getServiceSupabase();
  const now = new Date().toISOString();

  const { error } = await supabase
    .from("phone_contacts")
    .update({
      last_seen_at: now,
      last_intent: input.last_intent,
      last_summary: input.last_summary,
    })
    .eq("normalized_phone", input.normalized_phone);

  if (error) {
    console.error("[phoneContacts] analysis update error", error);
    throw error;
  }
}

export function normalizePhoneQuery(phone: string | null | undefined): string | null {
  if (!phone) return null;
  return normalizePhone(phone);
}
