package com.stayopscall.mobile.core.boot

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.util.Log
import com.stayopscall.mobile.core.calllog.CallLogCallTaskMonitor
import com.stayopscall.mobile.core.calllog.CallLogOutboxIngestor
import com.stayopscall.mobile.core.phone.IncomingCallListener
import com.stayopscall.mobile.core.sync.RecordingSyncTrigger
import com.stayopscall.mobile.work.CallLogRelayWorker
import com.stayopscall.mobile.work.CollectorHeartbeatWorker
import com.stayopscall.mobile.work.PeriodicSyncWorker

class BootCompletedReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent?) {
        if (intent?.action != Intent.ACTION_BOOT_COMPLETED &&
            intent?.action != Intent.ACTION_LOCKED_BOOT_COMPLETED
        ) {
            return
        }
        val app = context.applicationContext
        Log.i(TAG, "BOOT_COMPLETED — reschedule collectors")
        for (action in BootCollectorRecovery.actions()) {
            when (action) {
                BootCollectorRecovery.Action.SCHEDULE_PERIODIC_SYNC ->
                    PeriodicSyncWorker.schedule(app)
                BootCollectorRecovery.Action.SCHEDULE_HEARTBEAT ->
                    CollectorHeartbeatWorker.schedulePeriodic(app)
                BootCollectorRecovery.Action.ENQUEUE_HEARTBEAT_NOW ->
                    CollectorHeartbeatWorker.enqueueNow(app)
                BootCollectorRecovery.Action.START_CALLLOG_MONITOR ->
                    CallLogCallTaskMonitor.start(app)
                BootCollectorRecovery.Action.ENQUEUE_CALLLOG_DISCOVER ->
                    CallLogOutboxIngestor.scanAndEnqueue(app, trigger = "boot")
                BootCollectorRecovery.Action.ENQUEUE_CALLLOG_RELAY ->
                    CallLogRelayWorker.enqueue(app)
                BootCollectorRecovery.Action.ENQUEUE_RECORDING_SCAN ->
                    RecordingSyncTrigger.enqueueScan(app, forceFullReconcile = false, staleRecovered = false)
                BootCollectorRecovery.Action.ENQUEUE_RECORDING_UPLOAD ->
                    RecordingSyncTrigger.enqueueUpload(app)
            }
        }
        IncomingCallListener.start(app)
    }

    companion object {
        private const val TAG = "StayOpsBoot"
    }
}
