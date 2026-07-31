package com.stayopscall.mobile.core.sync

import android.content.Context
import android.util.Log
import androidx.work.Constraints
import androidx.work.ExistingWorkPolicy
import androidx.work.NetworkType
import androidx.work.OneTimeWorkRequestBuilder
import androidx.work.WorkManager
import com.stayopscall.mobile.core.storage.RecordingFolderStore
import com.stayopscall.mobile.core.storage.WorkerDebugStore
import com.stayopscall.mobile.work.ScanRecordingFolderWorker
import com.stayopscall.mobile.work.UploadQueueWorker

enum class SyncSource {
    MANUAL,
    FOREGROUND,
    SETTINGS,
    PERIODIC,
}

object RecordingSyncTrigger {
    private const val TAG = "StayOpsSync"
    const val UNIQUE_WORK_NAME = "sync_recordings"
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
        val folderStore = RecordingFolderStore(context)
        if (folderStore.getFolderUri() == null) {
            Log.d(TAG, "sync skipped: no folder configured")
            return
        }

        val debugStore = WorkerDebugStore(context)
        debugStore.put(WorkerDebugStore.KEY_SYNC_SOURCE, source.name)
        SyncStatusTracker.markSyncStarted(debugStore)

        when (source) {
            SyncSource.MANUAL, SyncSource.SETTINGS -> Log.d(TAG, "[MANUAL_SYNC_START]")
            SyncSource.FOREGROUND -> Log.d(TAG, "[FOREGROUND_SYNC_START]")
            SyncSource.PERIODIC -> Unit
        }

        val uploadRequest = OneTimeWorkRequestBuilder<UploadQueueWorker>()
            .setConstraints(
                Constraints.Builder()
                    .setRequiredNetworkType(NetworkType.CONNECTED)
                    .build()
            )
            .build()

        WorkManager.getInstance(context)
            .beginUniqueWork(
                UNIQUE_WORK_NAME,
                ExistingWorkPolicy.REPLACE,
                OneTimeWorkRequestBuilder<ScanRecordingFolderWorker>().build()
            )
            .then(uploadRequest)
            .enqueue()

        Log.d(TAG, "scan/upload chain enqueued source=$source")
    }
}
