package com.stayopscall.mobile

import android.app.Application
import androidx.hilt.work.HiltWorkerFactory
import androidx.work.Configuration
import com.stayopscall.mobile.core.calllog.CallLogCallTaskMonitor
import com.stayopscall.mobile.core.phone.IncomingCallListener
import com.stayopscall.mobile.core.relay.CallTaskConfigLogger
import com.stayopscall.mobile.work.PeriodicSyncWorker
import dagger.hilt.android.HiltAndroidApp
import javax.inject.Inject

@HiltAndroidApp
class StayOpsCallApp : Application(), Configuration.Provider {
    @Inject
    lateinit var workerFactory: HiltWorkerFactory

    override val workManagerConfiguration: Configuration
        get() = Configuration.Builder()
            .setWorkerFactory(workerFactory)
            .build()

    override fun onCreate() {
        super.onCreate()
        CallTaskConfigLogger.logOnceAtStartup()
        PeriodicSyncWorker.schedule(this)
        CallLogCallTaskMonitor.start(this)
        IncomingCallListener.start(this)  // READ_PHONE_STATE 없으면 no-op
    }
}
