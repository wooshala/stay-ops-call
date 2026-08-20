package com.stayopscall.mobile.core.calllog

import android.content.Context
import org.json.JSONObject

/**
 * CALL-RELIABILITY-04 — read-only diagnostic telemetry for CallLog scan.
 * Stored in SharedPreferences; exported via heartbeat. Does not mutate queues.
 */
class CallLogScanTelemetryStore(context: Context) {
    private val prefs = context.applicationContext.getSharedPreferences(PREFS, Context.MODE_PRIVATE)

    fun recordScanAttempt(trigger: String, cursorBefore: CallLogCursorStore.Cursor) {
        val now = System.currentTimeMillis()
        prefs.edit()
            .putLong(KEY_ATTEMPT_MS, now)
            .putString(KEY_TRIGGER, trigger)
            .putString(KEY_CURSOR_BEFORE, cursorJson(cursorBefore))
            .putString(KEY_RESULT, "in_progress")
            .apply()
    }

    fun recordScanCompleted(
        result: String,
        cursorBefore: CallLogCursorStore.Cursor,
        cursorAfter: CallLogCursorStore.Cursor?,
        stats: CallLogEndedCallScanner.ScanStats,
    ) {
        val now = System.currentTimeMillis()
        val statsJson = JSONObject().apply {
            put("scannedRows", stats.scannedRows)
            put("newFound", stats.newFound)
            put("enqueued", stats.enqueued)
            put("alreadyOutbox", stats.alreadyOutbox)
            put("legacyAcked", stats.legacyAcked)
            put("skippedCursor", stats.skippedCursor)
            put("skippedDirection", stats.skippedDirection)
            put("skippedDuration", stats.skippedDuration)
            put("skippedNormalize", stats.skippedNormalize)
            put("errors", stats.errors)
            put("oldestRowSeenMs", stats.oldestRowSeenMs ?: JSONObject.NULL)
            put("newestRowSeenMs", stats.newestRowSeenMs ?: JSONObject.NULL)
        }
        prefs.edit()
            .putLong(KEY_COMPLETED_MS, now)
            .putString(KEY_RESULT, result)
            .putString(KEY_CURSOR_BEFORE, cursorJson(cursorBefore))
            .putString(KEY_CURSOR_AFTER, cursorAfter?.let { cursorJson(it) })
            .putString(KEY_STATS_JSON, statsJson.toString())
            .apply()
    }

    fun lastAttemptMs(): Long? = prefs.getLong(KEY_ATTEMPT_MS, 0L).takeIf { prefs.contains(KEY_ATTEMPT_MS) }
    fun lastCompletedMs(): Long? = prefs.getLong(KEY_COMPLETED_MS, 0L).takeIf { prefs.contains(KEY_COMPLETED_MS) }
    fun lastResult(): String? = prefs.getString(KEY_RESULT, null)
    fun lastTrigger(): String? = prefs.getString(KEY_TRIGGER, null)
    fun lastStatsJson(): String? = prefs.getString(KEY_STATS_JSON, null)
    fun lastCursorBeforeJson(): String? = prefs.getString(KEY_CURSOR_BEFORE, null)
    fun lastCursorAfterJson(): String? = prefs.getString(KEY_CURSOR_AFTER, null)

    private fun cursorJson(c: CallLogCursorStore.Cursor): String =
        JSONObject().apply {
            put("startedAtMs", c.startedAtMs)
            put("callLogId", c.callLogId)
        }.toString()

    companion object {
        private const val PREFS = "calllog_scan_telemetry"
        const val KEY_ATTEMPT_MS = "last_scan_attempt_ms"
        const val KEY_COMPLETED_MS = "last_scan_completed_ms"
        const val KEY_RESULT = "last_scan_result"
        const val KEY_TRIGGER = "last_scan_trigger"
        const val KEY_STATS_JSON = "last_scan_stats_json"
        const val KEY_CURSOR_BEFORE = "last_cursor_before_json"
        const val KEY_CURSOR_AFTER = "last_cursor_after_json"
    }
}
