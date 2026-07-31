package com.stayopscall.mobile.core.calllog

import android.content.Context
import android.database.ContentObserver
import android.os.Handler
import android.os.HandlerThread
import android.provider.CallLog
import android.util.Log
import com.stayopscall.mobile.core.relay.CallTaskRelayClient

object CallLogCallTaskMonitor {
    private const val TAG = "StayOpsCallRelay"
    private const val LOOKBACK_MS = 15 * 60 * 1000L

    @Volatile
    private var started = false

    private var handlerThread: HandlerThread? = null
    private var observer: ContentObserver? = null

    fun start(context: Context) {
        val appContext = context.applicationContext
        if (!CallLogMatcher.hasCallLogPermission(appContext)) return

        synchronized(this) {
            if (started) return

            val thread = HandlerThread("CallLogCallTaskRelay").also { it.start() }
            handlerThread = thread
            val handler = Handler(thread.looper)

            observer = object : ContentObserver(handler) {
                override fun onChange(selfChange: Boolean) {
                    scanAndRelay(appContext, handler)
                }
            }

            appContext.contentResolver.registerContentObserver(
                CallLog.Calls.CONTENT_URI,
                true,
                observer!!,
            )
            started = true
            Log.d(TAG, "CallLog observer registered")
            scanAndRelay(appContext, handler)
        }
    }

    fun scanAndRelay(context: Context) {
        val appContext = context.applicationContext
        val thread = handlerThread
        if (thread == null || !thread.isAlive) {
            start(appContext)
            return
        }
        scanAndRelay(appContext, Handler(thread.looper))
    }

    private fun scanAndRelay(appContext: Context, handler: Handler) {
        handler.post {
            try {
                val sinceMs = System.currentTimeMillis() - LOOKBACK_MS
                val events = CallLogEndedCallScanner.scanRecentEndedCalls(appContext, sinceMs)
                for (event in events) {
                    Log.i(TAG, "[CALL_ENDED_DETECTED] callLogId=${event.callLogId} phone=***${event.normalizedPhone.takeLast(4)} duration=${event.durationSeconds}s direction=${event.direction}")
                    CallTaskRelayClient.relayEndedCall(appContext, event)
                }
            } catch (e: Exception) {
                Log.e(TAG, "scanAndRelay failed", e)
            }
        }
    }
}
