package com.stayopscall.mobile.core.device

import android.content.Context
import android.os.Build
import android.provider.Settings
import java.util.UUID

class DeviceIdentityProvider(private val context: Context) {
    private val prefs = context.getSharedPreferences("device_identity", Context.MODE_PRIVATE)

    fun getOrCreateInstallationUuid(): String {
        val existing = prefs.getString(KEY_INSTALLATION_UUID, null)
        if (existing != null) return existing
        val generated = UUID.randomUUID().toString()
        prefs.edit().putString(KEY_INSTALLATION_UUID, generated).apply()
        return generated
    }

    fun androidIdOrNull(): String? =
        Settings.Secure.getString(context.contentResolver, Settings.Secure.ANDROID_ID)

    fun model(): String = Build.MODEL ?: "unknown"

    fun osVersion(): String = Build.VERSION.RELEASE ?: "unknown"

    private companion object {
        const val KEY_INSTALLATION_UUID = "installation_uuid"
    }
}
