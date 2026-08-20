package com.stayopscall.mobile.core.calllog

import android.content.Context
import android.util.Log
import com.stayopscall.mobile.core.relay.CallTaskRelayClient
import com.stayopscall.mobile.core.relay.CallTaskRelayStore
import com.stayopscall.mobile.data.local.AppDatabaseProvider
import com.stayopscall.mobile.data.local.CallLogOutboxStatus
import com.stayopscall.mobile.data.local.entity.CallLogOutboxEntity
import com.stayopscall.mobile.work.CallLogRelayWorker
import kotlinx.coroutines.runBlocking

/**
 * Discover CallLog rows → durable Room outbox → enqueue relay worker.
 * Cursor advances only after successful outbox insert (or row already present).
 */
object CallLogOutboxIngestor {
    private const val TAG = "StayOpsCallRelay"

    data class IngestResult(
        val discovered: Int,
        val inserted: Int,
        val hasMore: Boolean,
        val stats: CallLogEndedCallScanner.ScanStats,
    )

    fun scanAndEnqueue(context: Context, trigger: String = "unknown"): IngestResult {
        val appContext = context.applicationContext
        val telemetry = CallLogScanTelemetryStore(appContext)

        if (!CallLogMatcher.hasCallLogPermission(appContext)) {
            telemetry.recordScanCompleted(
                result = "permission_denied",
                cursorBefore = CallLogCursorStore.Cursor(0L, 0L),
                cursorAfter = null,
                stats = CallLogEndedCallScanner.ScanStats(errors = 1),
            )
            return IngestResult(0, 0, false, CallLogEndedCallScanner.ScanStats(errors = 1))
        }

        migrateLegacyPrefsOnce(appContext)

        val cursorStore = CallLogCursorStore(appContext)
        val cursorBefore = cursorStore.bootstrapIfMissing()
        telemetry.recordScanAttempt(trigger, cursorBefore)

        val scanResult = CallLogEndedCallScanner.scanEndedCallsAfter(appContext, cursorBefore)
        val events = scanResult.events
        val hasMore = events.size >= CallLogEndedCallScanner.SCAN_BATCH_LIMIT
        var stats = scanResult.stats

        if (events.isEmpty()) {
            telemetry.recordScanCompleted("empty", cursorBefore, cursorBefore, stats)
            CallLogRelayWorker.enqueue(appContext)
            return IngestResult(0, 0, false, stats)
        }

        val dao = AppDatabaseProvider.get(appContext).callLogOutboxDao()
        val prefs = CallTaskRelayStore(appContext)
        var inserted = 0
        var alreadyOutbox = 0
        var legacyAcked = 0
        var lastAdvanced: EndedCallEvent? = null

        runBlocking {
            for (event in events) {
                Log.i(
                    TAG,
                    "[CALL_ENDED_DETECTED] callLogId=${event.callLogId} " +
                        "phone=***${event.normalizedPhone.takeLast(4)} " +
                        "duration=${event.durationSeconds}s direction=${event.direction}",
                )

                val existing = dao.findByCallLogId(event.callLogId)
                if (existing != null) {
                    alreadyOutbox++
                    lastAdvanced = event
                    continue
                }

                val alreadyAckedInPrefs = prefs.wasRelayed(event.callLogId)
                val sourceEventId = if (alreadyAckedInPrefs) {
                    "call-log:${event.callLogId}"
                } else {
                    CallTaskRelayClient.resolveSourceEventId(event)
                }
                val now = System.currentTimeMillis()
                val entity = CallLogOutboxEntity(
                    androidCallLogId = event.callLogId,
                    sourceEventId = sourceEventId,
                    phoneNumber = event.normalizedPhone,
                    contactName = event.contactName,
                    direction = event.direction,
                    startedAtMs = event.startedAtMs,
                    endedAtMs = event.endedAtMs,
                    durationSeconds = event.durationSeconds,
                    status = if (alreadyAckedInPrefs) {
                        CallLogOutboxStatus.Acked
                    } else {
                        CallLogOutboxStatus.Pending
                    },
                    ackedAt = if (alreadyAckedInPrefs) now else null,
                    createdAt = now,
                    updatedAt = now,
                )
                if (alreadyAckedInPrefs) legacyAcked++
                val rowId = dao.insertIgnore(entity)
                if (rowId != -1L && !alreadyAckedInPrefs) {
                    inserted++
                }
                lastAdvanced = event
            }
        }

        lastAdvanced?.let { cursorStore.advance(it.startedAtMs, it.callLogId) }
        val cursorAfter = cursorStore.getCursor()

        stats = stats.copy(
            enqueued = inserted,
            alreadyOutbox = alreadyOutbox,
            legacyAcked = legacyAcked,
        )
        telemetry.recordScanCompleted("ok", cursorBefore, cursorAfter, stats)

        CallLogRelayWorker.enqueue(appContext)
        if (hasMore) {
            CallLogRelayWorker.enqueueDiscover(appContext)
        }

        Log.i(
            TAG,
            "[OUTBOX_INGEST] trigger=$trigger discovered=${events.size} inserted=$inserted " +
                "alreadyOutbox=$alreadyOutbox skippedCursor=${stats.skippedCursor} hasMore=$hasMore",
        )
        return IngestResult(events.size, inserted, hasMore, stats)
    }

    /**
     * Seed ACKED outbox rows from legacy SharedPreferences relay_* to avoid resend storms.
     * Does not advance cursor past unknown history — bootstrap lookback still scans CallLog.
     */
    private fun migrateLegacyPrefsOnce(context: Context) {
        val cursorStore = CallLogCursorStore(context)
        if (cursorStore.isPrefsMigrated()) return

        val prefsStore = CallTaskRelayStore(context)
        val raw = context.getSharedPreferences("call_task_relay", Context.MODE_PRIVATE)
        val dao = AppDatabaseProvider.get(context).callLogOutboxDao()
        val now = System.currentTimeMillis()
        var seeded = 0

        runBlocking {
            for ((key, value) in raw.all) {
                if (!key.startsWith("relay_")) continue
                if (value != true) continue
                val id = key.removePrefix("relay_").toLongOrNull() ?: continue
                if (dao.findByCallLogId(id) != null) continue
                val rowId = dao.insertIgnore(
                    CallLogOutboxEntity(
                        androidCallLogId = id,
                        sourceEventId = "call-log:$id",
                        phoneNumber = "",
                        direction = "unknown",
                        startedAtMs = 0L,
                        endedAtMs = 0L,
                        durationSeconds = 0,
                        status = CallLogOutboxStatus.Acked,
                        ackedAt = now,
                        createdAt = now,
                        updatedAt = now,
                    ),
                )
                if (rowId != -1L) seeded++
                prefsStore.markRelayed(id)
            }
        }

        cursorStore.markPrefsMigrated()
        Log.i(TAG, "[OUTBOX_MIGRATE_PREFS] seededAcked=$seeded")
    }
}
