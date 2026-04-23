import type { AnalysisResult } from "@/lib/analysis/schema";

const QUOTATION_HINTS =
  /단체|견적|패키지|행사|워크숍|객실\s*수|몇\s*실|견적서|팀빌딩|연수|세미나/;

// payment: 실제 결제 행위 — 예약 확인/입실일 문의와 구별하기 위해 엄격하게 적용
const PAYMENT_STRONG_HINTS =
  /계좌이체|입금\s*했|입금\s*완료|카드\s*결제|할부|영수증/;
const PAYMENT_WEAK_HINTS =
  /계약금|입금|결제|계좌번호/;

const RESERVATION_HINTS =
  /예약|내일|모레|몇\s*시|몇시|방|큰\s*방|욕조|가격|요금|현금|입실|퇴실|투숙|인원|도착|객실|체크인|체크아웃/;

const CHECKIN_HINTS =
  /체크인.*앞당|체크인.*당겨|일찍.*들어|입실.*시간|퇴실.*연장|연장.*투숙|늦게.*나가|레이트\s*체크아웃|얼리\s*체크인/;

const SERVICE_REQUEST_HINTS =
  /가져다|갖다\s*줘|갖다주|달라고|부탁|배달|수건|타올|침구|베개|휴지|핸드크림|샴푸|린스|칫솔|치약|면도기|슬리퍼|A4|용지|종이/;

const ACCESSIBILITY_HINTS =
  /휠체어|접근성|장애인|장애|엘리베이터|승강기|경사로|계단\s*없|무장애/;

function countReservationHints(text: string): number {
  const patterns = [
    /예약/,
    /내일|모레/,
    /몇\s*시|몇시/,
    /방/,
    /큰\s*방|큰방/,
    /욕조/,
    /가격|요금/,
    /현금/,
  ];
  return patterns.filter((p) => p.test(text)).length;
}

/**
 * LLM 결과에 휴리스틱 보정 적용.
 * - 신규 taxonomy(checkin_checkout, service_request 등) 미분류 보완
 * - payment 과승격 방지 (예약확인/입실문의 → payment 오분류 차단)
 * - 저신뢰도 통화 → other fallback
 */
export function applyAnalysisHeuristics(
  data: AnalysisResult,
  analysisInputText: string,
): AnalysisResult {
  // manual_review_required → other (신규 taxonomy 정규화)
  if (data.primary_intent === "manual_review_required") {
    return { ...data, primary_intent: "other" };
  }

  // 저신뢰도 통화: 노이즈가 많거나 분류 불가 → other로 fallback
  // 0.3 미만만 fallback (0.4는 너무 공격적 — checkin_checkout conf=0.35 회귀 원인)
  if ((data.confidence ?? 1) < 0.3 && data.primary_intent !== "other") {
    return { ...data, primary_intent: "other" };
  }

  const text = analysisInputText;
  let primary_intent = data.primary_intent;
  const secondary_tags = [...data.secondary_tags];

  // 단체/견적 보정 (reservation_inquiry 계열에만 적용, payment/complaint 등은 유지)
  if (
    QUOTATION_HINTS.test(text) &&
    ["other", "rate_inquiry", "reservation_inquiry", "service_request"].includes(primary_intent)
  ) {
    primary_intent = "reservation_inquiry";
  }

  // payment 보정: 실제 결제 행위만 승격 (예약확인/입실일 문의는 제외)
  // reservation_inquiry도 강한 힌트(계좌이체 등)가 있으면 payment로 전환
  if (
    primary_intent !== "complaint" &&
    primary_intent !== "maintenance" &&
    PAYMENT_STRONG_HINTS.test(text) &&
    ["other", "rate_inquiry", "service_request", "reservation_inquiry"].includes(primary_intent)
  ) {
    primary_intent = "payment";
  }
  if (
    primary_intent === "other" &&
    PAYMENT_WEAK_HINTS.test(text) &&
    !RESERVATION_HINTS.test(text)
  ) {
    primary_intent = "payment";
  }

  // checkin_checkout 보정: 입퇴실 시간 조정 키워드
  // 단, 예약 신청/문의가 주 맥락이면 reservation_inquiry 유지 (과보정 방지)
  const hasReservationPrimaryContext =
    /예약\s*(하|해|원|드|주|부탁|하고|이야기|관련|문의|신청|요청)/.test(text) &&
    countReservationHints(text) >= 3;
  if (
    CHECKIN_HINTS.test(text) &&
    ["reservation_inquiry", "other"].includes(primary_intent) &&
    !hasReservationPrimaryContext
  ) {
    primary_intent = "checkin_checkout";
  }

  // parking 과보정 방지: 대실/숙박 예약이 주 의도면 reservation_inquiry로 복원
  if (
    primary_intent === "parking" &&
    /대실|숙박|예약/.test(text) &&
    countReservationHints(text) >= 2
  ) {
    primary_intent = "reservation_inquiry";
  }

  // service_request 보정: 비품/어메니티 요청
  if (SERVICE_REQUEST_HINTS.test(text) && primary_intent === "other") {
    primary_intent = "service_request";
  }

  // reservation_inquiry 보정 (other / rate_inquiry → reservation_inquiry)
  const hintScore = countReservationHints(text);
  const hasReservationFlavor = RESERVATION_HINTS.test(text);
  if (
    primary_intent !== "payment" &&
    primary_intent !== "checkin_checkout" &&
    ["other", "rate_inquiry"].includes(primary_intent) &&
    hasReservationFlavor &&
    hintScore >= 2
  ) {
    primary_intent = "reservation_inquiry";
  }

  // legacy intent 정규화
  if (primary_intent === "rate_inquiry") primary_intent = "reservation_inquiry";
  if (primary_intent === "extension_request") primary_intent = "checkin_checkout";
  if (primary_intent === "quotation_intent") primary_intent = "reservation_inquiry";

  if (ACCESSIBILITY_HINTS.test(text) && !secondary_tags.includes("accessibility_inquiry")) {
    secondary_tags.push("accessibility_inquiry");
  }

  const intentChanged = primary_intent !== data.primary_intent;

  return {
    ...data,
    primary_intent,
    secondary_tags,
    confidence: intentChanged
      ? Math.min(0.95, (data.confidence ?? 0.7) + 0.05)
      : data.confidence,
  };
}
