package com.stayopscall.mobile.data.local

object CallLogOutboxStatus {
    const val Pending = "PENDING"
    const val Sending = "SENDING"
    const val Retryable = "RETRYABLE"
    const val Acked = "ACKED"
    const val AuthBlocked = "AUTH_BLOCKED"
    const val FailedPermanent = "FAILED_PERMANENT"

    /** Overlay alias — migrated to [Retryable] in MIGRATION_6_7. */
    const val FailedRetryable = Retryable

    val drainStatuses: List<String> = listOf(Pending, Retryable, AuthBlocked)
}
