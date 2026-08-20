package com.stayopscall.mobile.work

import android.content.Context
import android.util.Log
import androidx.work.Constraints
import androidx.work.CoroutineWorker
import androidx.work.ExistingWorkPolicy
import androidx.work.NetworkType
import androidx.work.OneTimeWorkRequestBuilder
import androidx.work.WorkManager
import androidx.work.WorkerParameters
import androidx.work.workDataOf
import com.stayopscall.mobile.core.calllog.CallLogOutboxIngestor
import com.stayopscall.mobile.core.relay.CallTaskRelayClient
import com.stayopscall.mobile.core.relay.CallTaskRelayResult
import com.stayopscall.mobile.core.relay.CallTaskRelayStore
import com.stayopscall.mobile.core.storage.WorkerDebugStore
import com.stayopscall.mobile.core.sync.CollectorRetryPolicy
import com.stayopscall.mobile.data.local.AppDatabaseProvider
import com.stayopscall.mobile.data.local.CallLogOutboxStatus
import kotlinx.coroutines.delay

class CallLogRelayWorker(
    appContext: Context,
    params: WorkerParameters,
) : CoroutineWorker(appContext, params) {

    override suspend fun doWork(): Result {
        val discoverOnly = inputData.getBoolean(KEY_DISCOVER, false)
        if (discoverOnly) {
            CallLogOutboxIngestor.scanAndEnqueue(applicationContext, trigger = "relay_discover")
            return Result.success()
        }

        val dao = AppDatabaseProvider.get(applicationContext).callLogOutboxDao()
        val prefs = CallTaskRelayStore(applicationContext)
        val now = System.currentTimeMillis()

        dao.requeueStaleSending(
            fromStatus = CallLogOutboxStatus.Sending,
            toStatus = CallLogOutboxStatus.Pending,
            staleBefore = now - STALE_SENDING_MS,
            now = now,
        )

        val batch = dao.loadDue(
            statuses = CallLogOutboxStatus.drainStatuses,
            nowMs = now,
            limit = BATCH_LIMIT,
        )

        if (batch.isEmpty()) {
            Log.d(TAG, "outbox empty or waiting for backoff")
            return Result.success()
        }

        var anyRetryable = false
        var acked = 0

        for (item in batch) {
            if (item.phoneNumber.isBlank() || item.durationSeconds <= 0) {
                if (item.status != CallLogOutboxStatus.Acked) {
                    dao.update(
                        item.copy(
                            status = CallLogOutboxStatus.FailedPermanent,
                            lastError = "invalid_stub",
                            updatedAt = System.currentTimeMillis(),
                        ),
                    )
                }
                continue
            }

            val sendingAt = System.currentTimeMillis()
            dao.update(
                item.copy(
                    status = CallLogOutboxStatus.Sending,
                    lastAttemptAt = sendingAt,
                    attemptCount = item.attemptCount + 1,
                    updatedAt = sendingAt,
                ),
            )

            val result = CallTaskRelayClient.relayEndedOutbox(
                sourceEventId = item.sourceEventId,
                phone = item.phoneNumber,
                contactName = item.contactName,
                startedAtMs = item.startedAtMs,
                endedAtMs = item.endedAtMs,
                durationSeconds = item.durationSeconds,
                direction = item.direction,
                callLogId = item.androidCallLogId,
            )

            val doneAt = System.currentTimeMillis()
            val attempts = item.attemptCount + 1
            when (result) {
                is CallTaskRelayResult.Acked -> {
                    dao.update(
                        item.copy(
                            status = CallLogOutboxStatus.Acked,
                            attemptCount = attempts,
                            lastAttemptAt = sendingAt,
                            lastError = null,
                            ackedAt = doneAt,
                            updatedAt = doneAt,
                            nextAttemptAt = 0L,
                        ),
                    )
                    prefs.markRelayed(item.androidCallLogId)
                    WorkerDebugStore(applicationContext).putLong(
                        WorkerDebugStore.KEY_LAST_RELAY_SUCCESS_MS,
                        doneAt,
                    )
                    acked++
                }
                is CallTaskRelayResult.Permanent -> {
                    dao.update(
                        item.copy(
                            status = CallLogOutboxStatus.FailedPermanent,
                            attemptCount = attempts,
                            lastAttemptAt = sendingAt,
                            lastError = result.error,
                            updatedAt = doneAt,
                            nextAttemptAt = Long.MAX_VALUE,
                        ),
                    )
                }
                is CallTaskRelayResult.AuthBlocked -> {
                    dao.update(
                        item.copy(
                            status = CallLogOutboxStatus.AuthBlocked,
                            attemptCount = attempts,
                            lastAttemptAt = sendingAt,
                            lastError = result.error,
                            updatedAt = doneAt,
                            nextAttemptAt = CollectorRetryPolicy.authNextAttemptAt(doneAt),
                        ),
                    )
                    anyRetryable = true
                }
                is CallTaskRelayResult.Retryable -> {
                    dao.update(
                        item.copy(
                            status = CallLogOutboxStatus.Retryable,
                            attemptCount = attempts,
                            lastAttemptAt = sendingAt,
                            lastError = result.error,
                            updatedAt = doneAt,
                            nextAttemptAt = CollectorRetryPolicy.nextAttemptAt(attempts, doneAt),
                        ),
                    )
                    WorkerDebugStore(applicationContext).apply {
                        putLong(WorkerDebugStore.KEY_LAST_RELAY_FAILURE_MS, doneAt)
                        put(WorkerDebugStore.KEY_LAST_RELAY_FAILURE_ERROR, result.error.take(200))
                    }
                    anyRetryable = true
                }
            }

            delay(50)
        }

        val remaining = dao.countByStatuses(CallLogOutboxStatus.drainStatuses)
        Log.i(TAG, "relay batch acked=$acked remaining=$remaining retryable=$anyRetryable")

        if (remaining > 0) {
            enqueue(applicationContext, delayMs = if (anyRetryable) RETRY_DELAY_MS else 500L)
        }

        return Result.success()
    }

    companion object {
        private const val TAG = "StayOpsCallRelay"
        private const val UNIQUE_RELAY = "call_log_relay"
        private const val UNIQUE_DISCOVER = "call_log_discover"
        const val KEY_DISCOVER = "discover"
        private const val BATCH_LIMIT = 20
        private const val STALE_SENDING_MS = 2 * 60 * 1000L
        private const val RETRY_DELAY_MS = 30_000L

        fun enqueue(context: Context, delayMs: Long = 0L) {
            val builder = OneTimeWorkRequestBuilder<CallLogRelayWorker>()
                .setConstraints(
                    Constraints.Builder()
                        .setRequiredNetworkType(NetworkType.CONNECTED)
                        .build(),
                )
            if (delayMs > 0L) {
                builder.setInitialDelay(delayMs, java.util.concurrent.TimeUnit.MILLISECONDS)
            }
            WorkManager.getInstance(context.applicationContext)
                .enqueueUniqueWork(UNIQUE_RELAY, ExistingWorkPolicy.REPLACE, builder.build())
        }

        fun enqueueDiscover(context: Context) {
            val request = OneTimeWorkRequestBuilder<CallLogRelayWorker>()
                .setInputData(workDataOf(KEY_DISCOVER to true))
                .setInitialDelay(1, java.util.concurrent.TimeUnit.SECONDS)
                .build()
            WorkManager.getInstance(context.applicationContext)
                .enqueueUniqueWork(UNIQUE_DISCOVER, ExistingWorkPolicy.REPLACE, request)
        }
    }
}
