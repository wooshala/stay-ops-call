import type { CallEntityRow, CallRow } from "@/lib/types/database";
import { toIsoDateOnly } from "@/features/case/lib/dates";

export type ExtractedReservationSignals = {
  phone_number: string | null;
  checkin_date: string | null; // YYYY-MM-DD
  people_count: number | null;
  room_type: string | null;
  stay_type: "stay" | "dayuse" | null;
};

function tryPickString(obj: unknown, paths: string[]): string | null {
  if (!obj || typeof obj !== "object") return null;
  const anyObj = obj as Record<string, unknown>;
  for (const path of paths) {
    const parts = path.split(".");
    let cur: unknown = anyObj;
    for (const p of parts) {
      if (!cur || typeof cur !== "object") {
        cur = null;
        break;
      }
      cur = (cur as Record<string, unknown>)[p];
    }
    if (typeof cur === "string" && cur.trim()) return cur.trim();
  }
  return null;
}

function tryPickNumber(obj: unknown, paths: string[]): number | null {
  const s = tryPickString(obj, paths);
  if (!s) return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

function normalizeStayType(input: string | null): "stay" | "dayuse" | null {
  if (!input) return null;
  const s = input.trim().toLowerCase();
  if (!s) return null;
  if (s === "stay") return "stay";
  if (s === "dayuse") return "dayuse";
  if (s.includes("대실") || s.includes("day")) return "dayuse";
  if (s.includes("숙박") || s.includes("stay")) return "stay";
  return null;
}

export function extractReservationSignals(input: {
  call: CallRow;
  latestEntity?: Pick<CallEntityRow, "checkin_date" | "occupancy_count"> | null;
}): ExtractedReservationSignals {
  const call = input.call;

  // 1순위: 기존 구조화 결과 (엔티티 테이블 등)
  const entityCheckin = input.latestEntity?.checkin_date ?? null;
  const entityPeople = input.latestEntity?.occupancy_count ?? null;

  // 2순위: 분석 JSON/워크플로 결과 (analysis_raw_response)
  let rawObj: unknown = null;
  if (typeof call.analysis_raw_response === "string" && call.analysis_raw_response.trim()) {
    try {
      rawObj = JSON.parse(call.analysis_raw_response);
    } catch {
      rawObj = null;
    }
  }

  const jsonCheckin =
    toIsoDateOnly(
      tryPickString(rawObj, [
        "entities.checkin_date",
        "call.entities.checkin_date",
        "result.entities.checkin_date",
        "checkin_date",
      ]),
    ) ?? null;

  const jsonPeople =
    tryPickNumber(rawObj, [
      "entities.occupancy_count",
      "entities.people_count",
      "call.entities.occupancy_count",
      "people_count",
    ]) ?? null;

  const jsonRoomType =
    tryPickString(rawObj, ["entities.room_type", "room_type", "call.entities.room_type"]) ?? null;

  const jsonStayType =
    normalizeStayType(
      tryPickString(rawObj, ["entities.stay_type", "stay_type", "call.entities.stay_type"]) ?? null,
    ) ?? null;

  const checkin = toIsoDateOnly(entityCheckin) ?? jsonCheckin ?? null;

  return {
    phone_number: call.phone_number ?? null,
    checkin_date: checkin,
    people_count: entityPeople ?? jsonPeople ?? null,
    room_type: jsonRoomType,
    stay_type: jsonStayType,
  };
}

