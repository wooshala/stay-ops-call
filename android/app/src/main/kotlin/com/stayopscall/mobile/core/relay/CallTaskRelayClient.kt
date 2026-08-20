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

    // ── phone patch relay ──────────────────────────────────────────────────────

    /** callback(phone=null) 이후 legacy에서 번호가 도착했을 때 기존 task에 번호 보강 요청 */
    fun relayIncomingPhonePatch(
        context: android.content.Context,
        phone: String,
        sourceEventId: String,
    ) {
        if (!isConfigured()) {
            Log.w(TAG, "[CALL_INCOMING_PHONE_PATCH_OK] sourceEventId=$sourceEventId type=Config message=not configured")
            return
        }

        val phoneMasked = maskPhone(phone)
        val payload = JSONObject().apply {
            put("event_type", "incoming")
            put("source_event_id", sourceEventId)
            put("phone", phone)
        }

        val url = relayUrl()
        val sendMs = System.currentTimeMillis()
        Log.i(TAG, "[CALL_INCOMING_PHONE_PATCH_SEND] sourceEventId=$sourceEventId phone=$phoneMasked url=$url")

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
                    Log.w(TAG, "[CALL_INCOMING_PHONE_PATCH_OK] sourceEventId=$sourceEventId FAIL code=${response.code} elapsedMs=${elapsedMs}ms")
                    return
                }

                val json = runCatching { JSONObject(bodyText) }.getOrNull()
                val ok = json?.optBoolean("ok", false) ?: false
                Log.i(TAG, "[CALL_INCOMING_PHONE_PATCH_OK] sourceEventId=$sourceEventId ok=$ok elapsedMs=${elapsedMs}ms body=${truncateBody(bodyText)}")
            }
        } catch (e: Exception) {
            val elapsedMs = System.currentTimeMillis() - sendMs
            Log.w(TAG, "[CALL_INCOMING_PHONE_PATCH_OK] sourceEventId=$sourceEventId FAIL ${exceptionDetail(e)} elapsedMs=${elapsedMs}ms")
        }
    }

    // ── ended relay ────────────────────────────────────────────────────────────

    /**
     * Resolve sticky source_event_id for a newly discovered CallLog row.
     * Prefers in-memory incoming link; otherwise durable call-log:{id}.
     */
    fun resolveSourceEventId(event: EndedCallEvent): String {
        val linkedId = IncomingCallState.consumeForPhone(event.normalizedPhone)
            ?: IncomingCallState.consumeUnknownIfRecent(event.startedAtMs)
        return linkedId ?: "call-log:${event.callLogId}"
    }

    /**
     * Durable outbox send. ACK only on HTTP 2xx + ok:true (including skipped duplicate).
     */
    fun relayEndedOutbox(
        sourceEventId: String,
        phone: String,
        contactName: String?,
        startedAtMs: Long,
        endedAtMs: Long,
        durationSeconds: Int,
        direction: String,
        callLogId: Long,
    ): CallTaskRelayResult {
        if (!isConfigured()) {
            Log.w(TAG, "[CALL_TASK_RELAY_FAIL] callLogId=$callLogId type=Config message=not configured")
            return CallTaskRelayResult.Retryable("not_configured")
        }

        val payload = JSONObject().apply {
            put("event_type", "ended")
            put("phone", phone)
            if (contactName.isNullOrBlank()) {
                put("contact_name", JSONObject.NULL)
            } else {
                put("contact_name", contactName)
            }
            put("started_at", Instant.ofEpochMilli(startedAtMs).toString())
            put("ended_at", Instant.ofEpochMilli(endedAtMs).toString())
            put("duration_seconds", durationSeconds)
            put("direction", direction)
            put("source_event_id", sourceEventId)
        }

        val url = relayUrl()
        val phoneMasked = maskPhone(phone)
        Log.i(TAG, "[CALL_ENDED_RELAY_SEND] callLogId=$callLogId sourceEventId=$sourceEventId phone=$phoneMasked")

        return try {
            val request = Request.Builder()
                .url(url)
                .header("Authorization", authHeader())
                .header("Content-Type", "application/json; charset=utf-8")
                .post(payload.toString().toRequestBody(jsonMediaType))
                .build()

            httpClient.newCall(request).execute().use { response ->
                val bodyText = response.body?.string().orEmpty()
                Log.w(TAG, "[CALL_TASK_RELAY_HTTP] callLogId=$callLogId code=${response.code} body=${truncateBody(bodyText)}")

                when (response.code) {
                    in 500..599, 429, 408 -> {
                        return CallTaskRelayResult.Retryable("HTTP ${response.code}")
                    }
                    401, 403 -> {
                        return CallTaskRelayResult.AuthBlocked("HTTP ${response.code}")
                    }
                    in 400..499 -> {
                        if (!response.isSuccessful) {
                            return CallTaskRelayResult.Retryable("HTTP ${response.code}")
                        }
                    }
                }

                if (!response.isSuccessful) {
                    return CallTaskRelayResult.Retryable("HTTP ${response.code}")
                }

                val json = runCatching { JSONObject(bodyText) }.getOrNull()
                if (json == null) {
                    Log.w(TAG, "[CALL_TASK_RELAY_FAIL] callLogId=$callLogId type=InvalidJson")
                    return CallTaskRelayResult.Retryable("invalid_json")
                }

                val ok = json.optBoolean("ok", false)
                if (!ok) {
                    val apiError = json.optString("error", "").trim()
                        .ifEmpty { json.optString("message", "").trim() }
                        .ifEmpty { "(missing error field)" }
                    Log.w(TAG, "[CALL_TASK_RELAY_FAIL] callLogId=$callLogId type=ApiResponse message=$apiError")
                    return CallTaskRelayResult.Retryable("api:$apiError")
                }

                val skipped = json.optBoolean("skipped", false)
                val reason = json.optString("reason", "").ifEmpty { null }
                val taskId = json.optString("taskId", "").ifEmpty {
                    json.optString("task_id", "").ifEmpty { null }
                }
                // ok:true including skipped/duplicate/short_duration → ACK (server accepted or deduped)
                Log.i(
                    TAG,
                    "[CALL_ENDED_RELAY_OK] callLogId=$callLogId sourceEventId=$sourceEventId " +
                        "skipped=$skipped reason=${reason ?: "(none)"}",
                )
                CallTaskRelayResult.Acked(skipped = skipped, reason = reason, taskId = taskId)
            }
        } catch (e: Exception) {
            Log.w(TAG, "[CALL_TASK_RELAY_FAIL] callLogId=$callLogId ${exceptionDetail(e)}")
            CallTaskRelayResult.Retryable(e.javaClass.simpleName)
        }
    }

    /** @deprecated Prefer outbox + [relayEndedOutbox]. Kept for any residual direct callers. */
    @Deprecated("Use CallLogOutboxIngestor + CallLogRelayWorker")
    fun relayEndedCall(context: android.content.Context, event: EndedCallEvent) {
        val store = CallTaskRelayStore(context)
        if (store.wasRelayed(event.callLogId)) return
        val sourceEventId = resolveSourceEventId(event)
        val result = relayEndedOutbox(
            sourceEventId = sourceEventId,
            phone = event.normalizedPhone,
            contactName = event.contactName,
            startedAtMs = event.startedAtMs,
            endedAtMs = event.endedAtMs,
            durationSeconds = event.durationSeconds,
            direction = event.direction,
            callLogId = event.callLogId,
        )
        if (result is CallTaskRelayResult.Acked) {
            store.markRelayed(event.callLogId)
        }
    }
}
