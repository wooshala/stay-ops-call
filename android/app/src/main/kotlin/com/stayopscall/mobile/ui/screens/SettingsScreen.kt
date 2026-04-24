package com.stayopscall.mobile.ui.screens

import android.app.Activity
import android.content.Intent
import android.util.Log
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Button
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.unit.dp
import androidx.documentfile.provider.DocumentFile
import androidx.work.Constraints
import androidx.work.ExistingWorkPolicy
import androidx.work.NetworkType
import androidx.work.OneTimeWorkRequestBuilder
import androidx.work.WorkManager
import com.stayopscall.mobile.core.storage.RecordingFolderStore
import com.stayopscall.mobile.core.storage.WorkerDebugStore
import com.stayopscall.mobile.work.ScanRecordingFolderWorker
import com.stayopscall.mobile.work.UploadQueueWorker
import kotlinx.coroutines.delay

@Composable
fun SettingsScreen() {
    val context = LocalContext.current
    val folderStore = remember { RecordingFolderStore(context) }
    val debugStore = remember { WorkerDebugStore(context) }

    var selectedUri by remember { mutableStateOf(folderStore.getFolderUri()) }
    var scanLog by remember { mutableStateOf(debugStore.get(WorkerDebugStore.KEY_SCAN_LAST)) }
    var uploadLog by remember { mutableStateOf(debugStore.get(WorkerDebugStore.KEY_UPLOAD_LAST)) }

    LaunchedEffect(Unit) {
        while (true) {
            delay(3000)
            scanLog = debugStore.get(WorkerDebugStore.KEY_SCAN_LAST)
            uploadLog = debugStore.get(WorkerDebugStore.KEY_UPLOAD_LAST)
        }
    }

    val folderPicker = rememberLauncherForActivityResult(
        contract = ActivityResultContracts.StartActivityForResult()
    ) { result ->
        if (result.resultCode != Activity.RESULT_OK) return@rememberLauncherForActivityResult
        val uri = result.data?.data ?: return@rememberLauncherForActivityResult
        var flags = (result.data?.flags ?: 0) and
            (Intent.FLAG_GRANT_READ_URI_PERMISSION or Intent.FLAG_GRANT_WRITE_URI_PERMISSION)
        if (flags == 0) flags = Intent.FLAG_GRANT_READ_URI_PERMISSION or Intent.FLAG_GRANT_WRITE_URI_PERMISSION
        runCatching { context.contentResolver.takePersistableUriPermission(uri, flags) }
        folderStore.saveTreeUri(uri)
        selectedUri = uri
        Log.d("StayOpsScan", "folder selected")
        triggerSync(context)
    }

    val folderName = selectedUri?.let {
        DocumentFile.fromTreeUri(context, it)?.name ?: "(알 수 없음)"
    }

    Column(
        modifier = Modifier
            .fillMaxSize()
            .padding(horizontal = 24.dp, vertical = 32.dp)
            .verticalScroll(rememberScrollState()),
        verticalArrangement = Arrangement.spacedBy(16.dp)
    ) {
        Text("통화 녹음 업로드", style = MaterialTheme.typography.headlineMedium)

        Spacer(modifier = Modifier.height(4.dp))
        HorizontalDivider()

        Text("녹음 폴더", style = MaterialTheme.typography.titleMedium)
        Text(
            text = folderName ?: "폴더가 선택되지 않았습니다",
            style = MaterialTheme.typography.bodyMedium,
            color = if (folderName != null) MaterialTheme.colorScheme.onSurface
                    else MaterialTheme.colorScheme.error
        )
        OutlinedButton(
            onClick = {
                folderPicker.launch(
                    Intent(Intent.ACTION_OPEN_DOCUMENT_TREE).apply {
                        addFlags(
                            Intent.FLAG_GRANT_READ_URI_PERMISSION or
                                Intent.FLAG_GRANT_WRITE_URI_PERMISSION or
                                Intent.FLAG_GRANT_PERSISTABLE_URI_PERMISSION
                        )
                    }
                )
            },
            modifier = Modifier.fillMaxWidth()
        ) {
            Text(if (folderName != null) "폴더 변경" else "폴더 선택")
        }

        Spacer(modifier = Modifier.height(4.dp))
        HorizontalDivider()

        Text("동기화 상태", style = MaterialTheme.typography.titleMedium)

        StatusRow(label = "스캔", value = scanLog)
        StatusRow(label = "업로드", value = uploadLog)

        Button(
            onClick = { triggerSync(context) },
            enabled = selectedUri != null,
            modifier = Modifier.fillMaxWidth()
        ) {
            Text("지금 동기화")
        }
    }
}

@Composable
private fun StatusRow(label: String, value: String?) {
    Column {
        Text(label, style = MaterialTheme.typography.labelMedium,
            color = MaterialTheme.colorScheme.primary)
        Text(
            text = value ?: "아직 실행되지 않음",
            style = MaterialTheme.typography.bodySmall,
            color = if (value != null) MaterialTheme.colorScheme.onSurface
                    else MaterialTheme.colorScheme.onSurfaceVariant
        )
    }
}

private fun triggerSync(context: android.content.Context) {
    val uploadRequest = OneTimeWorkRequestBuilder<UploadQueueWorker>()
        .setConstraints(
            Constraints.Builder()
                .setRequiredNetworkType(NetworkType.CONNECTED)
                .build()
        )
        .build()

    WorkManager.getInstance(context)
        .beginUniqueWork(
            "sync_recordings",
            ExistingWorkPolicy.REPLACE,
            OneTimeWorkRequestBuilder<ScanRecordingFolderWorker>().build()
        )
        .then(uploadRequest)
        .enqueue()

    Log.d("StayOpsUpload", "auto scan/upload chain enqueued")
}
