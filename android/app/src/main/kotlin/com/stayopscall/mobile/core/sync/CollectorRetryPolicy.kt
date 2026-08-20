package com.stayopscall.mobile.core.sync

/**
 * Shared retry / ACK classification for CallLog outbox and recording uploads.
 *
 * Temporary infrastructure failures stay retryable forever (with backoff).
 * Permanent is reserved for local unrecoverable conditions (missing file, corrupt payload).
 * 401/403 preserve the row as AUTH_BLOCKED so ops can resume after config fix.
 */
object CollectorRetryPolicy {
    val BACKOFF_MS: LongArray = longArrayOf(
        1L * 60_000L,
        5L * 60_000L,
        15L * 60_000L,
        60L * 60_000L,
        3L * 60L * 60_000L,
        6L * 60L * 60_000L,
    )
    const val MAX_BACKOFF_MS: Long = 6L * 60L * 60_000L
    const val AUTH_BACKOFF_MS: Long = 60L * 60_000L

    enum class Outcome {
        ACK,
        RETRYABLE,
        AUTH_BLOCKED,
        PERMANENT,
    }

    fun nextAttemptAt(attemptCount: Int, nowMs: Long): Long {
        val idx = (attemptCount - 1).coerceAtLeast(0)
        val delay = if (idx < BACKOFF_MS.size) BACKOFF_MS[idx] else MAX_BACKOFF_MS
        return nowMs + delay
    }

    fun authNextAttemptAt(nowMs: Long): Long = nowMs + AUTH_BACKOFF_MS

    fun isDue(nextAttemptAtMs: Long, nowMs: Long): Boolean = nextAttemptAtMs <= nowMs

    fun classifyHttp(code: Int): Outcome = when (code) {
        401, 403 -> Outcome.AUTH_BLOCKED
        408, 429 -> Outcome.RETRYABLE
        in 500..599 -> Outcome.RETRYABLE
        400, 422 -> Outcome.PERMANENT
        in 400..499 -> Outcome.RETRYABLE
        else -> Outcome.RETRYABLE
    }

    fun classifyThrowable(error: Throwable): Outcome {
        val name = error.javaClass.name
        val message = error.message.orEmpty()
        return classifyErrorText("$name $message")
    }

    fun classifyErrorText(raw: String?): Outcome {
        val text = raw.orEmpty()
        val lower = text.lowercase()
        if (
            lower.contains("file not found") ||
            lower.contains("filenotfound") ||
            lower.contains("cannot open file") ||
            lower.contains("no such file") ||
            lower.contains("enoent")
        ) {
            return Outcome.PERMANENT
        }
        if (lower.contains("http 401") || lower.contains("http 403") || lower.contains("unauthorized") ||
            lower.contains("upload_agent_token")
        ) {
            return Outcome.AUTH_BLOCKED
        }
        if (
            lower.contains("unknownhost") ||
            lower.contains("dns") ||
            lower.contains("connect") ||
            lower.contains("sockettimeout") ||
            lower.contains("timeout") ||
            lower.contains("interruptedio") ||
            lower.contains("retryable") ||
            lower.contains("sslhandshake") ||
            lower.contains("network")
        ) {
            return Outcome.RETRYABLE
        }
        val http = Regex("HTTP[_ ](\\d{3})", RegexOption.IGNORE_CASE).find(text)
        if (http != null) {
            return classifyHttp(http.groupValues[1].toInt())
        }
        return Outcome.RETRYABLE
    }

    fun serverAcked(httpOk: Boolean, bodyOk: Boolean, duplicateStored: Boolean = false): Boolean {
        return (httpOk && bodyOk) || duplicateStored
    }
}
