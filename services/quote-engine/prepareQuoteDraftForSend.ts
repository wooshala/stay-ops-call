import { QuoteDraft } from "./types";

export interface QuoteSendPreparationResult {
  canSend: boolean;
  blockedReasons: string[];
}

function hasMissingCoreFields(draft: QuoteDraft): boolean {
  if (!draft.stayType) return true;
  if (!draft.selectedRoomType) return true;
  if (draft.priceSnapshot.roomType === null) return true;
  return false;
}

export function prepareQuoteDraftForSend(draft: QuoteDraft): QuoteSendPreparationResult {
  const blockedReasons: string[] = [];

  if (!draft.isPhoneNumberValid) {
    blockedReasons.push("전화번호 확인 필요");
  }

  if (draft.priceSnapshot.price === null) {
    blockedReasons.push("가격 정보 확인 필요");
  }

  if (hasMissingCoreFields(draft)) {
    blockedReasons.push("필수 견적 정보 부족");
  }

  if (draft.needsReviewReasons.length > 0) {
    for (const reason of draft.needsReviewReasons) {
      if (!blockedReasons.includes(reason)) {
        blockedReasons.push(reason);
      }
    }
  }

  return {
    canSend: blockedReasons.length === 0,
    blockedReasons,
  };
}
