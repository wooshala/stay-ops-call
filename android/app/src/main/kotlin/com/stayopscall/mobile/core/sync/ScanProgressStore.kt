package com.stayopscall.mobile.core.sync

import android.content.Context
import android.util.Log
import org.json.JSONObject
import java.util.UUID

/**
 * Scan run diagnostics + incremental checkpoint.
 * Never stores file names, phone numbers, or other PII.
 */
class ScanProgressStore(context: Context) {
    private val prefs = context.applicationContext.getSharedPreferences(PREFS, Context.MODE_PRIVATE)

    fun beginRun(mode: String): String {
        val runId = UUID.randomUUID().toString().take(8)
        val now = System.currentTimeMillis()
        prefs.edit()
            .putString(KEY_RUN_ID, runId)
            .putLong(KEY_STARTED_AT, now)
            .remove(KEY_COMPLETED_AT)
            .putString(KEY_PHASE, Phase.STARTED)
            .putString(KEY_MODE, mode)
            .putInt(KEY_ENUMERATED, 0)
            .putInt(KEY_CANDIDATES, 0)
            .putInt(KEY_INSERTED, 0)
            .putString(KEY_RESULT, Result.RUNNING)
            .putLong(KEY_ELAPSED_MS, 0L)
            .putString(KEY_TIMINGS_JSON, "{}")
            .commit()
        return runId
    }

    fun setPhase(phase: String) {
        prefs.edit().putString(KEY_PHASE, phase).commit()
    }

    fun setCounts(enumerated: Int? = null, candidates: Int? = null, inserted: Int? = null) {
        val e = prefs.edit()
        if (enumerated != null) e.putInt(KEY_ENUMERATED, enumerated)
        if (candidates != null) e.putInt(KEY_CANDIDATES, candidates)
        if (inserted != null) e.putInt(KEY_INSERTED, inserted)
        e.commit()
    }

    fun recordTiming(segment: String, elapsedMs: Long) {
        val json = runCatching { JSONObject(prefs.getString(KEY_TIMINGS_JSON, "{}")!!) }
            .getOrElse { JSONObject() }
        json.put(segment, elapsedMs)
        prefs.edit().putString(KEY_TIMINGS_JSON, json.toString()).commit()
    }

    fun finish(result: String, startedAtFallback: Long = System.currentTimeMillis()) {
        val started = prefs.getLong(KEY_STARTED_AT, startedAtFallback)
        val now = System.currentTimeMillis()
        prefs.edit()
            .putString(KEY_PHASE, if (result == Result.SUCCESS) Phase.COMPLETED else result)
            .putString(KEY_RESULT, result)
            .putLong(KEY_COMPLETED_AT, now)
            .putLong(KEY_ELAPSED_MS, (now - started).coerceAtLeast(0L))
            .commit()
        logSnapshot("finish result=$result")
    }

    fun markStaleRecovered(reason: String) {
        Log.w(TAG, "stale_scan_recovered reason=$reason ${snapshotLine()}")
        prefs.edit()
            .putString(KEY_PHASE, Phase.TIMED_OUT)
            .putString(KEY_RESULT, Result.STALE_RECOVERED)
            .putLong(KEY_COMPLETED_AT, System.currentTimeMillis())
            .commit()
    }

    fun isStale(nowMs: Long = System.currentTimeMillis(), staleAfterMs: Long = DEFAULT_STALE_MS): Boolean {
        if (!prefs.contains(KEY_STARTED_AT)) return false
        val result = prefs.getString(KEY_RESULT, null)
        if (result != null && result != Result.RUNNING) return false
        if (prefs.contains(KEY_COMPLETED_AT)) return false
        val started = prefs.getLong(KEY_STARTED_AT, 0L)
        if (started <= 0L) return false
        return nowMs - started > staleAfterMs
    }

    fun startedAtOrNull(): Long? =
        if (prefs.contains(KEY_STARTED_AT)) prefs.getLong(KEY_STARTED_AT, 0L) else null

    fun resultOrNull(): String? = prefs.getString(KEY_RESULT, null)

    fun timingsJson(): String = prefs.getString(KEY_TIMINGS_JSON, "{}") ?: "{}"

    fun snapshotLine(): String {
        return "run=${prefs.getString(KEY_RUN_ID, "-")} " +
            "phase=${prefs.getString(KEY_PHASE, "-")} " +
            "mode=${prefs.getString(KEY_MODE, "-")} " +
            "enum=${prefs.getInt(KEY_ENUMERATED, 0)} " +
            "cand=${prefs.getInt(KEY_CANDIDATES, 0)} " +
            "ins=${prefs.getInt(KEY_INSERTED, 0)} " +
            "elapsed=${prefs.getLong(KEY_ELAPSED_MS, 0)} " +
            "result=${prefs.getString(KEY_RESULT, "-")} " +
            "timings=${timingsJson()}"
    }

    private fun logSnapshot(prefix: String) {
        Log.d(TAG, "$prefix ${snapshotLine()}")
    }

    // --- checkpoint (advance only after successful completed scan) ---

    fun lastSuccessfulScanAt(): Long? =
        if (prefs.contains(KEY_LAST_SUCCESS_AT)) prefs.getLong(KEY_LAST_SUCCESS_AT, 0L) else null

    fun lastSeenRecordingTimestamp(): Long? =
        if (prefs.contains(KEY_LAST_SEEN_TS)) prefs.getLong(KEY_LAST_SEEN_TS, 0L) else null

    fun lastSeenUri(): String? = prefs.getString(KEY_LAST_SEEN_URI, null)

    fun lastFullReconcileAt(): Long? =
        if (prefs.contains(KEY_LAST_FULL_RECONCILE_AT)) {
            prefs.getLong(KEY_LAST_FULL_RECONCILE_AT, 0L)
        } else {
            null
        }

    fun reconcileOffset(): Int = prefs.getInt(KEY_RECONCILE_OFFSET, 0)

    fun setReconcileOffset(offset: Int) {
        prefs.edit().putInt(KEY_RECONCILE_OFFSET, offset.coerceAtLeast(0)).commit()
    }

    fun reconcileCursor(): ScanCandidateLogic.Checkpoint? {
        if (!prefs.contains(KEY_RECONCILE_CURSOR_TS)) return null
        return ScanCandidateLogic.Checkpoint(
            lastSeenTimestamp = prefs.getLong(KEY_RECONCILE_CURSOR_TS, 0L),
            lastSeenUri = prefs.getString(KEY_RECONCILE_CURSOR_URI, null),
        )
    }

    fun setReconcileCursor(cursor: ScanCandidateLogic.Checkpoint?) {
        val e = prefs.edit()
        if (cursor == null) {
            e.remove(KEY_RECONCILE_CURSOR_TS).remove(KEY_RECONCILE_CURSOR_URI)
        } else {
            e.putLong(KEY_RECONCILE_CURSOR_TS, cursor.lastSeenTimestamp)
                .putString(KEY_RECONCILE_CURSOR_URI, cursor.lastSeenUri)
        }
        e.commit()
    }

    /**
     * Advance incremental checkpoint only after a fully successful scan that finished inserts.
     */
    fun advanceCheckpoint(
        seenTimestamp: Long,
        seenUri: String,
        nowMs: Long = System.currentTimeMillis(),
    ) {
        prefs.edit()
            .putLong(KEY_LAST_SUCCESS_AT, nowMs)
            .putLong(KEY_LAST_SEEN_TS, seenTimestamp)
            .putString(KEY_LAST_SEEN_URI, seenUri)
            .commit()
        Log.d(TAG, "checkpoint_advanced ts=$seenTimestamp uriLen=${seenUri.length}")
    }

    fun markFullReconcileComplete(nowMs: Long = System.currentTimeMillis()) {
        prefs.edit()
            .putLong(KEY_LAST_FULL_RECONCILE_AT, nowMs)
            .putInt(KEY_RECONCILE_OFFSET, 0)
            .remove(KEY_RECONCILE_CURSOR_TS)
            .remove(KEY_RECONCILE_CURSOR_URI)
            .commit()
        Log.d(TAG, "full_reconcile_complete")
    }

    fun needsFullReconcile(
        nowMs: Long = System.currentTimeMillis(),
        intervalMs: Long = FULL_RECONCILE_INTERVAL_MS,
    ): Boolean {
        val last = lastFullReconcileAt() ?: return true
        return nowMs - last >= intervalMs
    }

    object Phase {
        const val STARTED = "STARTED"
        const val LIST_FILES_BEGIN = "LIST_FILES_BEGIN"
        const val LIST_FILES_DONE = "LIST_FILES_DONE"
        const val FILTER_DONE = "FILTER_DONE"
        const val ROOM_COMPARE_DONE = "ROOM_COMPARE_DONE"
        const val INSERT_DONE = "INSERT_DONE"
        const val COMPLETED = "COMPLETED"
        const val FAILED = "FAILED"
        const val TIMED_OUT = "TIMED_OUT"
    }

    object Result {
        const val RUNNING = "RUNNING"
        const val SUCCESS = "SUCCESS"
        const val FAILED = "FAILED"
        const val TIMED_OUT = "TIMED_OUT"
        const val STALE_RECOVERED = "STALE_RECOVERED"
    }

    companion object {
        private const val TAG = "StayOpsScanState"
        private const val PREFS = "scan_progress"

        const val DEFAULT_STALE_MS = 10 * 60 * 1000L
        const val FULL_RECONCILE_INTERVAL_MS = 24 * 60 * 60 * 1000L

        private const val KEY_RUN_ID = "scan_run_id"
        private const val KEY_STARTED_AT = "scan_started_at"
        private const val KEY_COMPLETED_AT = "scan_completed_at"
        private const val KEY_PHASE = "scan_phase"
        private const val KEY_MODE = "scan_mode"
        private const val KEY_ENUMERATED = "scan_enumerated_count"
        private const val KEY_CANDIDATES = "scan_candidate_count"
        private const val KEY_INSERTED = "scan_inserted_count"
        private const val KEY_ELAPSED_MS = "scan_elapsed_ms"
        private const val KEY_RESULT = "scan_result"
        private const val KEY_TIMINGS_JSON = "scan_timings_json"

        private const val KEY_LAST_SUCCESS_AT = "last_successful_scan_at"
        private const val KEY_LAST_SEEN_TS = "last_seen_recording_timestamp"
        private const val KEY_LAST_SEEN_URI = "last_seen_uri"
        private const val KEY_LAST_FULL_RECONCILE_AT = "last_full_reconcile_at"
        private const val KEY_RECONCILE_OFFSET = "reconcile_offset"
        private const val KEY_RECONCILE_CURSOR_TS = "reconcile_cursor_ts"
        private const val KEY_RECONCILE_CURSOR_URI = "reconcile_cursor_uri"
    }
}
