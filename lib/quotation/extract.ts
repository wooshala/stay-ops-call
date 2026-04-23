import {
  QuotationExtractionSchema,
  type QuotationExtraction,
} from "@/lib/quotation/types";

function pickFirstNumber(s: string, re: RegExp): number | null {
  const m = re.exec(s);
  if (!m?.[1]) return null;
  const n = parseInt(m[1].replace(/,/g, ""), 10);
  return Number.isFinite(n) ? n : null;
}

function pickFirstFloat(s: string, re: RegExp): number | null {
  const m = re.exec(s);
  if (!m?.[1]) return null;
  const n = parseFloat(m[1].replace(/,/g, ""));
  return Number.isFinite(n) ? n : null;
}

/**
 * 마스킹된 STT에서 견적·단체 관련 필드를 휴리스틱으로 추출한다.
 * 긴 통화는 `buildExtractionFocusedText`로 줄인 텍스트를 넣는다.
 */
export function extractQuotationFromText(text: string): QuotationExtraction {
  const t = text.replace(/\s+/g, " ").trim();
  if (!t) return {};

  const out: Record<string, unknown> = {};

  const reMonthDay = /(\d{1,2})\s*월\s*(\d{1,2})\s*일/g;
  const dates: string[] = [];
  let md: RegExpExecArray | null;
  while ((md = reMonthDay.exec(t)) !== null) {
    dates.push(`${md[1]}월 ${md[2]}일`);
  }
  if (dates.length >= 1) out.checkin_date = dates[0];
  if (dates.length >= 2) out.checkout_date = dates[1];

  const slash = t.match(/\b(\d{1,2})[/.-](\d{1,2})\b/);
  if (slash && !out.checkin_date) {
    out.checkin_date = `${slash[1]}/${slash[2]}`;
  }

  let rc =
    pickFirstNumber(t, /(\d+)\s*실\b/) ??
    pickFirstNumber(t, /객실\s*(\d+)/) ??
    pickFirstNumber(t, /(\d+)\s*룸\b/);
  if (rc != null && rc > 0 && rc < 500) out.room_count = rc;

  const man = pickFirstFloat(t, /(\d+(?:\.\d+)?)\s*만\s*원/);
  if (man != null) out.total_price = Math.round(man * 10000);
  if (out.total_price == null) {
    const won = pickFirstNumber(
      t,
      /(?:총|합계|금액)\s*(\d{1,3}(?:,\d{3})+|\d{4,})\s*원/,
    );
    if (won != null) out.total_price = won;
  }

  const depMan = pickFirstFloat(t, /(?:예약금|계약금)[^만]*(\d+(?:\.\d+)?)\s*만\s*원/);
  const depWon = pickFirstNumber(
    t,
    /(?:예약금|계약금)\s*(?:은|는|이)?\s*(\d+(?:,\d{3})*|\d+)\s*원/,
  );
  if (depMan != null) out.deposit_amount = Math.round(depMan * 10000);
  else if (depWon != null) out.deposit_amount = depWon;

  const hc =
    pickFirstNumber(t, /(?:인원)\s*(?:은|는|이)?\s*(\d+)\s*명/) ??
    pickFirstNumber(t, /(\d+)\s*명\s*(?:이|으로|예정)/) ??
    pickFirstNumber(t, /(\d+)\s*명\b/);
  if (hc != null && hc > 0 && hc < 10000) out.headcount = hc;

  const pk =
    pickFirstNumber(t, /주차\s*(\d+)\s*대/) ??
    pickFirstNumber(t, /(\d+)\s*대\s*주차/) ??
    pickFirstNumber(t, /주차(?:장)?\s*(?:은|는)?\s*(\d+)/);
  if (pk != null && pk >= 0 && pk < 5000) out.parking_count = pk;

  if (/카드|신용|체크/.test(t)) out.payment_method = "card";
  else if (/계좌|이체/.test(t)) out.payment_method = "account_transfer";
  else if (/현금|현장\s*결제/.test(t)) out.payment_method = "cash";

  const parsed = QuotationExtractionSchema.safeParse(out);
  return parsed.success ? parsed.data : {};
}
