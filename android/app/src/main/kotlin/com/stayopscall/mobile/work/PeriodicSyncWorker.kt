package com.stayopscall.mobile.work

import android.content.Context
import android.util.Log
import androidx.work.Constraints
import androidx.work.ExistingPeriodicWorkPolicy
import androidx.work.ExistingWorkPolicy
import androidx.work.NetworkType
import androidx.work.OneTimeWorkRequestBuilder
import androidx.work.PeriodicWorkRequestBuilder
import androidx.work.Worker
import androidx.work.WorkerParameters
import androidx.work.WorkManager
import com.stayopscall.mobile.core.storage.RecordingFolderStore
import com.stayopscall.mobile.core.storage.WorkerDebugStore
import com.stayopscall.mobile.core.sync.RecordingSyncTrigger
import com.stayopscall.mobile.core.sync.SyncSource
import java.util.concurrent.TimeUnit

class PeriodicSyncWorker(
    appContext: Context,
    params: WorkerParameters
) : Worker(appContext, params) {

    override fun doWork(): Result {
        Log.d("StayOpsScan", "periodic scan started")

        // 폴더 미선택 시 skip
        val folderStore = RecordingFolderStore(applicationContext)
        if (folderStore.getFolderUri() == null) {
            Log.d("StayOpsScan", "periodic sync: no folder configured, skip")
            return Result.success()
        }

        val uploadRequest = OneTimeWorkRequestBuilder<UploadQueueWorker>()
            .setConstraints(
                Constraints.Builder()
                    .setRequiredNetworkType(NetworkType.CONNECTED)
                    .build()
            )
            .build()

        // 수동 동기화가 이미 실행 중이면 방해하지 않음 (KEEP)
        WorkerDebugStore(applicationContext).put(
            WorkerDebugStore.KEY_SYNC_SOURCE,
            SyncSource.PERIODIC.name,
        )
        WorkManager.getInstance(applicationContext)
            .beginUniqueWork(
                RecordingSyncTrigger.UNIQUE_WORK_NAME,
                ExistingWorkPolicy.KEEP,
                OneTimeWorkRequestBuilder<ScanRecordingFolderWorker>().build()
            )
            .then(uploadRequest)
            .enqueue()

        Log.d("StayOpsUpload", "periodic upload started")
        return Result.success()
    }

    companion object {
        private const val WORK_NAME = "periodic_sync"

        fun schedule(context: Context) {
            val request = PeriodicWorkRequestBuilder<PeriodicSyncWorker>(
                15, TimeUnit.MINUTES
            ).build()

            WorkManager.getInstance(context)
                .enqueueUniquePeriodicWork(
                    WORK_NAME,
                    ExistingPeriodicWorkPolicy.KEEP,
                    request
                )

            Log.d("StayOpsUpload", "periodic sync scheduled")
        }
    }
}
