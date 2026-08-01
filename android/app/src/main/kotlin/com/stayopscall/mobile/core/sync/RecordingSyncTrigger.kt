package com.stayopscall.mobile.core.sync

import android.content.Context
import android.util.Log
import androidx.work.Constraints
import androidx.work.ExistingWorkPolicy
import androidx.work.NetworkType
import androidx.work.OneTimeWorkRequestBuilder
import androidx.work.WorkInfo
import androidx.work.WorkManager
import androidx.work.workDataOf
import com.stayopscall.mobile.core.storage.RecordingFolderStore
import com.stayopscall.mobile.core.storage.WorkerDebugStore
import com.stayopscall.mobile.work.ScanRecordingFolderWorker
import com.stayopscall.mobile.work.UploadQueueWorker
import java.util.concurrent.TimeUnit

enum class SyncSource {
    MANUAL,
    FOREGROUND,
    SETTINGS,
    PERIODIC,
}

/**
 * Independent Scan / Upload enqueue (no WorkManager `.then()` chain).
 *
 * Policy: never blindly REPLACE a healthy running scan. Stale scans are cancelled
 * via [recoverStaleScanIfNeeded] and the follow-up enqueue uses REPLACE because cancel
 * completion is asynchronous (KEEP would no-op while the cancelled work still looks active).
 */
object RecordingSyncTrigger {
    private const val TAG = "StayOpsSync"

    /** Legacy unique name (chained). No longer enqueued; UI may still observe briefly after upgrade. */
    const val UNIQUE_WORK_NAME = "sync_recordings"

    const val UNIQUE_SCAN_WORK = "scan_recordings"
    const val UNIQUE_UPLOAD_WORK = "upload_recordings"

    private const val FOREGROUND_DEBOUNCE_MS = 60_000L

    fun triggerManualSync(context: Context) {
        triggerSync(context.applicationContext, SyncSource.MANUAL)
    }

    fun triggerForegroundSync(context: Context) {
        val appContext = context.applicationContext
        val debugStore = WorkerDebugStore(appContext)
        val lastMs = debugStore.getLong(WorkerDebugStore.KEY_FOREGROUND_SYNC_LAST_MS) ?: 0L
        val now = System.currentTimeMillis()
        if (now - lastMs < FOREGROUND_DEBOUNCE_MS) {
            Log.d(TAG, "[FOREGROUND_SYNC_SKIPPED_DEBOUNCE]")
            return
        }
        debugStore.putLong(WorkerDebugStore.KEY_FOREGROUND_SYNC_LAST_MS, now)
        triggerSync(appContext, SyncSource.FOREGROUND)
    }

    fun triggerSync(context: Context, source: SyncSource) {
        val appContext = context.applicationContext
        val folderStore = RecordingFolderStore(appContext)
        if (folderStore.getFolderUri() == null) {
            Log.d(TAG, "sync skipped: no folder configured")
            return
        }

        val debugStore = WorkerDebugStore(appContext)
        debugStore.put(WorkerDebugStore.KEY_SYNC_SOURCE, source.name)
        SyncStatusTracker.markSyncStarted(debugStore)

        when (source) {
            SyncSource.MANUAL, SyncSource.SETTINGS -> Log.d(TAG, "[MANUAL_SYNC_START]")
            SyncSource.FOREGROUND -> Log.d(TAG, "[FOREGROUND_SYNC_START]")
            SyncSource.PERIODIC -> Unit
        }

        val progress = ScanProgressStore(appContext)
        val staleRecovered = recoverStaleScanIfNeeded(appContext, progress)
        // Drop legacy Scan.then(Upload) unique work if still present after upgrade.
        WorkManager.getInstance(appContext).cancelUniqueWork(UNIQUE_WORK_NAME)

        val forceFull = source == SyncSource.MANUAL || source == SyncSource.SETTINGS
        enqueueScan(appContext, forceFullReconcile = forceFull, staleRecovered = staleRecovered)
        enqueueUpload(appContext)

        Log.d(TAG, "scan+upload enqueued independently source=$source forceFull=$forceFull stale=$staleRecovered")
    }

    /**
     * @param forceFullReconcile manual/settings diagnostic path — full reconcile from start
     * when no healthy scan is already running (unless [staleRecovered] forces REPLACE).
     * @param staleRecovered when true, use REPLACE so a new scan is actually scheduled after cancel.
     */
    fun enqueueScan(
        context: Context,
        forceFullReconcile: Boolean = false,
        staleRecovered: Boolean = false,
    ) {
        val appContext = context.applicationContext
        val progress = ScanProgressStore(appContext)
        val active = hasActiveWork(appContext, UNIQUE_SCAN_WORK)
        val policy = ScanEnqueuePolicy.scanPolicy(staleRecovered, active)

        if (policy == ScanEnqueuePolicy.UniquePolicy.KEEP && active) {
            Log.d(TAG, "scan enqueue skipped: healthy active work present (KEEP)")
            WorkManager.getInstance(appContext)
                .enqueueUniqueWork(
                    UNIQUE_SCAN_WORK,
                    ExistingWorkPolicy.KEEP,
                    OneTimeWorkRequestBuilder<ScanRecordingFolderWorker>().build(),
                )
            return
        }

        if (forceFullReconcile) {
            progress.setReconcileCursor(null)
            progress.setReconcileOffset(0)
        }

        val mode = when {
            forceFullReconcile -> ScanRecordingFolderWorker.MODE_FULL_RECONCILE
            progress.needsFullReconcile() -> ScanRecordingFolderWorker.MODE_FULL_RECONCILE
            else -> ScanRecordingFolderWorker.MODE_INCREMENTAL
        }

        val request = OneTimeWorkRequestBuilder<ScanRecordingFolderWorker>()
            .setInputData(
                workDataOf(
                    ScanRecordingFolderWorker.KEY_MODE to mode,
                ),
            )
            .build()

        val wmPolicy = when (policy) {
            ScanEnqueuePolicy.UniquePolicy.REPLACE -> ExistingWorkPolicy.REPLACE
            ScanEnqueuePolicy.UniquePolicy.KEEP -> ExistingWorkPolicy.KEEP
        }

        WorkManager.getInstance(appContext)
            .enqueueUniqueWork(UNIQUE_SCAN_WORK, wmPolicy, request)

        Log.d(TAG, "scan enqueued mode=$mode policy=$wmPolicy staleRecovered=$staleRecovered")
    }

    fun enqueueUpload(context: Context) {
        val appContext = context.applicationContext
        val request = OneTimeWorkRequestBuilder<UploadQueueWorker>()
            .setConstraints(
                Constraints.Builder()
                    .setRequiredNetworkType(NetworkType.CONNECTED)
                    .build(),
            )
            .build()

        WorkManager.getInstance(appContext)
            .enqueueUniqueWork(UNIQUE_UPLOAD_WORK, ExistingWorkPolicy.KEEP, request)

        Log.d(TAG, "upload enqueued policy=KEEP")
    }

    /** @return true if a stale run was cancelled. */
    fun recoverStaleScanIfNeeded(
        context: Context,
        progress: ScanProgressStore = ScanProgressStore(context),
    ): Boolean {
        if (!progress.isStale()) return false
        val started = progress.startedAtOrNull()
        val age = started?.let { System.currentTimeMillis() - it }
        Log.w(TAG, "stale_scan_detected ageMs=$age ${progress.snapshotLine()}")
        progress.markStaleRecovered("watchdog")
        WorkManager.getInstance(context.applicationContext).cancelUniqueWork(UNIQUE_SCAN_WORK)
        // Note: cancel is async — callers must enqueueScan(staleRecovered=true) → REPLACE.
        return true
    }

    fun hasActiveWork(context: Context, uniqueName: String): Boolean {
        return try {
            val infos = WorkManager.getInstance(context)
                .getWorkInfosForUniqueWork(uniqueName)
                .get(3, TimeUnit.SECONDS)
            infos.any {
                it.state == WorkInfo.State.RUNNING ||
                    it.state == WorkInfo.State.ENQUEUED ||
                    it.state == WorkInfo.State.BLOCKED
            }
        } catch (e: Exception) {
            Log.w(TAG, "hasActiveWork failed name=$uniqueName", e)
            false
        }
    }

    fun isSyncWorkActive(context: Context): Boolean {
        return hasActiveWork(context, UNIQUE_SCAN_WORK) ||
            hasActiveWork(context, UNIQUE_UPLOAD_WORK)
    }
}
