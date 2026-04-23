package com.stayopscall.mobile

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import com.stayopscall.mobile.ui.navigation.StayOpsNavHost
import com.stayopscall.mobile.ui.theme.StayOpsCallTheme
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
}
