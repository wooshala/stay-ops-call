package com.stayopscall.mobile.work

import android.content.Context
import android.util.Log
import androidx.work.ExistingPeriodicWorkPolicy
import androidx.work.PeriodicWorkRequestBuilder
import androidx.work.Worker
import androidx.work.WorkerParameters
import androidx.work.WorkManager
import com.stayopscall.mobile.core.storage.RecordingFolderStore
import com.stayopscall.mobile.core.storage.WorkerDebugStore
import com.stayopscall.mobile.core.sync.RecordingSyncTrigger
import com.stayopscall.mobile.core.sync.ScanProgressStore
import com.stayopscall.mobile.core.sync.SyncSource
import com.stayopscall.mobile.core.sync.SyncStatusTracker
import java.util.concurrent.TimeUnit

class PeriodicSyncWorker(
    appContext: Context,
    params: WorkerParameters,
) : Worker(appContext, params) {

    override fun doWork(): Result {
        Log.d("StayOpsScan", "periodic sync tick")

        val folderStore = RecordingFolderStore(applicationContext)
        if (folderStore.getFolderUri() == null) {
            Log.d("StayOpsScan", "periodic sync: no folder configured, skip")
            return Result.success()
        }

        WorkerDebugStore(applicationContext).put(
            WorkerDebugStore.KEY_SYNC_SOURCE,
            SyncSource.PERIODIC.name,
        )
        SyncStatusTracker.markSyncStarted(WorkerDebugStore(applicationContext))

        val progress = ScanProgressStore(applicationContext)
        RecordingSyncTrigger.recoverStaleScanIfNeeded(applicationContext, progress)

        // Independent legs — upload is never BLOCKED on scan.
        RecordingSyncTrigger.enqueueScan(applicationContext, forceFullReconcile = false)
        RecordingSyncTrigger.enqueueUpload(applicationContext)

        Log.d("StayOpsUpload", "periodic scan+upload enqueued independently")
        return Result.success()
    }

    companion object {
        private const val WORK_NAME = "periodic_sync"

        fun schedule(context: Context) {
            val request = PeriodicWorkRequestBuilder<PeriodicSyncWorker>(
                15, TimeUnit.MINUTES,
            ).build()

            WorkManager.getInstance(context)
                .enqueueUniquePeriodicWork(
                    WORK_NAME,
                    ExistingPeriodicWorkPolicy.KEEP,
                    request,
                )

            Log.d("StayOpsUpload", "periodic sync scheduled")
        }
    }
}
