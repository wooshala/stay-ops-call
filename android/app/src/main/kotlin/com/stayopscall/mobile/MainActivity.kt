package com.stayopscall.mobile

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import com.stayopscall.mobile.core.calllog.CallLogCallTaskMonitor
import com.stayopscall.mobile.core.sync.RecordingSyncTrigger
import com.stayopscall.mobile.ui.navigation.StayOpsNavHost
import com.stayopscall.mobile.ui.theme.StayOpsCallTheme
import com.stayopscall.mobile.work.CollectorHeartbeatWorker
import dagger.hilt.android.AndroidEntryPoint

@AndroidEntryPoint
class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()
        setContent {
            StayOpsCallTheme {
                Surface(color = MaterialTheme.colorScheme.background) {
                    StayOpsNavHost()
                }
            }
        }
    }

    override fun onResume() {
        super.onResume()
        CallLogCallTaskMonitor.scanAndRelay(applicationContext)
        RecordingSyncTrigger.triggerForegroundSync(applicationContext)
        CollectorHeartbeatWorker.enqueueNow(applicationContext)
    }
}
