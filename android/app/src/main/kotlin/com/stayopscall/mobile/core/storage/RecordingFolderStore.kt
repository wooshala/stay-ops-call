package com.stayopscall.mobile.core.storage

import android.content.Context
import android.net.Uri

class RecordingFolderStore(context: Context) {
    private val prefs = context.getSharedPreferences("recording_folder", Context.MODE_PRIVATE)

    fun saveFolderUri(uri: Uri) {
        prefs.edit().putString(KEY_RECORDING_FOLDER_URI, uri.toString()).apply()
    }

    /** Tree URI from SAF after takePersistableUriPermission succeeds. */
    fun saveTreeUri(uri: Uri) = saveFolderUri(uri)

    fun getFolderUri(): Uri? = prefs.getString(KEY_RECORDING_FOLDER_URI, null)?.let(Uri::parse)

    private companion object {
        const val KEY_RECORDING_FOLDER_URI = "recording_folder_uri"
    }
}
