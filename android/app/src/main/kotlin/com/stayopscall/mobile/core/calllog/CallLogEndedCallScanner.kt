package com.stayopscall.mobile.core.calllog

import android.content.Context
import android.provider.CallLog

object CallLogEndedCallScanner {
    const val MIN_DURATION_SECONDS = 20
    /** Per scan batch — remaining rows are picked up by the next cursor pass / self-enqueue. */
    const val SCAN_BATCH_LIMIT = 100

    data class ScanStats(
        val scannedRows: Int = 0,
        val newFound: Int = 0,
        val enqueued: Int = 0,
        val alreadyOutbox: Int = 0,
        val legacyAcked: Int = 0,
        val skippedCursor: Int = 0,
        val skippedDirection: Int = 0,
        val skippedDuration: Int = 0,
        val skippedNormalize: Int = 0,
        val errors: Int = 0,
        val oldestRowSeenMs: Long? = null,
        val newestRowSeenMs: Long? = null,
    )

    data class ScanBatchResult(
        val events: List<EndedCallEvent>,
        val stats: ScanStats,
    )

    /**
     * Cursor-based scan: rows strictly after [cursor], duration ≥ [MIN_DURATION_SECONDS],
     * inbound/outbound only, oldest-first, up to [limit].
     */
    fun scanEndedCallsAfter(
        context: Context,
        cursor: CallLogCursorStore.Cursor,
        limit: Int = SCAN_BATCH_LIMIT,
    ): ScanBatchResult {
        if (!CallLogMatcher.hasCallLogPermission(context)) {
            return ScanBatchResult(emptyList(), ScanStats(errors = 1))
        }

        var scannedRows = 0
        var skippedCursor = 0
        var skippedDirection = 0
        var skippedDuration = 0
        var skippedNormalize = 0
        var oldestRowSeenMs: Long? = null
        var newestRowSeenMs: Long? = null

        val queryCursor = context.contentResolver.query(
            CallLog.Calls.CONTENT_URI,
            arrayOf(
                CallLog.Calls._ID,
                CallLog.Calls.NUMBER,
                CallLog.Calls.DATE,
                CallLog.Calls.DURATION,
                CallLog.Calls.TYPE,
                CallLog.Calls.CACHED_NAME,
            ),
            "${CallLog.Calls.DATE} >= ? AND ${CallLog.Calls.DURATION} >= ?",
            arrayOf(cursor.startedAtMs.toString(), MIN_DURATION_SECONDS.toString()),
            "${CallLog.Calls.DATE} ASC, ${CallLog.Calls._ID} ASC",
        ) ?: return ScanBatchResult(emptyList(), ScanStats(errors = 1))

        val results = mutableListOf<EndedCallEvent>()
        queryCursor.use {
            val idIdx = it.getColumnIndex(CallLog.Calls._ID)
            val numberIdx = it.getColumnIndex(CallLog.Calls.NUMBER)
            val dateIdx = it.getColumnIndex(CallLog.Calls.DATE)
            val durationIdx = it.getColumnIndex(CallLog.Calls.DURATION)
            val typeIdx = it.getColumnIndex(CallLog.Calls.TYPE)
            val nameIdx = it.getColumnIndex(CallLog.Calls.CACHED_NAME)
            if (idIdx < 0 || numberIdx < 0 || dateIdx < 0 || durationIdx < 0 || typeIdx < 0) {
                return ScanBatchResult(emptyList(), ScanStats(errors = 1))
            }

            while (it.moveToNext() && results.size < limit) {
                scannedRows++
                val callLogId = it.getLong(idIdx)
                val dateMs = it.getLong(dateIdx)
                oldestRowSeenMs = oldestRowSeenMs?.let { o -> minOf(o, dateMs) } ?: dateMs
                newestRowSeenMs = newestRowSeenMs?.let { n -> maxOf(n, dateMs) } ?: dateMs

                val afterCursor = dateMs > cursor.startedAtMs ||
                    (dateMs == cursor.startedAtMs && callLogId > cursor.callLogId)
                if (!afterCursor) {
                    skippedCursor++
                    continue
                }

                val direction = CallLogMatcher.mapDirection(it.getInt(typeIdx))
                if (direction != "inbound" && direction != "outbound") {
                    skippedDirection++
                    continue
                }

                val rawNumber = it.getString(numberIdx)?.trim().orEmpty()
                val normalized = PhoneNormalizer.normalize(rawNumber)
                if (normalized == null) {
                    skippedNormalize++
                    continue
                }
                val durationSec = it.getLong(durationIdx).toInt()
                if (durationSec < MIN_DURATION_SECONDS) {
                    skippedDuration++
                    continue
                }

                val cachedName = if (nameIdx >= 0) {
                    it.getString(nameIdx)?.trim()?.takeIf { name -> name.isNotEmpty() }
                } else {
                    null
                }

                results.add(
                    EndedCallEvent(
                        callLogId = callLogId,
                        normalizedPhone = normalized,
                        contactName = cachedName,
                        startedAtMs = dateMs,
                        endedAtMs = dateMs + durationSec * 1000L,
                        durationSeconds = durationSec,
                        direction = direction,
                    ),
                )
            }
        }

        return ScanBatchResult(
            events = results,
            stats = ScanStats(
                scannedRows = scannedRows,
                newFound = results.size,
                skippedCursor = skippedCursor,
                skippedDirection = skippedDirection,
                skippedDuration = skippedDuration,
                skippedNormalize = skippedNormalize,
                oldestRowSeenMs = oldestRowSeenMs,
                newestRowSeenMs = newestRowSeenMs,
            ),
        )
    }

    /**
     * Legacy wall-clock lookback (tests / diagnostics only). Production path uses [scanEndedCallsAfter].
     */
    @Deprecated("Use scanEndedCallsAfter with durable cursor")
    fun scanRecentEndedCalls(context: Context, sinceMs: Long): List<EndedCallEvent> {
        return scanEndedCallsAfter(
            context,
            CallLogCursorStore.Cursor(startedAtMs = sinceMs, callLogId = 0L),
            limit = SCAN_BATCH_LIMIT,
        ).events
    }
}
