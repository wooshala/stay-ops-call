package com.stayopscall.mobile.core.relay

sealed class CallTaskRelayResult {
    data class Acked(
        val skipped: Boolean,
        val reason: String?,
        val taskId: String?,
    ) : CallTaskRelayResult()

    data class Retryable(val error: String) : CallTaskRelayResult()

    data class AuthBlocked(val error: String) : CallTaskRelayResult()

    data class Permanent(val error: String) : CallTaskRelayResult()
}
