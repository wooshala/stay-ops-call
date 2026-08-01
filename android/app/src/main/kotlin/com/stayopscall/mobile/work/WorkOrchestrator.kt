package com.stayopscall.mobile.work

import android.content.Context
import androidx.work.Constraints
import androidx.work.ExistingPeriodicWorkPolicy
import androidx.work.NetworkType
import androidx.work.PeriodicWorkRequestBuilder
import androidx.work.WorkManager
import com.stayopscall.mobile.core.sync.RecordingSyncTrigger
import java.util.concurrent.TimeUnit

class WorkOrchestrator(private val context: Context) {
    /** Independent scan + upload (no chain). */
    fun enqueueScanUploadSyncChain() {
        RecordingSyncTrigger.recoverStaleScanIfNeeded(context)
        RecordingSyncTrigger.enqueueScan(context, forceFullReconcile = false)
        RecordingSyncTrigger.enqueueUpload(context)
    }

    fun schedulePeriodicSync() {
        val periodic = PeriodicWorkRequestBuilder<StatusSyncWorker>(15, TimeUnit.MINUTES)
            .setConstraints(
                Constraints.Builder()
                    .setRequiredNetworkType(NetworkType.CONNECTED)
                    .build(),
            )
            .build()
        WorkManager.getInstance(context).enqueueUniquePeriodicWork(
            "status-sync",
            ExistingPeriodicWorkPolicy.KEEP,
            periodic,
        )
    }
}
