package com.stayopscall.mobile.core.storage

import android.content.Context
import android.net.Uri

class FileStabilityStore(context: Context) {
    private val prefs = context.getSharedPreferences("file_stability", Context.MODE_PRIVATE)

    fun getLastSize(uri: Uri): Long? {
        val raw = prefs.getString(key(uri), null) ?: return null
        return raw.substringBefore("|").toLongOrNull()
    }

    fun putSnapshot(uri: Uri, size: Long) {
        prefs.edit()
            .putString(key(uri), "$size|${System.currentTimeMillis()}")
            .apply()
    }

    private fun key(uri: Uri): String = "size:${uri}"
}
