/**
 * 기존 분석 완료 통화에 대해 reservation_drafts 백필.
 *
 * 사용 (저장소 루트, .env.local 로드 — Node 20+):
 *   node --env-file=.env.local --import tsx scripts/backfillReservationDrafts.ts [days] [limit]
 *
 * 또는 dev 서버 + INTERNAL_API_TOKEN:
 *   curl -X POST -H "Authorization: Bearer $INTERNAL_API_TOKEN" \
 *     -H "Content-Type: application/json" \
 *     -d '{"days":14,"limit":500}' \
 *     http://localhost:3000/api/internal/backfill-reservation-drafts
 */

import { runBackfillReservationDrafts } from "../lib/db/reservationDrafts";

async function main() {
  const days = Number(process.argv[2]) || 14;
  const limit = Number(process.argv[3]) || 500;
  const result = await runBackfillReservationDrafts({
    days: Number.isFinite(days) ? days : 14,
    limit: Number.isFinite(limit) ? limit : 500,
  });
  console.log(JSON.stringify(result, null, 2));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
