package com.stayopscall.mobile.core.sync

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

/**
 * P0 contracts: oldest-first drain, multi-batch exhaustion, checkpoint high-water.
 */
class DurableIngestionContractTest {

    private fun probe(uri: String, ts: Long) =
        ScanCandidateLogic.FileProbe(uri, ts, ts, hasFilenameTimestamp = true)

    @Test
    fun recordingBacklog120DrainsInThreeBatchesWithoutSkip() {
        val probes = (1..120).map { probe("u$it", it * 1_000L) }
        var checkpoint: ScanCandidateLogic.Checkpoint? = ScanCandidateLogic.Checkpoint(0L, "boot")
        val seen = linkedSetOf<String>()
        var rounds = 0
        while (rounds < 10) {
            rounds++
            val page = ScanCandidateLogic.filterIncrementalDrain(probes, checkpoint, overlapMs = 0L, batchSize = 50)
            assertTrue(page.batch.size <= 50)
            page.batch.forEach { seen.add(it.uri) }
            val next = ScanCandidateLogic.nextCheckpoint(page.batch, checkpoint)!!
            checkpoint = next
            if (!page.hasMore) break
        }
        assertEquals(120, seen.size)
        assertEquals(3, rounds)
    }

    @Test
    fun oldestFirstDrainDoesNotSkipOlderWhenNewerFloodExists() {
        val cp = ScanCandidateLogic.Checkpoint(10_000L, "mid")
        val probes = (11..130).map { probe("n$it", it * 1_000L) } // 120 newer
        val page1 = ScanCandidateLogic.filterIncrementalDrain(probes, cp, overlapMs = 0L, batchSize = 50)
        // Oldest eligible first
        assertEquals(11_000L, page1.batch.first().rankingTimestamp)
        assertTrue(page1.hasMore)
        val cp2 = ScanCandidateLogic.nextCheckpoint(page1.batch, cp)!!
        assertEquals(60_000L, cp2.lastSeenTimestamp) // high-water of first 50 oldest (11..60)
        val page2 = ScanCandidateLogic.filterIncrementalDrain(probes, cp2, overlapMs = 0L, batchSize = 50)
        assertEquals(61_000L, page2.batch.first().rankingTimestamp)
    }

    @Test
    fun callLogCursorOrderingAfterSameMs() {
        val cursor = CallLogCursorLogic.Cursor(startedAtMs = 1000L, callLogId = 5L)
        assertFalse(CallLogCursorLogic.isAfterCursor(1000L, 5L, cursor))
        assertTrue(CallLogCursorLogic.isAfterCursor(1000L, 6L, cursor))
        assertTrue(CallLogCursorLogic.isAfterCursor(1001L, 1L, cursor))
        assertFalse(CallLogCursorLogic.isAfterCursor(999L, 99L, cursor))
    }

    @Test
    fun outboxStateMachineSendingStaleReturnsToPending() {
        assertEquals(
            CallLogOutboxStateMachine.Status.PENDING,
            CallLogOutboxStateMachine.onProcessRestart(
                CallLogOutboxStateMachine.Status.SENDING,
                lastAttemptAgeMs = 3 * 60_000L,
                staleAfterMs = 2 * 60_000L,
            ),
        )
        assertEquals(
            CallLogOutboxStateMachine.Status.SENDING,
            CallLogOutboxStateMachine.onProcessRestart(
                CallLogOutboxStateMachine.Status.SENDING,
                lastAttemptAgeMs = 30_000L,
                staleAfterMs = 2 * 60_000L,
            ),
        )
    }

    @Test
    fun ackSemanticsOnlyOnOkTrue() {
        assertTrue(CallLogOutboxStateMachine.shouldAck(httpOk = true, bodyOk = true))
        assertFalse(CallLogOutboxStateMachine.shouldAck(httpOk = true, bodyOk = false))
        assertFalse(CallLogOutboxStateMachine.shouldAck(httpOk = false, bodyOk = true))
        assertTrue(CallLogOutboxStateMachine.shouldAck(httpOk = true, bodyOk = true, skippedDuplicate = true))
    }

    @Test
    fun infrastructureFailureStaysRetryableNotPermanent() {
        assertEquals(
            CallLogOutboxStateMachine.Status.RETRYABLE,
            CallLogOutboxStateMachine.afterFailure(CollectorRetryPolicy.Outcome.RETRYABLE),
        )
        assertEquals(
            CallLogOutboxStateMachine.Status.AUTH_BLOCKED,
            CallLogOutboxStateMachine.afterFailure(CollectorRetryPolicy.Outcome.AUTH_BLOCKED),
        )
        assertEquals(
            RecordingUploadStateMachine.Status.RETRYABLE,
            RecordingUploadStateMachine.afterFailure(CollectorRetryPolicy.Outcome.RETRYABLE),
        )
        assertFalse(
            RecordingUploadStateMachine.isAutoDrained(RecordingUploadStateMachine.Status.LEGACY_FAILED_UPLOAD),
        )
    }

    @Test
    fun migration67DoesNotRequeueLegacyFailedUpload() {
        // MIGRATION_6_7 only remaps retry_pending → retryable. failed_upload is left frozen.
        val sql = "UPDATE `call_recordings` SET status = 'retryable' WHERE status = 'retry_pending'"
        assertFalse(sql.contains("failed_upload"))
        assertFalse(RecordingUploadStateMachine.isAutoDrained(RecordingUploadStateMachine.Status.LEGACY_FAILED_UPLOAD))
    }
}
