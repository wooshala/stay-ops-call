package com.stayopscall.mobile.core.relay

import android.util.Log
import com.stayopscall.mobile.BuildConfig
import com.stayopscall.mobile.core.calllog.EndedCallEvent
import com.stayopscall.mobile.core.calllog.IncomingCallState
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody
import org.json.JSONObject
import java.time.Instant
import java.util.concurrent.TimeUnit

object CallTaskRelayClient {
    private const val TAG = "StayOpsCallRelay"
    private const val MAX_BODY_LOG = 500
    private val jsonMediaType = "application/json; charset=utf-8".toMediaType()

    private val httpClient = OkHttpClient.Builder()
        .connectTimeout(10, TimeUnit.SECONDS)
        .readTimeout(10, TimeUnit.SECONDS)
        .writeTimeout(10, TimeUnit.SECONDS)
        .build()

    private fun isConfigured(): Boolean {
        val base = BuildConfig.UNIVER_OPS_URL.trim()
        val secret = BuildConfig.INTERNAL_EVENTS_SECRET.trim()
        return base.isNotEmpty() && secret.isNotEmpty()
    }

    private fun maskPhone(phone: String): String {
        val digits = phone.filter { it.isDigit() }
        return if (digits.length >= 4) "***${digits.takeLast(4)}" else "***"
    }

    private fun truncateBody(body: String): String {
        val trimmed = body.trim()
        if (trimmed.isEmpty()) return "(empty)"
        return if (trimmed.length <= MAX_BODY_LOG) trimmed else trimmed.take(MAX_BODY_LOG) + "…"
    }

    private fun exceptionDetail(e: Throwable): String {
        val message = e.message?.trim()?.takeIf { it.isNotEmpty() } ?: "(no message)"
        val stack = Log.getStackTraceString(e)
            .lineSequence()
            .filter { it.isNotBlank() }
            .take(4)
            .joinToString(" | ")
        return "type=${e.javaClass.simpleName} message=$message stack=$stack"
    }

    private fun relayUrl(): String {
        val base = BuildConfig.UNIVER_OPS_URL.trim().trimEnd('/')
        return "$base/api/call-tasks/relay"
    }

    private fun authHeader() = "Bearer ${BuildConfig.INTERNAL_EVENTS_SECRET.trim()}"

    // ── incoming relay ─────────────────────────────────────────────────────────

    fun relayIncomingCall(
        context: android.content.Context,
        phone: String?,
        sourceEventId: String,
        startedAtMs: Long,
    ) {
        if (!isConfigured()) {
            Log.w(TAG, "[CALL_INCOMING_RELAY_FAIL] sourceEventId=$sourceEventId type=Config message=not configured")
            return
        }

        val phoneMasked = phone?.let { maskPhone(it) } ?: "null"
        val startedAt = Instant.ofEpochMilli(startedAtMs).toString()

        val payload = JSONObject().apply {
            put("event_type", "incoming")
            put("source_event_id", sourceEventId)
            if (phone.isNullOrEmpty()) put("phone", JSONObject.NULL) else put("phone", phone)
            put("started_at", startedAt)
        }

        val url = relayUrl()
        val sendMs = System.currentTimeMillis()
        Log.i(TAG, "[CALL_INCOMING_RELAY_SEND] sourceEventId=$sourceEventId phone=$phoneMasked url=$url")

        try {
            val request = Request.Builder()
                .url(url)
                .header("Authorization", authHeader())
                .header("Content-Type", "application/json; charset=utf-8")
                .post(payload.toString().toRequestBody(jsonMediaType))
                .build()

            httpClient.newCall(request).execute().use { response ->
                val elapsedMs = System.currentTimeMillis() - sendMs
                val bodyText = response.body?.string().orEmpty()

                if (!response.isSuccessful) {
                    Log.w(TAG, "[CALL_INCOMING_RELAY_FAIL] sourceEventId=$sourceEventId code=${response.code} elapsedMs=${elapsedMs}ms")
                    return
                }

                val json = runCatching { JSONObject(bodyText) }.getOrNull()
                val ok = json?.optBoolean("ok", false) ?: false
                if (ok) {
                    val skipped = json?.optBoolean("skipped", false) ?: false
                    val reason = json?.optString("reason", "")?.ifEmpty { "(none)" } ?: "(none)"
                    Log.i(TAG, "[CALL_INCOMING_RELAY_OK] sourceEventId=$sourceEventId skipped=$skipped reason=$reason elapsedMs=${elapsedMs}ms")
                } else {
                    val error = json?.optString("error", "")?.ifEmpty { "(unknown)" } ?: "(unknown)"
                    Log.w(TAG, "[CALL_INCOMING_RELAY_FAIL] sourceEventId=$sourceEventId error=$error elapsedMs=${elapsedMs}ms")
                }
            }
        } catch (e: Exception) {
            val elapsedMs = System.currentTimeMillis() - sendMs
            Log.w(TAG, "[CALL_INCOMING_RELAY_FAIL] sourceEventId=$sourceEventId ${exceptionDetail(e)} elapsedMs=${elapsedMs}ms")
        }
    }

    // ── ended relay ────────────────────────────────────────────────────────────

    fun relayEndedCall(context: android.content.Context, event: EndedCallEvent) {
        val store = CallTaskRelayStore(context)
        if (store.wasRelayed(event.callLogId)) return

        if (!isConfigured()) {
            Log.w(TAG, "[CALL_TASK_RELAY_FAIL] callLogId=${event.callLogId} type=Config message=not configured")
            return
        }

        // incoming sourceEventId 연결 — phone 기반 먼저, 없으면 UNKNOWN(phone=null) 시간 기반 fallback
        val linkedId = IncomingCallState.consumeForPhone(event.normalizedPhone)
            ?: IncomingCallState.consumeUnknownIfRecent(event.startedAtMs)
        val sourceEventId = linkedId ?: "call-log:${event.callLogId}"

        val payload = JSONObject().apply {
            put("event_type", "ended")
            put("phone", event.normalizedPhone)
            if (event.contactName.isNullOrBlank()) {
                put("contact_name", JSONObject.NULL)
            } else {
                put("contact_name", event.contactName)
            }
            put("started_at", Instant.ofEpochMilli(event.startedAtMs).toString())
            put("ended_at", Instant.ofEpochMilli(event.endedAtMs).toString())
            put("duration_seconds", event.durationSeconds)
            put("direction", event.direction)
            put("source_event_id", sourceEventId)
        }

        val url = relayUrl()
        val phoneMasked = maskPhone(event.normalizedPhone)
        Log.i(TAG, "[CALL_ENDED_RELAY_SEND] callLogId=${event.callLogId} sourceEventId=$sourceEventId phone=$phoneMasked linked=${linkedId != null}")

        try {
            val request = Request.Builder()
                .url(url)
                .header("Authorization", authHeader())
                .header("Content-Type", "application/json; charset=utf-8")
                .post(payload.toString().toRequestBody(jsonMediaType))
                .build()

            httpClient.newCall(request).execute().use { response ->
                val bodyText = response.body?.string().orEmpty()
                Log.w(TAG, "[CALL_TASK_RELAY_HTTP] callLogId=${event.callLogId} code=${response.code} body=${truncateBody(bodyText)}")

                if (!response.isSuccessful) {
                    Log.w(TAG, "[CALL_TASK_RELAY_FAIL] callLogId=${event.callLogId} type=HttpFailure message=HTTP ${response.code}")
                    return
                }

                val json = runCatching { JSONObject(bodyText) }.getOrNull()
                if (json == null) {
                    Log.w(TAG, "[CALL_TASK_RELAY_FAIL] callLogId=${event.callLogId} type=InvalidJson message=not valid JSON")
                    return
                }

                val ok = json.optBoolean("ok", false)
                if (!ok) {
                    val apiError = json.optString("error", "").trim()
                        .ifEmpty { json.optString("message", "").trim() }
                        .ifEmpty { "(missing error field)" }
                    Log.w(TAG, "[CALL_TASK_RELAY_FAIL] callLogId=${event.callLogId} type=ApiResponse message=$apiError")
                    return
                }

                store.markRelayed(event.callLogId)
                val skipped = json.optBoolean("skipped", false)
                val reason = json.optString("reason", "").ifEmpty { "(none)" }
                Log.i(TAG, "[CALL_ENDED_RELAY_OK] callLogId=${event.callLogId} sourceEventId=$sourceEventId skipped=$skipped reason=$reason linked=${linkedId != null}")
            }
        } catch (e: Exception) {
            Log.w(TAG, "[CALL_TASK_RELAY_FAIL] callLogId=${event.callLogId} ${exceptionDetail(e)}")
        }
    }
}
