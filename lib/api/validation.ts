import type { CallDirection, CallSourceType } from "@/lib/types/database";

const directions: CallDirection[] = ["inbound", "outbound"];
const sources: CallSourceType[] = ["internal", "external", "smartcall", "android_agent"];

export function parseDirection(value: string | null): CallDirection | null {
  if (!value) return null;
  return directions.includes(value as CallDirection)
    ? (value as CallDirection)
    : null;
}

/** direction이 없으면 "inbound" 반환. Android 업로드 등 방향 미확인 경로에서 사용. */
export function parseDirectionWithDefault(value: string | null): CallDirection | null {
  if (!value || value.trim() === "") return "inbound";
  return directions.includes(value as CallDirection)
    ? (value as CallDirection)
    : null; // 값이 있는데 잘못된 경우 → 400 처리
}

export function parseSourceType(value: string | null): CallSourceType | null {
  if (!value) return null;
  return sources.includes(value as CallSourceType)
    ? (value as CallSourceType)
    : null;
}

const DEFAULT_BASE = "call-recording";

/**
 * Storage object 이름용: 한글 제거 → 공백을 하이픈으로 → 허용 문자만(a-z, 0-9, -, _, .) 남김.
 * 확장자는 유지(알파숫만). 베이스가 비면 {@link DEFAULT_BASE}.
 */
export function sanitizeStorageFileName(name: string): string {
  const raw = (name ?? "").trim();
  if (!raw) {
    return `${DEFAULT_BASE}.m4a`;
  }

  const lastDot = raw.lastIndexOf(".");
  let basePart: string;
  let extPart: string;
  if (lastDot > 0) {
    basePart = raw.slice(0, lastDot);
    extPart = raw.slice(lastDot + 1);
  } else {
    basePart = raw;
    extPart = "";
  }

  const extClean = extPart.replace(/[^a-zA-Z0-9]/g, "").toLowerCase();

  let base = basePart
    .replace(/\p{Script=Hangul}/gu, "")
    .replace(/\s+/g, "-")
    .replace(/[^a-zA-Z0-9\-_.]/g, "")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "");

  if (!base) {
    base = DEFAULT_BASE;
  }

  return extClean ? `${base}.${extClean}` : base;
}
