package com.stayopscall.mobile.work

import android.content.Context
import androidx.work.Constraints
import androidx.work.ExistingPeriodicWorkPolicy
import androidx.work.ExistingWorkPolicy
import androidx.work.NetworkType
import androidx.work.OneTimeWorkRequestBuilder
import androidx.work.PeriodicWorkRequestBuilder
import androidx.work.WorkManager
import java.util.concurrent.TimeUnit

class WorkOrchestrator(private val context: Context) {
    fun enqueueScanUploadSyncChain() {
        val scan = OneTimeWorkRequestBuilder<ScanRecordingFolderWorker>().build()
        val upload = OneTimeWorkRequestBuilder<UploadQueueWorker>().build()
        val sync = OneTimeWorkRequestBuilder<StatusSyncWorker>().build()
        WorkManager.getInstance(context)
            .beginUniqueWork(
                "scan-upload-sync",
                ExistingWorkPolicy.KEEP,
                scan,
            )
            .then(upload)
            .then(sync)
            .enqueue()
    }

    fun schedulePeriodicSync() {
        val periodic = PeriodicWorkRequestBuilder<StatusSyncWorker>(15, TimeUnit.MINUTES)
            .setConstraints(
                Constraints.Builder()
                    .setRequiredNetworkType(NetworkType.CONNECTED)
                    .build()
            )
            .build()
        WorkManager.getInstance(context).enqueueUniquePeriodicWork(
            "status-sync",
            ExistingPeriodicWorkPolicy.KEEP,
            periodic
        )
    }
}
