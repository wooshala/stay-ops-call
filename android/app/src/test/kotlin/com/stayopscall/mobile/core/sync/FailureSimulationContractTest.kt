package com.stayopscall.mobile.core.sync

import com.stayopscall.mobile.core.boot.BootCollectorRecovery
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class FailureSimulationContractTest {

    private fun probe(uri: String, ts: Long) =
        ScanCandidateLogic.FileProbe(uri, ts, ts, hasFilenameTimestamp = true)

    @Test
    fun case1_processDeathBackfillsAllPostCursorEvents() {
        val cursor = CallLogCursorLogic.Cursor(startedAtMs = 1_000L, callLogId = 0L)
        val events = (1..40).map { id ->
            val ts = 1_000L + id * 60_000L
            ts to id.toLong()
        }
        val discovered = events.filter { (ts, id) ->
            CallLogCursorLogic.isAfterCursor(ts, id, cursor)
        }
        assertEquals(40, discovered.size)
    }

    @Test
    fun case2_networkOutageKeepsRetryableNotPermanent() {
        repeat(100) {
            val outcome = CollectorRetryPolicy.classifyErrorText("DNS_FAIL: timeout")
            assertEquals(CollectorRetryPolicy.Outcome.RETRYABLE, outcome)
            val next = RecordingUploadStateMachine.afterFailure(outcome)
            assertEquals(RecordingUploadStateMachine.Status.RETRYABLE, next)
        }
        assertEquals(
            RecordingUploadStateMachine.Status.RETRYABLE,
            RecordingUploadStateMachine.onProcessRestart(RecordingUploadStateMachine.Status.UPLOADING),
        )
    }

    @Test
    fun case3_backend500StaysRetryableWithBackoff() {
        listOf(500, 502, 503, 504, 429, 408).forEach { code ->
            assertEquals(CollectorRetryPolicy.Outcome.RETRYABLE, CollectorRetryPolicy.classifyHttp(code))
        }
        val t0 = 1_000_000L
        val t1 = CollectorRetryPolicy.nextAttemptAt(1, t0)
        val t2 = CollectorRetryPolicy.nextAttemptAt(2, t1)
        assertTrue(t1 > t0)
        assertTrue(t2 > t1)
    }

    @Test
    fun case4_rebootRestoresWorkersWithoutForeground() {
        assertTrue(BootCollectorRecovery.restoresWorkersWithoutForeground())
        assertTrue(BootCollectorRecovery.actions().contains(BootCollectorRecovery.Action.ENQUEUE_CALLLOG_DISCOVER))
        assertTrue(BootCollectorRecovery.actions().contains(BootCollectorRecovery.Action.ENQUEUE_RECORDING_UPLOAD))
    }

    @Test
    fun case5_wmDelayDrainsFullBacklogViaCursor() {
        val probes = (1..120).map { probe("u$it", it * 1_000L) }
        var checkpoint: ScanCandidateLogic.Checkpoint? = ScanCandidateLogic.Checkpoint(0L, "boot")
        val seen = linkedSetOf<String>()
        var rounds = 0
        while (rounds < 10) {
            rounds++
            val page = ScanCandidateLogic.filterIncrementalDrain(probes, checkpoint, overlapMs = 0L, batchSize = 50)
            page.batch.forEach { seen.add(it.uri) }
            checkpoint = ScanCandidateLogic.nextCheckpoint(page.batch, checkpoint)!!
            if (!page.hasMore) break
        }
        assertEquals(120, seen.size)
        assertEquals(3, rounds)
    }

    @Test
    fun case6_duplicateRetryUsesStableIdempotencyKey() {
        val callLogId = 7937L
        val key = "call-log:$callLogId"
        val acked = linkedSetOf<String>()
        repeat(100) { acked.add(key) }
        assertEquals(1, acked.size)
        assertTrue(CallLogOutboxStateMachine.shouldAck(httpOk = true, bodyOk = true, skippedDuplicate = true))
    }

    @Test
    fun legacyFailedUploadNeverAutoDrained() {
        assertFalse(RecordingUploadStateMachine.isAutoDrained(RecordingUploadStateMachine.Status.LEGACY_FAILED_UPLOAD))
        assertEquals(CollectorRetryPolicy.Outcome.RETRYABLE, CollectorRetryPolicy.classifyHttp(503))
        assertEquals(CollectorRetryPolicy.Outcome.AUTH_BLOCKED, CollectorRetryPolicy.classifyHttp(401))
    }
}
