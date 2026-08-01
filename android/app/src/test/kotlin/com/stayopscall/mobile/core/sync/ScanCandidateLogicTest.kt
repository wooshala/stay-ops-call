package com.stayopscall.mobile.core.sync

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class ScanCandidateLogicTest {

    private fun probe(uri: String, ts: Long) =
        ScanCandidateLogic.FileProbe(uri, ts, ts, hasFilenameTimestamp = true)

    @Test
    fun bootstrapWithoutCheckpointTakesTopNNewest() {
        val probes = (1..100).map { probe("u$it", it * 1_000L) }
        val selected = ScanCandidateLogic.filterIncremental(probes, checkpoint = null, topN = 50)
        assertEquals(50, selected.size)
        assertEquals(100_000L, selected.first().rankingTimestamp)
        assertEquals(51_000L, selected.last().rankingTimestamp)
    }

    @Test
    fun incrementalSkipsBelowOverlapWindow() {
        val cp = ScanCandidateLogic.Checkpoint(lastSeenTimestamp = 10_000L, lastSeenUri = "u-mid")
        val overlap = 1_000L
        val probes = listOf(
            probe("old", 8_000L), // below cutoff 9000
            probe("edge", 9_500L), // in overlap
            probe("new", 11_000L),
            probe("u-mid", 10_000L), // equal ts, same uri -> excluded
            probe("u-zzz", 10_000L), // equal ts, uri > lastSeen -> included
        )
        val selected = ScanCandidateLogic.filterIncremental(probes, cp, overlapMs = overlap, topN = 50)
        val uris = selected.map { it.uri }.toSet()
        assertFalse(uris.contains("old"))
        assertTrue(uris.contains("edge"))
        assertTrue(uris.contains("new"))
        assertFalse(uris.contains("u-mid"))
        assertTrue(uris.contains("u-zzz"))
    }

    @Test
    fun midnightBoundaryTimestampsBothEligible() {
        // 23:59 and 00:01 next day — both newer than checkpoint earlier that evening
        val day = 1_700_000_000_000L
        val evening = day
        val late = day + 3_600_000L // +1h
        val nextMinute = late + 120_000L
        val cp = ScanCandidateLogic.Checkpoint(evening, "a")
        val probes = listOf(
            probe("eve", evening),
            probe("late", late),
            probe("next", nextMinute),
        )
        val selected = ScanCandidateLogic.filterIncremental(probes, cp, overlapMs = 15 * 60_000L, topN = 50)
        assertTrue(selected.any { it.uri == "late" })
        assertTrue(selected.any { it.uri == "next" })
    }

    @Test
    fun reconcileBatchPagesAndReportsHasMore() {
        val probes = (1..120).map { probe("u$it", it.toLong()) }
        val (page0, more0) = ScanCandidateLogic.filterReconcileBatch(probes, 0, batchSize = 50)
        assertEquals(50, page0.size)
        assertTrue(more0)
        val (page1, more1) = ScanCandidateLogic.filterReconcileBatch(probes, 50, batchSize = 50)
        assertEquals(50, page1.size)
        assertTrue(more1)
        val (page2, more2) = ScanCandidateLogic.filterReconcileBatch(probes, 100, batchSize = 50)
        assertEquals(20, page2.size)
        assertFalse(more2)
    }

    @Test
    fun nextCheckpointUsesNewestProcessed() {
        val processed = listOf(probe("a", 1), probe("b", 5), probe("c", 3))
        val next = ScanCandidateLogic.nextCheckpoint(processed, null)!!
        assertEquals(5, next.lastSeenTimestamp)
        assertEquals("b", next.lastSeenUri)
    }

    @Test
    fun softTimeoutDetection() {
        assertFalse(ScanCandidateLogic.isPastSoftTimeout(1_000L, 1_000L + 179_000L, 180_000L))
        assertTrue(ScanCandidateLogic.isPastSoftTimeout(1_000L, 1_000L + 180_000L, 180_000L))
    }

    @Test
    fun largeProbeSetIncrementalOnlyReturnsTopN() {
        val probes = (1..3_000).map { probe("uri-$it", it.toLong()) }
        val cp = ScanCandidateLogic.Checkpoint(2_900L, "uri-2900")
        val selected = ScanCandidateLogic.filterIncremental(probes, cp, overlapMs = 50, topN = 50)
        assertTrue(selected.size <= 50)
        assertTrue(selected.all { it.rankingTimestamp >= 2_900L - 50 })
    }
}

