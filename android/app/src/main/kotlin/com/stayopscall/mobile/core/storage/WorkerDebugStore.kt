package com.stayopscall.mobile.core.storage

import android.content.Context

class WorkerDebugStore(context: Context) {
    private val prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)

    fun put(key: String, value: String) {
        prefs.edit().putString(key, value).commit()
    }

    fun get(key: String): String? = prefs.getString(key, null)

    companion object {
        const val PREFS_NAME = "worker_debug"
        const val KEY_FOLDER_LAST = "folder_last"
        const val KEY_SCAN_LAST = "scan_last"
        const val KEY_UPLOAD_LAST = "upload_last"
    }
}
