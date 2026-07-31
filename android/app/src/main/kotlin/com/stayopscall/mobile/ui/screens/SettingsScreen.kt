package com.stayopscall.mobile.ui.screens

import android.Manifest
import android.app.Activity
import android.content.Intent
import android.content.pm.PackageManager
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
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.LocalLifecycleOwner
import androidx.compose.ui.unit.dp
import androidx.core.content.ContextCompat
import androidx.documentfile.provider.DocumentFile
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.LifecycleEventObserver
import com.stayopscall.mobile.work.PeriodicSyncWorker
import com.stayopscall.mobile.core.storage.RecordingFolderStore
import com.stayopscall.mobile.core.storage.WorkerDebugStore
import com.stayopscall.mobile.core.sync.BatteryOptimizationHelper
import com.stayopscall.mobile.core.calllog.CallLogCallTaskMonitor
import com.stayopscall.mobile.core.phone.IncomingCallListener
import com.stayopscall.mobile.core.sync.RecordingSyncTrigger
import com.stayopscall.mobile.core.sync.SyncSource
import kotlinx.coroutines.delay

@Composable
fun SettingsScreen() {
    val context = LocalContext.current
    val folderStore = remember { RecordingFolderStore(context) }
    val debugStore = remember { WorkerDebugStore(context) }

    var selectedUri by remember { mutableStateOf(folderStore.getFolderUri()) }
    var scanLog by remember { mutableStateOf(debugStore.get(WorkerDebugStore.KEY_SCAN_LAST)) }
    var uploadLog by remember { mutableStateOf(debugStore.get(WorkerDebugStore.KEY_UPLOAD_LAST)) }
    var callLogGranted by remember {
        mutableStateOf(
            ContextCompat.checkSelfPermission(context, Manifest.permission.READ_CALL_LOG) ==
                PackageManager.PERMISSION_GRANTED
        )
    }
    var phoneStateGranted by remember {
        mutableStateOf(IncomingCallListener.hasPermission(context))
    }
    var batteryOptIgnored by remember {
        mutableStateOf(BatteryOptimizationHelper.isIgnoringBatteryOptimizations(context))
    }

    val lifecycleOwner = LocalLifecycleOwner.current
    DisposableEffect(lifecycleOwner) {
        val observer = LifecycleEventObserver { _, event ->
            if (event == Lifecycle.Event.ON_RESUME) {
                callLogGranted = ContextCompat.checkSelfPermission(
                    context,
                    Manifest.permission.READ_CALL_LOG,
                ) == PackageManager.PERMISSION_GRANTED
                phoneStateGranted = IncomingCallListener.hasPermission(context)
                batteryOptIgnored = BatteryOptimizationHelper.isIgnoringBatteryOptimizations(context)
                if (callLogGranted) CallLogCallTaskMonitor.start(context)
                if (phoneStateGranted) IncomingCallListener.start(context)
            }
        }
        lifecycleOwner.lifecycle.addObserver(observer)
        onDispose { lifecycleOwner.lifecycle.removeObserver(observer) }
    }

    val callLogPermissionLauncher = rememberLauncherForActivityResult(
        contract = ActivityResultContracts.RequestPermission(),
    ) { granted ->
        callLogGranted = granted
        if (granted) CallLogCallTaskMonitor.start(context)
    }

    val phoneStatePermissionLauncher = rememberLauncherForActivityResult(
        contract = ActivityResultContracts.RequestPermission(),
    ) { granted ->
        phoneStateGranted = granted
        if (granted) IncomingCallListener.start(context)
    }

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
        PeriodicSyncWorker.schedule(context)
        RecordingSyncTrigger.triggerSync(context, SyncSource.SETTINGS)
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

        Text("통화기록 권한", style = MaterialTheme.typography.titleMedium)
        Text(
            text = if (callLogGranted) {
                "허용됨 — 통화기록에서 전화번호를 찾을 수 있습니다"
            } else {
                "통화기록 권한 없음 — 전화번호 표시 불가"
            },
            style = MaterialTheme.typography.bodyMedium,
            color = if (callLogGranted) MaterialTheme.colorScheme.onSurface
            else MaterialTheme.colorScheme.error,
        )
        if (!callLogGranted) {
            OutlinedButton(
                onClick = { callLogPermissionLauncher.launch(Manifest.permission.READ_CALL_LOG) },
                modifier = Modifier.fillMaxWidth(),
            ) {
                Text("통화기록 권한 허용")
            }
        }
        Text(
            text = "권한을 거부해도 녹음 파일 업로드는 계속됩니다.",
            style = MaterialTheme.typography.bodySmall,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
        )

        Spacer(modifier = Modifier.height(4.dp))
        HorizontalDivider()

        Text("전화 수신 감지 권한", style = MaterialTheme.typography.titleMedium)
        Text(
            text = if (phoneStateGranted) {
                "허용됨 — 전화 수신 즉시 CRM 팝업이 표시됩니다"
            } else {
                "권한 없음 — 전화 수신 감지 불가 (통화 종료 후만 표시됨)"
            },
            style = MaterialTheme.typography.bodyMedium,
            color = if (phoneStateGranted) MaterialTheme.colorScheme.onSurface
            else MaterialTheme.colorScheme.error,
        )
        if (!phoneStateGranted) {
            OutlinedButton(
                onClick = { phoneStatePermissionLauncher.launch(Manifest.permission.READ_PHONE_STATE) },
                modifier = Modifier.fillMaxWidth(),
            ) {
                Text("전화 수신 감지 권한 허용")
            }
        }
        Text(
            text = "Android 11 이상에서는 수신 시 번호가 없을 수 있습니다. 통화 종료 후 자동 보강됩니다.",
            style = MaterialTheme.typography.bodySmall,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
        )

        Spacer(modifier = Modifier.height(4.dp))
        HorizontalDivider()

        Text("동기화 상태", style = MaterialTheme.typography.titleMedium)

        StatusRow(label = "스캔", value = scanLog)
        StatusRow(label = "업로드", value = uploadLog)

        Button(
            onClick = { RecordingSyncTrigger.triggerManualSync(context) },
            enabled = selectedUri != null,
            modifier = Modifier.fillMaxWidth()
        ) {
            Text("지금 동기화")
        }

        Spacer(modifier = Modifier.height(4.dp))
        HorizontalDivider()

        Text("배터리 최적화", style = MaterialTheme.typography.titleMedium)
        Text(
            text = if (batteryOptIgnored) {
                "배터리 최적화 제외됨"
            } else {
                "배터리 최적화가 켜져 있으면 자동 동기화가 늦어질 수 있습니다."
            },
            style = MaterialTheme.typography.bodyMedium,
            color = if (batteryOptIgnored) MaterialTheme.colorScheme.onSurface
            else MaterialTheme.colorScheme.error,
        )
        OutlinedButton(
            onClick = { BatteryOptimizationHelper.openBatteryOptimizationSettings(context) },
            modifier = Modifier.fillMaxWidth(),
        ) {
            Text("배터리 최적화 제외 설정 열기")
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
