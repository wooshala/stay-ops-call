package com.stayopscall.mobile.data.local

object RecordingStatus {
    const val Pending = "pending"
    const val Uploading = "uploading"
    const val Uploaded = "uploaded"
    const val Synced = "synced"
    const val Duplicate = "duplicate"
    const val Retryable = "retryable"
    const val RetryPending = "retry_pending"
    const val AuthBlocked = "auth_blocked"
    const val FailedPermanent = "failed_permanent"
    /**
     * Legacy 3-strike tombstone. Frozen on purpose — CALL-RELIABILITY-03 must not
     * auto-requeue historical failed_upload rows until adb errorMessage review.
     */
    const val FailedUpload = "failed_upload"

    fun isAcked(status: String): Boolean =
        status == Synced || status == Duplicate || status == Uploaded

    fun isDrainable(status: String): Boolean =
        status == Pending || status == Retryable || status == RetryPending || status == AuthBlocked

    val drainStatuses: List<String> = listOf(Pending, Retryable, RetryPending, AuthBlocked)
}
