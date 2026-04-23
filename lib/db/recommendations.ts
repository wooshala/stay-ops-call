import { getServiceSupabase } from "@/lib/supabase/server";

export async function deleteRecommendationsForCall(callId: string): Promise<void> {
  const supabase = getServiceSupabase();
  const { error } = await supabase
    .from("action_recommendations")
    .delete()
    .eq("call_id", callId);
  if (error) {
    console.error("[recommendations] delete error", error);
    throw error;
  }
}
