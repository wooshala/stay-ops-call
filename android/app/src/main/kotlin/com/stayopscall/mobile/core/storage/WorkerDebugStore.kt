package com.stayopscall.mobile.core.storage

import android.content.Context

class WorkerDebugStore(context: Context) {
    private val prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)

    fun put(key: String, value: String) {
        prefs.edit().putString(key, value).commit()
    }

    fun get(key: String): String? = prefs.getString(key, null)

    fun putLong(key: String, value: Long) {
        prefs.edit().putLong(key, value).commit()
    }

    fun getLong(key: String): Long? =
        if (prefs.contains(key)) prefs.getLong(key, 0L) else null

    companion object {
        const val PREFS_NAME = "worker_debug"
        const val KEY_FOLDER_LAST = "folder_last"
        const val KEY_SCAN_LAST = "scan_last"
        const val KEY_UPLOAD_LAST = "upload_last"
        const val KEY_SYNC_LAST = "sync_last"
        const val KEY_SYNC_STATUS = "sync_status"
        const val KEY_SYNC_STATUS_DETAIL = "sync_status_detail"
        const val KEY_SYNC_SOURCE = "sync_source"
        const val KEY_FOREGROUND_SYNC_LAST_MS = "foreground_sync_last_ms"
        const val KEY_LAST_RELAY_SUCCESS_MS = "last_relay_success_ms"
        const val KEY_LAST_SCAN_SUCCESS_MS = "last_scan_success_ms"
        const val KEY_LAST_UPLOAD_SUCCESS_MS = "last_upload_success_ms"
        const val KEY_LAST_HEARTBEAT_OK_MS = "last_heartbeat_ok_ms"
        const val KEY_LAST_RELAY_FAILURE_MS = "last_relay_failure_ms"
        const val KEY_LAST_RELAY_FAILURE_ERROR = "last_relay_failure_error"
    }
}
