import { extractReservationSignals } from "@/features/case/lib/extractFromCall";
import { isReservationIntent } from "@/features/case/lib/intent";
import { getLatestCallEntity, listCompletedCalls } from "@/features/case/db";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const limitParam = searchParams.get("limit");
  const limit = limitParam ? Number(limitParam) : 200;

  const calls = await listCompletedCalls(Number.isFinite(limit) ? limit : 200);
  const rows: Array<{
    call_id: string;
    phone_number: string | null;
    primary_intent: string | null;
    reason: string;
    created_at: string;
    duration_sec: number | null;
    confidence: number | null;
  }> = [];

  for (const call of calls) {
    if (!isReservationIntent(call.primary_intent)) continue;
    const latestEntity = await getLatestCallEntity(call.id);
    const signals = extractReservationSignals({ call, latestEntity });
    if (signals.checkin_date) continue;
    rows.push({
      call_id: call.id,
      phone_number: call.phone_number ?? null,
      primary_intent: call.primary_intent ?? null,
      reason: "예약 의도는 있으나 체크인 날짜가 없어 자동 케이스를 만들지 않았습니다.",
      created_at: call.created_at,
      duration_sec: call.duration_sec ?? null,
      confidence: (call.confidence ?? call.analysis_confidence) ?? null,
    });
  }

  return Response.json({ rows });
}

