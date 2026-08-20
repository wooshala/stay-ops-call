package com.stayopscall.mobile.core.sync

/**
 * Pure candidate selection for incremental / reconcile scans.
 * File name / mtime are used only to shrink the candidate set;
 * URI (or other stable key) remains the source of truth for dedupe.
 */
object ScanCandidateLogic {
    const val OVERLAP_MS = 15 * 60 * 1000L
    const val INCREMENTAL_TOP_N = 50
    const val RECONCILE_BATCH = 50

    /** Soft wall-clock budget; tune after device instrumentation (Phase 3). */
    const val SOFT_TIMEOUT_MS = 180_000L

    data class FileProbe(
        val uri: String,
        /** Best-effort recording time: filename timestamp if present, else mtime. */
        val rankingTimestamp: Long,
        val mtime: Long,
        val hasFilenameTimestamp: Boolean,
    )

    data class Checkpoint(
        val lastSeenTimestamp: Long,
        val lastSeenUri: String?,
    )

    data class IncrementalPage(
        val batch: List<FileProbe>,
        val hasMore: Boolean,
    )

    /**
     * Eligible probes for incremental sync (checkpoint + overlap), unordered filter only.
     */
    fun filterEligibleIncremental(
        probes: List<FileProbe>,
        checkpoint: Checkpoint?,
        overlapMs: Long = OVERLAP_MS,
    ): List<FileProbe> {
        if (checkpoint == null) {
            return probes
        }
        val cutoff = checkpoint.lastSeenTimestamp - overlapMs
        return probes.filter { probe ->
            when {
                probe.rankingTimestamp > checkpoint.lastSeenTimestamp -> true
                probe.rankingTimestamp < cutoff -> false
                probe.rankingTimestamp < checkpoint.lastSeenTimestamp -> true
                else -> {
                    val lastUri = checkpoint.lastSeenUri
                    lastUri == null || probe.uri > lastUri
                }
            }
        }
    }

    /**
     * P0 durable drain: oldest-first among eligible, then batch.
     * Checkpoint should advance to the newest item in [IncrementalPage.batch] so the
     * drained prefix is never skipped and remaining older backlog stays eligible next run.
     */
    fun filterIncrementalDrain(
        probes: List<FileProbe>,
        checkpoint: Checkpoint?,
        overlapMs: Long = OVERLAP_MS,
        batchSize: Int = INCREMENTAL_TOP_N,
    ): IncrementalPage {
        val eligible = filterEligibleIncremental(probes, checkpoint, overlapMs)
        val sorted = if (checkpoint == null) {
            // Bootstrap: still prefer newest live window first, but page until exhausted via hasMore.
            eligible.sortedWith(newestFirst())
        } else {
            eligible.sortedWith(oldestFirst())
        }
        val batch = sorted.take(batchSize)
        return IncrementalPage(batch = batch, hasMore = eligible.size > batch.size)
    }

    /**
     * Keep probes newer than (checkpoint.ts - overlap), plus same-second tie-breakers.
     * Uses oldest-first drain when a checkpoint exists (P0 backlog contract).
     */
    fun filterIncremental(
        probes: List<FileProbe>,
        checkpoint: Checkpoint?,
        overlapMs: Long = OVERLAP_MS,
        topN: Int = INCREMENTAL_TOP_N,
    ): List<FileProbe> = filterIncrementalDrain(probes, checkpoint, overlapMs, topN).batch

    /**
     * @deprecated Prefer [filterReconcileBatchByCursor]. Offset pagination drifts when the
     * newest-first list shrinks (deletes) and can skip unprocessed rows.
     */
    fun filterReconcileBatch(
        probes: List<FileProbe>,
        offset: Int,
        batchSize: Int = RECONCILE_BATCH,
    ): Pair<List<FileProbe>, Boolean> {
        val sorted = probes.sortedWith(newestFirst())
        val slice = sorted.drop(offset.coerceAtLeast(0)).take(batchSize)
        val hasMore = offset.coerceAtLeast(0) + slice.size < sorted.size
        return slice to hasMore
    }

    /**
     * Full reconcile pagination by cursor (newest → older).
     * [cursor] is the oldest item of the previous batch (exclusive resume point).
     * New files inserted at the newest end are skipped for this reconcile pass (caught by
     * incremental later) but never push unprocessed older files out of the remaining window.
     */
    data class ReconcilePage(
        val batch: List<FileProbe>,
        val hasMore: Boolean,
        /** Oldest of [batch]; store as next cursor when [hasMore]. Null when done. */
        val nextCursor: Checkpoint?,
    )

    fun filterReconcileBatchByCursor(
        probes: List<FileProbe>,
        cursor: Checkpoint?,
        batchSize: Int = RECONCILE_BATCH,
    ): ReconcilePage {
        val sorted = probes.sortedWith(newestFirst())
        val remaining = if (cursor == null) {
            sorted
        } else {
            sorted.filter { isStrictlyOlderThan(it, cursor) }
        }
        val batch = remaining.take(batchSize)
        val hasMore = remaining.size > batch.size
        val nextCursor = if (batch.isEmpty()) {
            null
        } else if (hasMore) {
            val edge = batch.last()
            Checkpoint(edge.rankingTimestamp, edge.uri)
        } else {
            null
        }
        return ReconcilePage(batch, hasMore, nextCursor)
    }

    /** True if [probe] should still be visited after processing up through [cursor] (newest-first). */
    fun isStrictlyOlderThan(probe: FileProbe, cursor: Checkpoint): Boolean {
        return when {
            probe.rankingTimestamp < cursor.lastSeenTimestamp -> true
            probe.rankingTimestamp > cursor.lastSeenTimestamp -> false
            else -> {
                val cursorUri = cursor.lastSeenUri.orEmpty()
                probe.uri < cursorUri
            }
        }
    }

    /**
     * Checkpoint cursor after a successful pass over [processed] probes (candidates compared,
     * whether or not newly inserted).
     *
     * For oldest-first drain: advances to the newest in the batch (high-water of drained prefix).
     */
    fun nextCheckpoint(processed: List<FileProbe>, previous: Checkpoint?): Checkpoint? {
        if (processed.isEmpty()) return previous
        val newest = processed.sortedWith(newestFirst()).firstOrNull() ?: return previous
        return Checkpoint(newest.rankingTimestamp, newest.uri)
    }

    fun newestFirst(): Comparator<FileProbe> =
        compareByDescending<FileProbe> { it.rankingTimestamp }
            .thenByDescending { it.uri }

    fun oldestFirst(): Comparator<FileProbe> =
        compareBy<FileProbe> { it.rankingTimestamp }
            .thenBy { it.uri }

    fun isPastSoftTimeout(startedAtMs: Long, nowMs: Long, budgetMs: Long = SOFT_TIMEOUT_MS): Boolean =
        nowMs - startedAtMs >= budgetMs
}
