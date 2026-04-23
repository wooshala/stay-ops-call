package com.stayopscall.mobile.work

import android.content.Context
import android.util.Log
import androidx.documentfile.provider.DocumentFile
import androidx.room.Room
import androidx.work.Worker
import androidx.work.WorkerParameters
import com.stayopscall.mobile.core.storage.RecordingFolderStore
import com.stayopscall.mobile.core.storage.WorkerDebugStore
import com.stayopscall.mobile.data.local.AppDatabase
import com.stayopscall.mobile.data.local.RecordingStatus
import com.stayopscall.mobile.data.local.entity.CallRecordingEntity
import kotlinx.coroutines.runBlocking

private const val TAG_SCAN = "StayOpsScan"

class ScanRecordingFolderWorker(
    appContext: Context,
    params: WorkerParameters
) : Worker(appContext, params) {
    override fun doWork(): Result {
        val debugStore = WorkerDebugStore(applicationContext)
        Log.d(TAG_SCAN, "doWork() entered")
        debugStore.put(WorkerDebugStore.KEY_SCAN_LAST, "entered doWork")

        return try {
            runScan(debugStore)
        } catch (e: Throwable) {
            Log.e(TAG_SCAN, "doWork exception", e)
            debugStore.put(
                WorkerDebugStore.KEY_SCAN_LAST,
                "failed: exception ${e.javaClass.simpleName}: ${e.message}"
            )
            Result.failure()
        }
    }

    private fun runScan(debugStore: WorkerDebugStore): Result {
        val folderStore = RecordingFolderStore(applicationContext)
        val cr = applicationContext.contentResolver
        val k = WorkerDebugStore.KEY_SCAN_LAST

        fun mark(message: String) {
            Log.d(TAG_SCAN, message)
            debugStore.put(k, message)
        }

        val treeUri = folderStore.getFolderUri().also {
            mark("loaded treeUri")
        }
        if (treeUri == null) {
            Log.w(TAG_SCAN, "treeUri null")
            debugStore.put(k, "failed: treeUri null")
            return Result.failure()
        }

        val persistedRead = cr.persistedUriPermissions.any { p ->
            p.uri == treeUri && p.isReadPermission
        }
        mark("persisted permission checked (read=$persistedRead)")

        val root = DocumentFile.fromTreeUri(applicationContext, treeUri)
        val fromTreeOk = root != null
        val exists = root?.exists() == true
        val canRead = root?.canRead() == true
        val isDirectory = root?.isDirectory == true
        if (fromTreeOk) mark("fromTreeUri ok")

        mark("listFiles start (root)")
        val listResult = runCatching { root?.listFiles() }
        mark("listFiles call finished (root)")
        val listFilesOk = listResult.isSuccess
        val listFilesError = listResult.exceptionOrNull()?.message
        val rootChildren = listResult.getOrNull()
        val rootFileCount = rootChildren?.count { it.isFile } ?: 0
        mark("listFiles done count=$rootFileCount (root)")

        val diag = "treeUriNull=false, persistedRead=$persistedRead, fromTreeUri=$fromTreeOk, " +
            "exists=$exists, canRead=$canRead, isDirectory=$isDirectory, " +
            "listFilesOk=$listFilesOk, rootFileCount=$rootFileCount"

        Log.d(TAG_SCAN, diag)

        if (!fromTreeOk || root == null) {
            mark("failed: fromTreeUri null ($diag)")
            return Result.failure()
        }
        if (!exists) {
            mark("failed: root not exists ($diag)")
            return Result.failure()
        }
        if (!canRead) {
            mark("failed: cannot read root ($diag)")
            return Result.failure()
        }
        if (!listFilesOk) {
            mark("failed: listFiles threw: ${listFilesError ?: "unknown"} ($diag)")
            return Result.failure()
        }

        val scanStart = System.currentTimeMillis()
        mark("scan recursion start")
        val allFiles = flattenFiles(
            root = root,
            onProgress = { index, name, queueSize ->
                if (index == 1 || index % 25 == 0) {
                    mark("scan item $index : $name (queue=$queueSize)")
                } else {
                    Log.d(TAG_SCAN, "scan item $index : $name (queue=$queueSize)")
                }
            }
        )
        mark("scan recursion done elapsed=${System.currentTimeMillis() - scanStart}ms")
        val audioFiles = allFiles.filter { isAudioFile(it) }
        Log.d(TAG_SCAN, "audioFiles found=${audioFiles.size}")

        val dao = ScanWorkerDeps.get(applicationContext).callRecordingDao()
        var insertedCount = 0
        var skippedCount = 0
        val now = System.currentTimeMillis()

        audioFiles.forEachIndexed { idx, file ->
            try {
                // TODO: compute real SHA-256 in a separate background step after pipeline is validated
                val entity = CallRecordingEntity(
                    fileName = file.name ?: "unknown",
                    fileUri = file.uri.toString(),
                    fileSize = file.length(),
                    lastModifiedAt = file.lastModified().takeIf { it > 0 } ?: now,
                    sha256 = null,
                    status = RecordingStatus.Pending,
                    createdAt = now,
                    updatedAt = now
                )
                val rowId = runBlocking { dao.insert(entity) }
                if (rowId == -1L) skippedCount++ else insertedCount++
            } catch (e: Exception) {
                Log.e(TAG_SCAN, "insert failed file=${file.name}", e)
                skippedCount++
            }
        }

        val ts = java.time.LocalTime.now().toString().substring(0, 5)
        val summary = "[$ts] 스캔 완료: 오디오 ${audioFiles.size}개, 신규 $insertedCount건"
        mark(summary)
        return Result.success()
    }

    private fun flattenFiles(
        root: DocumentFile,
        onProgress: (index: Int, name: String, queueSize: Int) -> Unit
    ): List<DocumentFile> {
        val results = mutableListOf<DocumentFile>()
        val stack = ArrayDeque<DocumentFile>()
        stack.add(root)
        var visited = 0
        while (stack.isNotEmpty()) {
            val current = stack.removeFirst()
            val dirName = current.name ?: "(dir)"
            Log.d(TAG_SCAN, "enter dir=$dirName")
            val children = try {
                current.listFiles()
            } catch (e: Throwable) {
                Log.e(TAG_SCAN, "listFiles failed dir=$dirName", e)
                continue
            }
            Log.d(TAG_SCAN, "listFiles done dir=$dirName children=${children.size}")
            children.forEach { child ->
                visited++
                onProgress(visited, child.name ?: "(unknown)", stack.size)
                if (child.isDirectory) stack.add(child)
                if (child.isFile) results.add(child)
            }
        }
        return results
    }

    private fun isAudioFile(file: DocumentFile): Boolean {
        val mime = file.type?.lowercase().orEmpty()
        if (mime.startsWith("audio/")) return true
        val name = file.name?.lowercase().orEmpty()
        return name.endsWith(".m4a") || name.endsWith(".mp3") || name.endsWith(".aac") ||
            name.endsWith(".wav") || name.endsWith(".3gp") || name.endsWith(".amr") || name.endsWith(".ogg")
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
                    .addMigrations(AppDatabase.MIGRATION_1_2, AppDatabase.MIGRATION_2_3)
                    .build()
                    .also { db = it }
            }
        }
    }
}
