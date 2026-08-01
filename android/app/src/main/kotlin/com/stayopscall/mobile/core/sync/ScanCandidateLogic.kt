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

    /**
     * Keep probes newer than (checkpoint.ts - overlap), plus same-second tie-breakers
     * not yet past lastSeenUri when timestamps equal the checkpoint.
     */
    fun filterIncremental(
        probes: List<FileProbe>,
        checkpoint: Checkpoint?,
        overlapMs: Long = OVERLAP_MS,
        topN: Int = INCREMENTAL_TOP_N,
    ): List<FileProbe> {
        if (checkpoint == null) {
            return probes
                .sortedWith(newestFirst())
                .take(topN)
        }
        val cutoff = checkpoint.lastSeenTimestamp - overlapMs
        val filtered = probes.filter { probe ->
            when {
                probe.rankingTimestamp > checkpoint.lastSeenTimestamp -> true
                probe.rankingTimestamp < cutoff -> false
                probe.rankingTimestamp < checkpoint.lastSeenTimestamp -> true
                else -> {
                    // equal timestamp: include only uris after lastSeen (tie-break); re-include lastSeen via overlap path not needed
                    val lastUri = checkpoint.lastSeenUri
                    lastUri == null || probe.uri > lastUri
                }
            }
        }
        return filtered.sortedWith(newestFirst()).take(topN)
    }

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
     * Checkpoint cursor after a successful pass over [processed] probes (candidates compared,
     * whether or not newly inserted).
     */
    fun nextCheckpoint(processed: List<FileProbe>, previous: Checkpoint?): Checkpoint? {
        if (processed.isEmpty()) return previous
        val newest = processed.sortedWith(newestFirst()).firstOrNull() ?: return previous
        return Checkpoint(newest.rankingTimestamp, newest.uri)
    }

    fun newestFirst(): Comparator<FileProbe> =
        compareByDescending<FileProbe> { it.rankingTimestamp }
            .thenByDescending { it.uri }

    fun isPastSoftTimeout(startedAtMs: Long, nowMs: Long, budgetMs: Long = SOFT_TIMEOUT_MS): Boolean =
        nowMs - startedAtMs >= budgetMs
}
