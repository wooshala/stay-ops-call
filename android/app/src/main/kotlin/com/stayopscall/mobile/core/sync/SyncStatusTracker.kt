package com.stayopscall.mobile.core.sync

import android.content.Context
import android.util.Log
import com.stayopscall.mobile.core.storage.WorkerDebugStore
import java.time.LocalTime

object SyncStatusTracker {
    private const val TAG = "StayOpsSync"

    fun markSyncStarted(store: WorkerDebugStore) {
        store.put(WorkerDebugStore.KEY_SYNC_STATUS, "syncing")
        store.put(WorkerDebugStore.KEY_SYNC_STATUS_DETAIL, "동기화 중...")
    }

    fun onSyncChainFinished(context: Context, success: Boolean, errorMsg: String? = null) {
        val store = WorkerDebugStore(context.applicationContext)
        val source = store.get(WorkerDebugStore.KEY_SYNC_SOURCE)
            ?.let { runCatching { SyncSource.valueOf(it) }.getOrNull() }

        if (success) {
            val ts = LocalTime.now().toString().substring(0, 5)
            store.put(WorkerDebugStore.KEY_SYNC_LAST, ts)
            store.put(WorkerDebugStore.KEY_SYNC_STATUS, "success")
            store.put(WorkerDebugStore.KEY_SYNC_STATUS_DETAIL, "완료")
            when (source) {
                SyncSource.MANUAL, SyncSource.SETTINGS -> Log.d(TAG, "[MANUAL_SYNC_DONE]")
                SyncSource.FOREGROUND -> Log.d(TAG, "[FOREGROUND_SYNC_DONE]")
                else -> Unit
            }
        } else {
            store.put(WorkerDebugStore.KEY_SYNC_STATUS, "failed")
            store.put(WorkerDebugStore.KEY_SYNC_STATUS_DETAIL, errorMsg ?: "실패")
            when (source) {
                SyncSource.MANUAL, SyncSource.SETTINGS ->
                    Log.d(TAG, "[MANUAL_SYNC_FAIL] ${errorMsg ?: "unknown"}")
                else -> Unit
            }
        }
    }
}
