package com.stayopscall.mobile.core.relay

import android.content.Context

class CallTaskRelayStore(context: Context) {
    private val prefs = context.applicationContext.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)

    fun wasRelayed(callLogId: Long): Boolean =
        prefs.getBoolean(key(callLogId), false)

    fun markRelayed(callLogId: Long) {
        val editor = prefs.edit().putBoolean(key(callLogId), true)
        val keys = prefs.all.keys.filter { it.startsWith(KEY_PREFIX) }
        if (keys.size > MAX_TRACKED) {
            keys.sorted()
                .take(keys.size - MAX_TRACKED)
                .forEach { editor.remove(it) }
        }
        editor.apply()
    }

    private fun key(callLogId: Long) = "$KEY_PREFIX$callLogId"

    companion object {
        private const val PREFS_NAME = "call_task_relay"
        private const val KEY_PREFIX = "relay_"
        private const val MAX_TRACKED = 500
    }
}
