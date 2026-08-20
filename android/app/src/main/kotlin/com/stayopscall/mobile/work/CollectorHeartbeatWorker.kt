package com.stayopscall.mobile.work

import android.content.Context
import android.net.ConnectivityManager
import android.net.NetworkCapabilities
import android.os.Build
import android.os.PowerManager
import android.os.SystemClock
import android.util.Log
import androidx.work.Constraints
import androidx.work.CoroutineWorker
import androidx.work.ExistingPeriodicWorkPolicy
import androidx.work.ExistingWorkPolicy
import androidx.work.NetworkType
import androidx.work.OneTimeWorkRequestBuilder
import androidx.work.PeriodicWorkRequestBuilder
import androidx.work.WorkManager
import androidx.work.WorkerParameters
import com.stayopscall.mobile.BuildConfig
import com.stayopscall.mobile.core.calllog.CallLogScanTelemetryStore
import com.stayopscall.mobile.core.device.DeviceIdentityProvider
import com.stayopscall.mobile.core.storage.WorkerDebugStore
import com.stayopscall.mobile.data.local.AppDatabaseProvider
import com.stayopscall.mobile.data.local.CallLogOutboxStatus
import com.stayopscall.mobile.data.local.RecordingStatus
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody
import org.json.JSONObject
import java.time.Instant
import java.util.concurrent.TimeUnit

/**
 * CALL-RELIABILITY-03/04 — monitoring-only heartbeat.
 * Never mutates CallLog outbox / recording upload queues.
 */
class CollectorHeartbeatWorker(
    appContext: Context,
    params: WorkerParameters,
) : CoroutineWorker(appContext, params) {

    override suspend fun doWork(): Result {
        return try {
            sendHeartbeat(applicationContext)
            Result.success()
        } catch (e: Exception) {
            Log.w(TAG, "heartbeat failed: ${e.message}")
            Result.success()
        }
    }

    companion object {
        private const val TAG = "StayOpsHeartbeat"
        private const val UNIQUE_PERIODIC = "collector_heartbeat_periodic"
        private const val UNIQUE_ONCE = "collector_heartbeat_once"
        private val jsonMedia = "application/json; charset=utf-8".toMediaType()
        private const val MS_1H = 60L * 60 * 1000
        private const val MS_24H = 24L * MS_1H

        fun schedulePeriodic(context: Context) {
            val req = PeriodicWorkRequestBuilder<CollectorHeartbeatWorker>(15, TimeUnit.MINUTES)
                .setConstraints(
                    Constraints.Builder()
                        .setRequiredNetworkType(NetworkType.CONNECTED)
                        .build(),
                )
                .build()
            WorkManager.getInstance(context.applicationContext)
                .enqueueUniquePeriodicWork(
                    UNIQUE_PERIODIC,
                    ExistingPeriodicWorkPolicy.KEEP,
                    req,
                )
            Log.d(TAG, "periodic heartbeat scheduled")
        }

        fun enqueueNow(context: Context) {
            val req = OneTimeWorkRequestBuilder<CollectorHeartbeatWorker>()
                .setConstraints(
                    Constraints.Builder()
                        .setRequiredNetworkType(NetworkType.CONNECTED)
                        .build(),
                )
                .build()
            WorkManager.getInstance(context.applicationContext)
                .enqueueUniqueWork(UNIQUE_ONCE, ExistingWorkPolicy.REPLACE, req)
        }

        suspend fun sendHeartbeat(context: Context) {
            val app = context.applicationContext
            val base = BuildConfig.UNIVER_OPS_URL.trim().trimEnd('/')
            val secret = BuildConfig.INTERNAL_EVENTS_SECRET.trim()
            if (base.isEmpty() || secret.isEmpty()) {
                Log.w(TAG, "heartbeat skipped: not configured")
                return
            }

            val identity = DeviceIdentityProvider(app)
            val debug = WorkerDebugStore(app)
            val scanTelemetry = CallLogScanTelemetryStore(app)
            val db = AppDatabaseProvider.get(app)
            val outbox = db.callLogOutboxDao()
            val recordings = db.callRecordingDao()
            val now = System.currentTimeMillis()

            val pendingOutbox = outbox.countByStatuses(
                listOf(CallLogOutboxStatus.Pending, CallLogOutboxStatus.Sending),
            )
            val retryOutbox = outbox.countByStatuses(
                listOf(CallLogOutboxStatus.Retryable, CallLogOutboxStatus.AuthBlocked),
            )
            val authBlockedOutbox = outbox.countByStatus(CallLogOutboxStatus.AuthBlocked)
            val failedOutbox = outbox.countByStatus(CallLogOutboxStatus.FailedPermanent)
            val pendingRec = recordings.countByStatuses(
                listOf(RecordingStatus.Pending, RecordingStatus.Uploading),
            )
            val retryRec = recordings.countByStatuses(
                listOf(RecordingStatus.Retryable, RecordingStatus.RetryPending, RecordingStatus.AuthBlocked),
            )
            val authBlockedRec = recordings.countByStatus(RecordingStatus.AuthBlocked)
            val failedRec = recordings.countByStatuses(
                listOf(RecordingStatus.FailedUpload, RecordingStatus.FailedPermanent),
            )

            val recentRelayFailures1h = outbox.countRecentAttempts(
                listOf(CallLogOutboxStatus.Retryable, CallLogOutboxStatus.AuthBlocked),
                now - MS_1H,
            )
            val recentRelayFailures24h = outbox.countRecentAttempts(
                listOf(CallLogOutboxStatus.Retryable, CallLogOutboxStatus.AuthBlocked),
                now - MS_24H,
            )
            val recentRecordingFailed1h = recordings.countByStatusSince(RecordingStatus.FailedPermanent, now - MS_1H)
            val recentRecordingFailed24h = recordings.countByStatusSince(RecordingStatus.FailedPermanent, now - MS_24H)

            val oldestPendingMs = listOfNotNull(
                outbox.oldestCreatedAt(
                    listOf(CallLogOutboxStatus.Pending, CallLogOutboxStatus.Sending),
                ),
                recordings.oldestCreatedAt(
                    listOf(RecordingStatus.Pending, RecordingStatus.Uploading),
                ),
            ).minOrNull()
            val oldestRetryMs = listOfNotNull(
                outbox.oldestAttemptAt(CallLogOutboxStatus.Retryable),
                outbox.oldestAttemptAt(CallLogOutboxStatus.AuthBlocked),
                recordings.oldestCreatedAt(
                    listOf(RecordingStatus.Retryable, RecordingStatus.RetryPending, RecordingStatus.AuthBlocked),
                ),
            ).minOrNull()

            val scanStatsRaw = scanTelemetry.lastStatsJson()
            val scanStats = scanStatsRaw?.let { runCatching { JSONObject(it) }.getOrNull() }

            val payload = JSONObject().apply {
                put("deviceId", identity.getOrCreateInstallationUuid())
                put("deviceModel", identity.model())
                put("appVersion", BuildConfig.VERSION_NAME)
                put("androidVersion", Build.VERSION.RELEASE ?: "")
                put("lastSeenAt", Instant.now().toString())
                putOptIso(this, "lastRelaySuccessAt", debug.getLong(WorkerDebugStore.KEY_LAST_RELAY_SUCCESS_MS))
                putOptIso(this, "lastRecordingScanAt", debug.getLong(WorkerDebugStore.KEY_LAST_SCAN_SUCCESS_MS))
                putOptIso(this, "lastRecordingUploadAt", debug.getLong(WorkerDebugStore.KEY_LAST_UPLOAD_SUCCESS_MS))
                putOptIso(this, "lastCallLogScanAttemptAt", scanTelemetry.lastAttemptMs())
                putOptIso(this, "lastCallLogScanCompletedAt", scanTelemetry.lastCompletedMs())
                put("lastCallLogScanResult", scanTelemetry.lastResult() ?: JSONObject.NULL)
                put("lastCallLogScanTrigger", scanTelemetry.lastTrigger() ?: JSONObject.NULL)
                put("lastCallLogCursorBefore", scanTelemetry.lastCursorBeforeJson() ?: JSONObject.NULL)
                put("lastCallLogCursorAfter", scanTelemetry.lastCursorAfterJson() ?: JSONObject.NULL)
                put("queuePending", pendingOutbox + pendingRec)
                put("queueRetry", retryOutbox + retryRec)
                put("queueAuthBlocked", authBlockedOutbox + authBlockedRec)
                put("queuePermanentFailed", failedOutbox + recordings.countByStatus(RecordingStatus.FailedPermanent))
                put("queueFailed", failedOutbox + failedRec)
                put("callLogFailed", failedOutbox)
                put("recordingFailed", failedRec)
                put("recentFailed1h", recentRecordingFailed1h)
                put("recentFailed24h", recentRecordingFailed24h)
                put("recentRelayFailures1h", recentRelayFailures1h)
                put("recentRelayFailures24h", recentRelayFailures24h)
                put("oldestPendingAgeMs", oldestPendingMs?.let { now - it } ?: JSONObject.NULL)
                put("oldestRetryAgeMs", oldestRetryMs?.let { now - it } ?: JSONObject.NULL)
                scanStats?.let { stats ->
                    put("lastScanScannedRows", stats.optInt("scannedRows"))
                    put("lastScanNewFound", stats.optInt("newFound"))
                    put("lastScanEnqueued", stats.optInt("enqueued"))
                    put("lastScanSkippedCursor", stats.optInt("skippedCursor"))
                    put("lastScanAlreadyOutbox", stats.optInt("alreadyOutbox"))
                }
                put("networkState", networkState(app))
                put("batteryOptimization", batteryOptimization(app))
                put("appState", "worker")
                put("bootTimeMs", System.currentTimeMillis() - SystemClock.elapsedRealtime())
            }

            val client = OkHttpClient.Builder()
                .connectTimeout(10, TimeUnit.SECONDS)
                .readTimeout(10, TimeUnit.SECONDS)
                .build()
            val request = Request.Builder()
                .url("$base/api/collector/heartbeat")
                .header("Authorization", "Bearer $secret")
                .header("Content-Type", "application/json; charset=utf-8")
                .post(payload.toString().toRequestBody(jsonMedia))
                .build()

            client.newCall(request).execute().use { resp ->
                val body = resp.body?.string().orEmpty()
                if (!resp.isSuccessful) {
                    Log.w(TAG, "heartbeat HTTP ${resp.code} body=${body.take(200)}")
                    return
                }
                debug.putLong(WorkerDebugStore.KEY_LAST_HEARTBEAT_OK_MS, System.currentTimeMillis())
                Log.i(TAG, "heartbeat ok ${body.take(180)}")
            }
        }

        private fun putOptIso(json: JSONObject, key: String, ms: Long?) {
            if (ms == null || ms <= 0L) {
                json.put(key, JSONObject.NULL)
            } else {
                json.put(key, Instant.ofEpochMilli(ms).toString())
            }
        }

        private fun networkState(context: Context): String {
            val cm = context.getSystemService(Context.CONNECTIVITY_SERVICE) as? ConnectivityManager
                ?: return "unknown"
            val net = cm.activeNetwork ?: return "none"
            val caps = cm.getNetworkCapabilities(net) ?: return "unknown"
            return when {
                caps.hasTransport(NetworkCapabilities.TRANSPORT_WIFI) -> "wifi"
                caps.hasTransport(NetworkCapabilities.TRANSPORT_CELLULAR) -> "cellular"
                else -> "other"
            }
        }

        private fun batteryOptimization(context: Context): String {
            return try {
                val pm = context.getSystemService(Context.POWER_SERVICE) as PowerManager
                if (pm.isIgnoringBatteryOptimizations(context.packageName)) "ignored" else "optimized"
            } catch (_: Exception) {
                "unknown"
            }
        }
    }
}
