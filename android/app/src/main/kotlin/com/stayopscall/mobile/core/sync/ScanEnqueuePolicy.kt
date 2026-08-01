package com.stayopscall.mobile.core.sync

/**
 * Pure enqueue policy helpers for Scan unique work (no WorkManager dependency).
 */
object ScanEnqueuePolicy {
    enum class UniquePolicy {
        KEEP,
        REPLACE,
    }

    /**
     * After [recoverStaleScanIfNeeded] cancels unique scan work, cancel is asynchronous.
     * [hasActiveWork] may still be true; KEEP would no-op and leave the system without a new scan.
     * Therefore stale recovery MUST use REPLACE for the subsequent enqueue.
     */
    fun scanPolicy(staleRecovered: Boolean, hasActiveWork: Boolean): UniquePolicy {
        if (staleRecovered) return UniquePolicy.REPLACE
        if (hasActiveWork) return UniquePolicy.KEEP
        return UniquePolicy.KEEP
    }

    /** Upload is always a separate unique name — never chained after Scan. */
    fun uploadBlockedByScanPrerequisite(): Boolean = false

    /**
     * Checkpoint may move only when the scan run fully succeeds (including insert loop).
     * Timeout / failure / mid-insert abort must not advance.
     */
    fun mayAdvanceCheckpoint(
        runSucceeded: Boolean,
        timedOut: Boolean,
        abortedDuringInsert: Boolean,
    ): Boolean = runSucceeded && !timedOut && !abortedDuringInsert
}
