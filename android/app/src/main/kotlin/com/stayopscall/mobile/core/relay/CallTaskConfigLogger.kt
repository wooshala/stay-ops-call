package com.stayopscall.mobile.core.relay

import android.util.Log
import com.stayopscall.mobile.BuildConfig
import java.net.URI

object CallTaskConfigLogger {
    private const val TAG = "StayOpsCallRelay"

    @Volatile
    private var logged = false

    fun logOnceAtStartup() {
        if (logged) return
        logged = true

        val urlRaw = BuildConfig.UNIVER_OPS_URL.trim()
        val secretRaw = BuildConfig.INTERNAL_EVENTS_SECRET.trim()
        val secretConfigured = secretRaw.isNotEmpty()
        Log.d(
            TAG,
            "[CALL_TASK_CONFIG] url=${maskUrl(urlRaw)} secretConfigured=$secretConfigured ${secretFingerprint(secretRaw)}",
        )
    }

    /** Never log the full secret — length + first/last 4 chars only. */
    private fun secretFingerprint(raw: String): String {
        val s = raw.trim()
        if (s.isEmpty()) {
            return "secretLen=0 secretHead=(empty) secretTail=(empty)"
        }
        val head = if (s.length <= 4) s else s.take(4)
        val tail = if (s.length <= 4) s else s.takeLast(4)
        return "secretLen=${s.length} secretHead=$head secretTail=$tail"
    }

    private fun maskUrl(raw: String): String {
        if (raw.isEmpty()) return "(empty)"
        return runCatching {
            val uri = URI(raw)
            val host = uri.host ?: return "(invalid)"
            val scheme = uri.scheme ?: "https"
            val portSuffix = when (uri.port) {
                -1, 80, 443 -> ""
                else -> ":${uri.port}"
            }
            "$scheme://${maskHost(host)}$portSuffix"
        }.getOrElse { "(invalid)" }
    }

    private fun maskHost(host: String): String {
        val parts = host.split('.')
        if (parts.size < 2) return "***"
        val first = parts.first()
        val maskedFirst = if (first.length <= 4) "$first***" else "${first.take(4)}***"
        return (listOf(maskedFirst) + parts.drop(1)).joinToString(".")
    }
}
