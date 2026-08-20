package com.stayopscall.mobile.core.calllog

import android.content.Context

/**
 * Durable scan cursor for CallLog provider.
 * Advances only after rows are successfully inserted into the Room outbox (or confirmed already present).
 *
 * Identity: (startedAtMs, androidCallLogId) — CallLog._ID alone is OEM-stable enough for uniqueness
 * but time+id ordering is safer for incremental scans.
 */
class CallLogCursorStore(context: Context) {
    private val prefs = context.applicationContext.getSharedPreferences(PREFS, Context.MODE_PRIVATE)

    data class Cursor(
        val startedAtMs: Long,
        val callLogId: Long,
    )

    fun getCursor(): Cursor? {
        if (!prefs.contains(KEY_STARTED_AT)) return null
        return Cursor(
            startedAtMs = prefs.getLong(KEY_STARTED_AT, 0L),
            callLogId = prefs.getLong(KEY_CALL_LOG_ID, 0L),
        )
    }

    fun advance(startedAtMs: Long, callLogId: Long) {
        val current = getCursor()
        if (current != null) {
            val ahead = startedAtMs > current.startedAtMs ||
                (startedAtMs == current.startedAtMs && callLogId > current.callLogId)
            if (!ahead) return
        }
        prefs.edit()
            .putLong(KEY_STARTED_AT, startedAtMs)
            .putLong(KEY_CALL_LOG_ID, callLogId)
            .apply()
    }

    fun bootstrapIfMissing(nowMs: Long = System.currentTimeMillis()): Cursor {
        getCursor()?.let { return it }
        val boot = Cursor(
            startedAtMs = (nowMs - BOOTSTRAP_LOOKBACK_MS).coerceAtLeast(0L),
            callLogId = 0L,
        )
        prefs.edit()
            .putLong(KEY_STARTED_AT, boot.startedAtMs)
            .putLong(KEY_CALL_LOG_ID, boot.callLogId)
            .putBoolean(KEY_BOOTSTRAPPED, true)
            .apply()
        return boot
    }

    fun isPrefsMigrated(): Boolean = prefs.getBoolean(KEY_PREFS_MIGRATED, false)

    fun markPrefsMigrated() {
        prefs.edit().putBoolean(KEY_PREFS_MIGRATED, true).apply()
    }

    companion object {
        private const val PREFS = "call_log_cursor"
        private const val KEY_STARTED_AT = "cursor_started_at_ms"
        private const val KEY_CALL_LOG_ID = "cursor_call_log_id"
        private const val KEY_BOOTSTRAPPED = "bootstrapped"
        private const val KEY_PREFS_MIGRATED = "prefs_relay_migrated"

        /** First install / missing cursor: scan last 7 days (not infinite history). */
        const val BOOTSTRAP_LOOKBACK_MS = 7L * 24 * 60 * 60 * 1000
    }
}
