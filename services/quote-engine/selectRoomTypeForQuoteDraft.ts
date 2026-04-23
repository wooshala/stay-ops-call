import { rebuildQuoteDraftByRoomType } from "./rebuildQuoteDraftByRoomType";
import { QuoteDraft, RoomType } from "./types";

export function selectRoomTypeForQuoteDraft(
  draft: QuoteDraft,
  roomType: RoomType,
  now?: Date,
): QuoteDraft {
  return rebuildQuoteDraftByRoomType(draft, roomType, now);
}
