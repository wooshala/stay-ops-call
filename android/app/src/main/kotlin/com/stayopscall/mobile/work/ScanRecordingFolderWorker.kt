package com.stayopscall.mobile.work

import android.content.Context
import android.util.Log
import androidx.documentfile.provider.DocumentFile
import androidx.room.Room
import androidx.work.Worker
import androidx.work.WorkerParameters
import com.stayopscall.mobile.core.calllog.RecordingCallMetadata
import com.stayopscall.mobile.core.storage.RecordingFolderStore
import com.stayopscall.mobile.core.storage.WorkerDebugStore
import com.stayopscall.mobile.core.sync.SyncStatusTracker
import com.stayopscall.mobile.data.local.AppDatabase
import com.stayopscall.mobile.data.local.RecordingStatus
import com.stayopscall.mobile.data.local.entity.CallRecordingEntity
import kotlinx.coroutines.runBlocking

private const val TAG_SCAN = "StayOpsScan"
private const val SCAN_TOP_N = 50

class ScanRecordingFolderWorker(
    appContext: Context,
    params: WorkerParameters
) : Worker(appContext, params) {

    override fun doWork(): Result {
        val debugStore = WorkerDebugStore(applicationContext)
        return try {
            runScan(debugStore)
        } catch (e: Throwable) {
            Log.e(TAG_SCAN, "doWork exception", e)
            debugStore.put(
                WorkerDebugStore.KEY_SCAN_LAST,
                "failed: ${e.javaClass.simpleName}: ${e.message}"
            )
            SyncStatusTracker.onSyncChainFinished(
                applicationContext,
                success = false,
                errorMsg = e.message ?: e.javaClass.simpleName,
            )
            Result.failure()
        }
    }

    private fun runScan(debugStore: WorkerDebugStore): Result {
        val folderStore = RecordingFolderStore(applicationContext)
        val k = WorkerDebugStore.KEY_SCAN_LAST

        fun mark(msg: String) {
            Log.d(TAG_SCAN, msg)
            debugStore.put(k, msg)
        }

        mark("scan optimized start")

        val treeUri = folderStore.getFolderUri() ?: run {
            mark("failed: treeUri null")
            SyncStatusTracker.onSyncChainFinished(applicationContext, success = false, errorMsg = "treeUri null")
            return Result.failure()
        }

        val root = DocumentFile.fromTreeUri(applicationContext, treeUri) ?: run {
            mark("failed: fromTreeUri null")
            SyncStatusTracker.onSyncChainFinished(applicationContext, success = false, errorMsg = "fromTreeUri null")
            return Result.failure()
        }

        val children = runCatching { root.listFiles() }.getOrElse {
            mark("failed: listFiles: ${it.message}")
            SyncStatusTracker.onSyncChainFinished(
                applicationContext,
                success = false,
                errorMsg = it.message,
            )
            return Result.failure()
        }

        // 직접 자식만 검사 (재귀 없음), 최신순 정렬 후 상위 N개만
        val candidates = children
            .filter { it.isFile && isAudioFile(it) }
            .sortedByDescending { it.lastModified() }
            .take(SCAN_TOP_N)

        mark("candidates=${candidates.size}")

        if (candidates.isEmpty()) {
            val ts = java.time.LocalTime.now().toString().substring(0, 5)
            mark("[$ts] 스캔 완료: 신규 0건")
            Log.d(TAG_SCAN, "ScanRecordingFolderWorker success")
            return Result.success()
        }

        val dao = ScanWorkerDeps.get(applicationContext).callRecordingDao()

        // DB에 이미 있는 URI 일괄 조회 → 신규 파일만 추려내기
        val candidateUris = candidates.map { it.uri.toString() }
        val existingUris = runBlocking { dao.findExistingUris(candidateUris) }.toSet()

        val newFiles = candidates.filter { it.uri.toString() !in existingUris }
        mark("new=${newFiles.size} skippedExisting=${candidates.size - newFiles.size}")

        val now = System.currentTimeMillis()
        var insertedCount = 0

        for (file in newFiles) {
            try {
                val base = CallRecordingEntity(
                    fileName = file.name ?: "unknown",
                    fileUri = file.uri.toString(),
                    fileSize = file.length(),
                    lastModifiedAt = file.lastModified().takeIf { it > 0 } ?: now,
                    sha256 = null,
                    status = RecordingStatus.Pending,
                    createdAt = now,
                    updatedAt = now
                )
                val entity = RecordingCallMetadata.enrichEntity(
                    applicationContext,
                    base.fileName,
                    base,
                )
                val rowId = runBlocking { dao.insert(entity) }
                if (rowId != -1L) insertedCount++
            } catch (e: Exception) {
                Log.e(TAG_SCAN, "insert failed: ${file.name}", e)
            }
        }

        val ts = java.time.LocalTime.now().toString().substring(0, 5)
        mark("[$ts] 스캔 완료: 신규 ${insertedCount}건")
        Log.d(TAG_SCAN, "ScanRecordingFolderWorker success")
        return Result.success()
    }

    private fun isAudioFile(file: DocumentFile): Boolean {
        val mime = file.type?.lowercase().orEmpty()
        if (mime.startsWith("audio/")) return true
        val name = file.name?.lowercase().orEmpty()
        return name.endsWith(".m4a") || name.endsWith(".mp3") || name.endsWith(".aac") ||
            name.endsWith(".wav") || name.endsWith(".3gp") || name.endsWith(".amr") || name.endsWith(".ogg")
    }

    // 전체 재귀 스캔 — 필요 시 수동 호출용으로 보존
    @Suppress("unused")
    private fun flattenFiles(root: DocumentFile): List<DocumentFile> {
        val results = mutableListOf<DocumentFile>()
        val stack = ArrayDeque<DocumentFile>()
        stack.add(root)
        while (stack.isNotEmpty()) {
            val current = stack.removeFirst()
            val children = try {
                current.listFiles()
            } catch (e: Throwable) {
                Log.e(TAG_SCAN, "listFiles failed dir=${current.name}", e)
                continue
            }
            children.forEach { child ->
                if (child.isDirectory) stack.add(child)
                if (child.isFile) results.add(child)
            }
        }
        return results
    }

    private object ScanWorkerDeps {
        @Volatile private var db: AppDatabase? = null

        fun get(context: Context): AppDatabase {
            db?.let { return it }
            return synchronized(this) {
                db ?: Room.databaseBuilder(
                    context.applicationContext,
                    AppDatabase::class.java,
                    "stay_ops_call.db"
                )
                    .addMigrations(
                        AppDatabase.MIGRATION_1_2,
                        AppDatabase.MIGRATION_2_3,
                        AppDatabase.MIGRATION_3_4,
                    )
                    .build()
                    .also { db = it }
            }
        }
    }
}
