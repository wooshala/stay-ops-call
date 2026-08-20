package com.stayopscall.mobile.core.sync

object CallLogCursorLogic {
    data class Cursor(val startedAtMs: Long, val callLogId: Long)

    const val OVERLAP_MS = 15L * 60L * 1000L

    fun isAfterCursor(dateMs: Long, callLogId: Long, cursor: Cursor): Boolean {
        return dateMs > cursor.startedAtMs ||
            (dateMs == cursor.startedAtMs && callLogId > cursor.callLogId)
    }

    fun overlapLookbackFrom(cursor: Cursor): Long =
        (cursor.startedAtMs - OVERLAP_MS).coerceAtLeast(0L)

    fun missedByWallClockLookback(
        eventStartedAtMs: Long,
        nowMs: Long,
        lookbackMs: Long = OVERLAP_MS,
    ): Boolean = eventStartedAtMs < nowMs - lookbackMs
}

object CallLogOutboxStateMachine {
    enum class Status {
        PENDING,
        SENDING,
        RETRYABLE,
        ACKED,
        AUTH_BLOCKED,
        FAILED_PERMANENT,
    }

    fun onProcessRestart(
        status: Status,
        lastAttemptAgeMs: Long,
        staleAfterMs: Long,
    ): Status {
        if (status == Status.SENDING && lastAttemptAgeMs >= staleAfterMs) {
            return Status.PENDING
        }
        return status
    }

    fun shouldAck(
        httpOk: Boolean,
        bodyOk: Boolean,
        skippedDuplicate: Boolean = false,
    ): Boolean = CollectorRetryPolicy.serverAcked(httpOk, bodyOk, skippedDuplicate)

    fun afterFailure(outcome: CollectorRetryPolicy.Outcome): Status = when (outcome) {
        CollectorRetryPolicy.Outcome.ACK -> Status.ACKED
        CollectorRetryPolicy.Outcome.RETRYABLE -> Status.RETRYABLE
        CollectorRetryPolicy.Outcome.AUTH_BLOCKED -> Status.AUTH_BLOCKED
        CollectorRetryPolicy.Outcome.PERMANENT -> Status.FAILED_PERMANENT
    }
}

object RecordingUploadStateMachine {
    enum class Status {
        PENDING,
        UPLOADING,
        ACKED,
        RETRYABLE,
        AUTH_BLOCKED,
        FAILED_PERMANENT,
        LEGACY_FAILED_UPLOAD,
    }

    fun onProcessRestart(status: Status): Status {
        return if (status == Status.UPLOADING) Status.RETRYABLE else status
    }

    fun afterFailure(outcome: CollectorRetryPolicy.Outcome): Status = when (outcome) {
        CollectorRetryPolicy.Outcome.ACK -> Status.ACKED
        CollectorRetryPolicy.Outcome.RETRYABLE -> Status.RETRYABLE
        CollectorRetryPolicy.Outcome.AUTH_BLOCKED -> Status.AUTH_BLOCKED
        CollectorRetryPolicy.Outcome.PERMANENT -> Status.FAILED_PERMANENT
    }

    fun isAutoDrained(status: Status): Boolean = when (status) {
        Status.PENDING, Status.RETRYABLE, Status.AUTH_BLOCKED, Status.UPLOADING -> true
        Status.ACKED, Status.FAILED_PERMANENT, Status.LEGACY_FAILED_UPLOAD -> false
    }
}
