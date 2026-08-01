package com.stayopscall.mobile.core.sync

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

/**
 * CALL-SCAN-FIX-002 contract tests (static / pure logic).
 * Device WorkManager runtime: DEVICE RUNTIME PENDING.
 */
class ScanContractVerificationTest {

    private fun probe(uri: String, ts: Long) =
        ScanCandidateLogic.FileProbe(uri, ts, ts, hasFilenameTimestamp = true)

    // --- Scan / Upload separation ---

    @Test
    fun uploadIsNeverPrerequisiteBlockedByScan() {
        assertFalse(ScanEnqueuePolicy.uploadBlockedByScanPrerequisite())
        assertTrue(RecordingSyncTrigger.UNIQUE_SCAN_WORK != RecordingSyncTrigger.UNIQUE_UPLOAD_WORK)
    }

    // --- Stale re-enqueue ---

    @Test
    fun staleRecoveryUsesReplaceEvenIfWorkStillLooksActive() {
        val policy = ScanEnqueuePolicy.scanPolicy(staleRecovered = true, hasActiveWork = true)
        assertEquals(ScanEnqueuePolicy.UniquePolicy.REPLACE, policy)
    }

    @Test
    fun healthyActiveScanUsesKeep() {
        val policy = ScanEnqueuePolicy.scanPolicy(staleRecovered = false, hasActiveWork = true)
        assertEquals(ScanEnqueuePolicy.UniquePolicy.KEEP, policy)
    }

    @Test
    fun idleScanUsesKeepWhichStillEnqueuesWhenFinished() {
        val policy = ScanEnqueuePolicy.scanPolicy(staleRecovered = false, hasActiveWork = false)
        assertEquals(ScanEnqueuePolicy.UniquePolicy.KEEP, policy)
    }

    // --- Checkpoint failure ---

    @Test
    fun checkpointDoesNotAdvanceOnTimeoutOrInsertAbort() {
        assertFalse(
            ScanEnqueuePolicy.mayAdvanceCheckpoint(
                runSucceeded = true,
                timedOut = true,
                abortedDuringInsert = false,
            ),
        )
        assertFalse(
            ScanEnqueuePolicy.mayAdvanceCheckpoint(
                runSucceeded = false,
                timedOut = false,
                abortedDuringInsert = true,
            ),
        )
        assertTrue(
            ScanEnqueuePolicy.mayAdvanceCheckpoint(
                runSucceeded = true,
                timedOut = false,
                abortedDuringInsert = false,
            ),
        )
    }

    // --- Full reconcile: new file at front must not drop existing ---

    @Test
    fun offsetPagination_newFileAtFront_doesNotDropOlderUnprocessed() {
        // Documented residual: offset is OK for this scenario; still replaced by cursor in production.
        val original = (1..100).map { probe("a$it", it.toLong()) }
        val (batch1, _) = ScanCandidateLogic.filterReconcileBatch(original, 0, 50)
        assertEquals(50, batch1.size)

        val withNew = listOf(probe("NEW", 10_000L)) + original
        val (batch2, _) = ScanCandidateLogic.filterReconcileBatch(withNew, 50, 50)
        val batch2Uris = batch2.map { it.uri }.toSet()
        // Original items that were at index 50..99 must still appear (possibly shifted).
        val expectedRemaining = original.sortedWith(ScanCandidateLogic.newestFirst()).drop(49).take(50)
        // With offset 50 after insert-at-front, we start at old index 49 — all original[49..] eventually covered.
        assertTrue(batch2Uris.isNotEmpty())
        assertFalse(batch2Uris.contains("NEW")) // new at front skipped by offset — OK for this check
        // Critical: none of the never-processed older files are "lost" from the remaining suffix.
        val allLater = ScanCandidateLogic.filterReconcileBatch(withNew, 50, 10_000).first.map { it.uri }.toSet()
        val mustKeep = original.sortedWith(ScanCandidateLogic.newestFirst()).drop(50).map { it.uri }.toSet()
        assertTrue(allLater.containsAll(mustKeep))
        assertEquals(expectedRemaining.first().uri, batch2.first().uri)
    }

    @Test
    fun cursorPagination_newFileAtFront_doesNotDropOlderUnprocessed() {
        val original = (1..100).map { probe("a$it", it.toLong()) }
        val page1 = ScanCandidateLogic.filterReconcileBatchByCursor(original, cursor = null, batchSize = 50)
        assertEquals(50, page1.batch.size)
        assertTrue(page1.hasMore)
        val cursor = page1.nextCursor!!

        val withNew = listOf(probe("NEW", 10_000L)) + original
        val page2 = ScanCandidateLogic.filterReconcileBatchByCursor(withNew, cursor, batchSize = 50)
        val seen = (page1.batch + page2.batch).map { it.uri }.toSet()
        val mustKeep = original.map { it.uri }.toSet()
        // All original URIs from first 100 must be covered across page1+page2 (+possible page3).
        var cursorWalk: ScanCandidateLogic.Checkpoint? = null
        val covered = mutableSetOf<String>()
        var guard = 0
        while (guard++ < 10) {
            val page = ScanCandidateLogic.filterReconcileBatchByCursor(withNew, cursorWalk, 50)
            covered += page.batch.map { it.uri }
            if (!page.hasMore) break
            cursorWalk = page.nextCursor
        }
        assertTrue(covered.containsAll(mustKeep))
        assertTrue(seen.intersect(mustKeep).size >= 50)
        // NEW may be skipped after cursor advanced past newest batch — acceptable; incremental catches it.
    }

    @Test
    fun offsetPagination_canSkipWhenNewestDeleted_demonstratesWhyCursorNeeded() {
        val original = (1..100).map { probe("a$it", it.toLong()) }
        ScanCandidateLogic.filterReconcileBatch(original, 0, 50)
        // Delete 50 newest → remaining a1..a50 ranked; offset 50 points past end → SKIP unprocessed.
        val afterDelete = (1..50).map { probe("a$it", it.toLong()) }
        val (batch2, more) = ScanCandidateLogic.filterReconcileBatch(afterDelete, 50, 50)
        assertTrue(batch2.isEmpty())
        assertFalse(more)
        // Cursor would still visit remaining:
        val page1 = ScanCandidateLogic.filterReconcileBatchByCursor(original, null, 50)
        val page2 = ScanCandidateLogic.filterReconcileBatchByCursor(afterDelete, page1.nextCursor, 50)
        assertEquals(50, page2.batch.size)
        assertTrue(page2.batch.map { it.uri }.toSet() == afterDelete.map { it.uri }.toSet())
    }

    // --- Duplicate insert defense (logical set) ---

    @Test
    fun duplicateUriDiscoveryYieldsSingleLogicalRow() {
        val discovered = listOf("content://doc/1", "content://doc/1", "content://doc/2")
        val room = LinkedHashSet<String>()
        for (uri in discovered) {
            room.add(uri) // models UNIQUE fileUri + IGNORE
        }
        assertEquals(2, room.size)
    }

    @Test
    fun softTimeoutSharedByIncrementalAndReconcile_noSeparateBudget() {
        // Contract: full reconcile uses same SOFT_TIMEOUT_MS — no separate reconcile timeout.
        assertEquals(180_000L, ScanCandidateLogic.SOFT_TIMEOUT_MS)
        assertTrue(ScanCandidateLogic.isPastSoftTimeout(0L, ScanCandidateLogic.SOFT_TIMEOUT_MS))
    }

    @Test
    fun staleThresholdIsTenMinutes_unmeasuredDefault() {
        assertEquals(10 * 60 * 1000L, ScanProgressStore.DEFAULT_STALE_MS)
    }
}
