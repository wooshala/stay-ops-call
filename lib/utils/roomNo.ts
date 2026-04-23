/**
 * Transcript에서 객실번호 후보 추출 (LLM 누락 시 fallback).
 * 전화번호 뒷자리·번호 문맥은 제외, 숫자+호 우선.
 */

/** 3자리 객실 + 번만 (4자리 7926번 등 전화 패턴 배제) */
const RE_ROOM_BEON_3 = /(^|[^\d])([1-9]\d{2})\s*번/g;

function isExcludedYearFourDigits(n: number): boolean {
  return n >= 1900 && n <= 2099;
}

function isPhoneOrNumberContext(t: string, matchStart: number, matchEnd: number): boolean {
  const before = t.slice(Math.max(0, matchStart - 45), matchStart);
  const after = t.slice(matchEnd, matchEnd + 25);
  const ctx = `${before} ${after}`;

  if (
    /제\s*번호|번호\s*떴|번호\s*맞|전화번호|전화\s*번호|연락처|핸드폰|휴대폰|010\s*-?\d|휴대\s*전화/.test(
      ctx,
    )
  ) {
    return true;
  }
  if (/\d+\s*-\s*\d+\s*-\s*\d+/.test(t.slice(Math.max(0, matchStart - 15), matchEnd + 15))) {
    return true;
  }
  if (/끝\s*네\s*자리|뒤\s*네\s*자리|뒷\s*번호|네\s*자리/.test(ctx)) {
    return true;
  }
  return false;
}

/**
 * 본문에서 신뢰할 만한 객실번호 토큰 (예: "207호"). 전화 문맥·하이픈 번호는 제외.
 */
export function extractRoomNoFromTranscript(transcript: string): string | null {
  const t = transcript.trim();
  if (!t) return null;

  const reHo = /(\d{1,4})\s*호/g;
  let hoMatch: RegExpExecArray | null;
  while ((hoMatch = reHo.exec(t)) !== null) {
    if (isPhoneOrNumberContext(t, hoMatch.index, hoMatch.index + hoMatch[0].length)) {
      continue;
    }
    const d = hoMatch[1];
    if (d) {
      return `${d.replace(/^0+/, "") || "0"}호`;
    }
  }

  const reBeon = new RegExp(RE_ROOM_BEON_3.source, "g");
  let beonMatch: RegExpExecArray | null;
  while ((beonMatch = reBeon.exec(t)) !== null) {
    if (isPhoneOrNumberContext(t, beonMatch.index, beonMatch.index + beonMatch[0].length)) {
      continue;
    }
    const digits = beonMatch[2];
    if (digits) {
      return `${digits}호`;
    }
  }

  const re = /[1-9]\d{2,3}/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(t)) !== null) {
    const start = m.index;
    const end = start + m[0].length;
    const before = t[start - 1];
    const after = t[end];
    if (before !== undefined && /\d/.test(before)) continue;
    if (after !== undefined && /\d/.test(after)) continue;
    if (before === "-" && after === "-") continue;
    if (before === "-" && after !== undefined && /\d/.test(after)) continue;
    if (after === "-" && before !== undefined && /\d/.test(before)) continue;

    if (isPhoneOrNumberContext(t, start, end)) continue;

    const n = parseInt(m[0], 10);
    if (m[0].length === 4 && isExcludedYearFourDigits(n)) continue;
    if (m[0].length === 4) continue;

    return `${m[0]}호`;
  }

  return null;
}

/**
 * 객실번호 확정: LLM entities → transcript 정규식 → 업로드 시 room_no_hint
 */
export function resolveRoomNo(input: {
  llmRoomNo?: string | null;
  transcript?: string | null;
  roomNoHint?: string | null;
}): string | null {
  const llm = input.llmRoomNo?.trim();
  if (llm) return llm;

  const tx = input.transcript?.trim();
  if (tx) {
    const fromTx = extractRoomNoFromTranscript(tx);
    if (fromTx) return fromTx;
  }

  const hint = input.roomNoHint?.trim();
  return hint || null;
}
