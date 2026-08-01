package com.stayopscall.mobile.ui.screens

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.Button
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.unit.dp
import com.stayopscall.mobile.core.storage.RecordingFolderStore
import com.stayopscall.mobile.core.storage.WorkerDebugStore
import com.stayopscall.mobile.core.sync.RecordingSyncTrigger
import kotlinx.coroutines.delay

@Composable
fun HomeScreen(
    onGoLogin: () -> Unit,
    onGoSettings: () -> Unit,
    onGoCalls: () -> Unit,
    onGoStatus: () -> Unit
) {
    val context = LocalContext.current
    val folderStore = remember { RecordingFolderStore(context) }
    val debugStore = remember { WorkerDebugStore(context) }
    val hasFolder = remember { mutableStateOf(folderStore.getFolderUri() != null) }

    var lastSync by remember { mutableStateOf(debugStore.get(WorkerDebugStore.KEY_SYNC_LAST)) }
    var syncStatus by remember { mutableStateOf(debugStore.get(WorkerDebugStore.KEY_SYNC_STATUS)) }
    var syncStatusDetail by remember {
        mutableStateOf(debugStore.get(WorkerDebugStore.KEY_SYNC_STATUS_DETAIL))
    }
    var isWorkRunning by remember { mutableStateOf(false) }

    val isSyncing = isWorkRunning || syncStatus == "syncing"

    LaunchedEffect(Unit) {
        while (true) {
            delay(2000)
            hasFolder.value = folderStore.getFolderUri() != null
            lastSync = debugStore.get(WorkerDebugStore.KEY_SYNC_LAST)
            syncStatus = debugStore.get(WorkerDebugStore.KEY_SYNC_STATUS)
            syncStatusDetail = debugStore.get(WorkerDebugStore.KEY_SYNC_STATUS_DETAIL)
            isWorkRunning = RecordingSyncTrigger.isSyncWorkActive(context)
        }
    }

    Column(
        modifier = Modifier
            .fillMaxSize()
            .padding(24.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.spacedBy(12.dp, Alignment.CenterVertically)
    ) {
        Text("StayOps-Call", style = MaterialTheme.typography.headlineMedium)

        Column(
            modifier = Modifier.fillMaxWidth(),
            verticalArrangement = Arrangement.spacedBy(8.dp)
        ) {
            Text(
                text = if (lastSync != null) "마지막 동기화: $lastSync" else "아직 동기화 없음",
                style = MaterialTheme.typography.bodyMedium,
            )
            SyncStatusLine(status = syncStatus, detail = syncStatusDetail, isSyncing = isSyncing)

            Button(
                onClick = { RecordingSyncTrigger.triggerManualSync(context) },
                enabled = hasFolder.value && !isSyncing,
                modifier = Modifier.fillMaxWidth(),
            ) {
                Text(if (isSyncing) "동기화 중..." else "지금 동기화")
            }
            Text(
                text = "최근 통화 녹음을 즉시 확인합니다",
                style = MaterialTheme.typography.bodySmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
            )
            if (!hasFolder.value) {
                Text(
                    text = "설정에서 녹음 폴더를 먼저 선택하세요",
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.error,
                )
            }
        }

        Spacer(modifier = Modifier.height(8.dp))
        HorizontalDivider()
        Spacer(modifier = Modifier.height(8.dp))

        Button(onClick = onGoLogin) { Text("Login") }
        Button(onClick = onGoSettings) { Text("Settings") }
        Button(onClick = onGoCalls) { Text("Call List") }
        Button(onClick = onGoStatus) { Text("Processing Status") }
    }
}

@Composable
private fun SyncStatusLine(status: String?, detail: String?, isSyncing: Boolean) {
    val label = when {
        isSyncing -> "상태: 동기화 중..."
        status == "success" -> "상태: 완료${detail?.let { " ($it)" } ?: ""}"
        status == "failed" -> "상태: 실패${detail?.let { " — $it" } ?: ""}"
        else -> "상태: 대기"
    }
    Text(
        text = label,
        style = MaterialTheme.typography.bodySmall,
        color = when {
            isSyncing -> MaterialTheme.colorScheme.primary
            status == "failed" -> MaterialTheme.colorScheme.error
            else -> MaterialTheme.colorScheme.onSurfaceVariant
        },
    )
}
