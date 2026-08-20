package com.stayopscall.mobile.work

import android.content.Context
import android.util.Log
import androidx.documentfile.provider.DocumentFile
import androidx.work.Worker
import androidx.work.WorkerParameters
import com.stayopscall.mobile.core.calllog.RecordingCallMetadata
import com.stayopscall.mobile.core.calllog.RecordingFilenameParser
import com.stayopscall.mobile.core.storage.RecordingFolderStore
import com.stayopscall.mobile.core.storage.WorkerDebugStore
import com.stayopscall.mobile.core.sync.RecordingSyncTrigger
import com.stayopscall.mobile.core.sync.ScanCandidateLogic
import com.stayopscall.mobile.core.sync.ScanEnqueuePolicy
import com.stayopscall.mobile.core.sync.ScanProgressStore
import com.stayopscall.mobile.core.sync.SyncStatusTracker
import com.stayopscall.mobile.data.local.AppDatabase
import com.stayopscall.mobile.data.local.AppDatabaseProvider
import com.stayopscall.mobile.data.local.RecordingStatus
import com.stayopscall.mobile.data.local.entity.CallRecordingEntity
import kotlinx.coroutines.runBlocking

private const val TAG_SCAN = "StayOpsScan"

class ScanRecordingFolderWorker(
    appContext: Context,
    params: WorkerParameters,
) : Worker(appContext, params) {

    override fun doWork(): Result {
        val debugStore = WorkerDebugStore(applicationContext)
        val progress = ScanProgressStore(applicationContext)
        val mode = inputData.getString(KEY_MODE) ?: MODE_INCREMENTAL
        val runId = progress.beginRun(mode)
        val startedAt = System.currentTimeMillis()

        return try {
            runScan(debugStore, progress, mode, startedAt, runId)
        } catch (e: Throwable) {
            Log.e(TAG_SCAN, "doWork exception run=$runId", e)
            debugStore.put(
                WorkerDebugStore.KEY_SCAN_LAST,
                "failed: ${e.javaClass.simpleName}",
            )
            progress.finish(ScanProgressStore.Result.FAILED)
            SyncStatusTracker.onScanFinished(
                applicationContext,
                success = false,
                errorMsg = e.javaClass.simpleName,
            )
            RecordingSyncTrigger.enqueueUpload(applicationContext)
            Result.failure()
        }
    }

    private fun runScan(
        debugStore: WorkerDebugStore,
        progress: ScanProgressStore,
        mode: String,
        startedAt: Long,
        runId: String,
    ): Result {
        fun mark(msg: String) {
            Log.d(TAG_SCAN, "run=$runId $msg")
            debugStore.put(WorkerDebugStore.KEY_SCAN_LAST, msg)
        }

        fun timedOut(where: String): Result {
            mark("timed_out at=$where ${progress.snapshotLine()}")
            progress.setPhase(ScanProgressStore.Phase.TIMED_OUT)
            progress.finish(ScanProgressStore.Result.TIMED_OUT)
            SyncStatusTracker.onScanFinished(
                applicationContext,
                success = false,
                errorMsg = "timed_out:$where",
            )
            RecordingSyncTrigger.enqueueUpload(applicationContext)
            return Result.failure()
        }

        fun checkTimeout(where: String): Result? {
            if (ScanCandidateLogic.isPastSoftTimeout(startedAt, System.currentTimeMillis())) {
                return timedOut(where)
            }
            return null
        }

        mark("scan start mode=$mode")

        val folderStore = RecordingFolderStore(applicationContext)
        val treeUri = folderStore.getFolderUri() ?: run {
            mark("failed: treeUri null")
            progress.finish(ScanProgressStore.Result.FAILED)
            SyncStatusTracker.onScanFinished(applicationContext, success = false, errorMsg = "treeUri null")
            return Result.failure()
        }

        val root = DocumentFile.fromTreeUri(applicationContext, treeUri) ?: run {
            mark("failed: fromTreeUri null")
            progress.finish(ScanProgressStore.Result.FAILED)
            SyncStatusTracker.onScanFinished(applicationContext, success = false, errorMsg = "fromTreeUri null")
            return Result.failure()
        }

        progress.setPhase(ScanProgressStore.Phase.LIST_FILES_BEGIN)
        val listStart = System.currentTimeMillis()
        val children = runCatching { root.listFiles() }.getOrElse {
            progress.recordTiming("listFiles_ms", System.currentTimeMillis() - listStart)
            mark("failed: listFiles")
            progress.finish(ScanProgressStore.Result.FAILED)
            SyncStatusTracker.onScanFinished(applicationContext, success = false, errorMsg = "listFiles")
            return Result.failure()
        }
        val listElapsed = System.currentTimeMillis() - listStart
        progress.recordTiming("listFiles_ms", listElapsed)
        progress.setPhase(ScanProgressStore.Phase.LIST_FILES_DONE)
        progress.setCounts(enumerated = children.size)
        mark("listFiles done count=${children.size} ms=$listElapsed")

        checkTimeout("after_listFiles")?.let { return it }

        val probeStart = System.currentTimeMillis()
        var isFileNameAccessMs = 0L
        var lastModifiedMs = 0L
        var estimatedProviderCalls = 1
        val probes = ArrayList<ScanCandidateLogic.FileProbe>(children.size)
        val docByUri = HashMap<String, DocumentFile>(children.size)
        val incrementalCutoff = if (mode == MODE_INCREMENTAL) {
            progress.lastSeenRecordingTimestamp()?.minus(ScanCandidateLogic.OVERLAP_MS)
        } else {
            null
        }

        for (child in children) {
            checkTimeout("during_enumerate")?.let { return it }

            val t0 = System.currentTimeMillis()
            val isFile = child.isFile
            estimatedProviderCalls++
            if (!isFile) {
                isFileNameAccessMs += System.currentTimeMillis() - t0
                continue
            }
            val name = child.name
            val type = child.type
            estimatedProviderCalls += 2
            isFileNameAccessMs += System.currentTimeMillis() - t0
            if (!isAudioFile(name, type)) continue

            val uri = child.uri.toString()
            val parsedTs = name?.let { RecordingFilenameParser.parse(it).recordedAtFromFilename }

            // Incremental fast-path: skip clearly-old filename timestamps without lastModified IPC.
            if (incrementalCutoff != null && parsedTs != null && parsedTs < incrementalCutoff) {
                continue
            }

            val t1 = System.currentTimeMillis()
            val mtime = child.lastModified().takeIf { it > 0 } ?: 0L
            estimatedProviderCalls++
            lastModifiedMs += System.currentTimeMillis() - t1

            val ranking = parsedTs ?: mtime
            if (ranking <= 0L) continue
            if (incrementalCutoff != null && ranking < incrementalCutoff) continue

            probes.add(
                ScanCandidateLogic.FileProbe(
                    uri = uri,
                    rankingTimestamp = ranking,
                    mtime = mtime,
                    hasFilenameTimestamp = parsedTs != null,
                ),
            )
            docByUri[uri] = child
        }
        progress.recordTiming("isFile_name_type_ms", isFileNameAccessMs)
        progress.recordTiming("lastModified_ms", lastModifiedMs)
        progress.recordTiming("enumerate_total_ms", System.currentTimeMillis() - probeStart)

        val sortStart = System.currentTimeMillis()
        val checkpoint = progress.lastSeenRecordingTimestamp()?.let { ts ->
            ScanCandidateLogic.Checkpoint(ts, progress.lastSeenUri())
        }

        val finalCandidates: List<ScanCandidateLogic.FileProbe>
        var nextReconcileCursor: ScanCandidateLogic.Checkpoint? = null
        var markReconcileComplete = false
        var incrementalHasMore = false

        if (mode == MODE_FULL_RECONCILE) {
            val page = ScanCandidateLogic.filterReconcileBatchByCursor(
                probes,
                cursor = progress.reconcileCursor(),
            )
            finalCandidates = page.batch
            if (page.hasMore) {
                nextReconcileCursor = page.nextCursor
            } else {
                nextReconcileCursor = null
                markReconcileComplete = true
            }
        } else {
            val page = ScanCandidateLogic.filterIncrementalDrain(probes, checkpoint)
            finalCandidates = page.batch
            incrementalHasMore = page.hasMore
        }

        progress.recordTiming("sort_filter_ms", System.currentTimeMillis() - sortStart)
        progress.setPhase(ScanProgressStore.Phase.FILTER_DONE)
        progress.setCounts(candidates = finalCandidates.size)
        mark(
            "filter done mode=$mode probes=${probes.size} candidates=${finalCandidates.size} " +
                "estIpc=$estimatedProviderCalls",
        )

        checkTimeout("after_filter")?.let { return it }

        if (finalCandidates.isEmpty()) {
            if (mode == MODE_FULL_RECONCILE && markReconcileComplete) {
                progress.markFullReconcileComplete()
            }
            progress.finish(ScanProgressStore.Result.SUCCESS)
            mark("scan complete inserted=0")
            SyncStatusTracker.onScanFinished(applicationContext, success = true)
            WorkerDebugStore(applicationContext).putLong(
                WorkerDebugStore.KEY_LAST_SCAN_SUCCESS_MS,
                System.currentTimeMillis(),
            )
            RecordingSyncTrigger.enqueueUpload(applicationContext)
            return Result.success()
        }

        val dao = ScanWorkerDeps.get(applicationContext).callRecordingDao()

        val roomStart = System.currentTimeMillis()
        val existingUris = runBlocking {
            dao.findExistingUris(finalCandidates.map { it.uri })
        }.toSet()
        progress.recordTiming("room_compare_ms", System.currentTimeMillis() - roomStart)
        progress.setPhase(ScanProgressStore.Phase.ROOM_COMPARE_DONE)

        val newProbes = finalCandidates.filter { it.uri !in existingUris }
        mark("room compare new=${newProbes.size} existing=${finalCandidates.size - newProbes.size}")

        checkTimeout("after_room")?.let { return it }

        val now = System.currentTimeMillis()
        var insertedCount = 0
        var enrichMs = 0L
        var insertMs = 0L
        var abortedDuringInsert = false

        for (probe in newProbes) {
            if (ScanCandidateLogic.isPastSoftTimeout(startedAt, System.currentTimeMillis())) {
                // Checkpoint must not advance.
                return timedOut("during_insert")
            }
            val file = docByUri[probe.uri] ?: continue
            try {
                val length = file.length()
                estimatedProviderCalls++
                val base = CallRecordingEntity(
                    fileName = file.name ?: "unknown",
                    fileUri = probe.uri,
                    fileSize = length,
                    lastModifiedAt = probe.mtime.takeIf { it > 0 } ?: now,
                    sha256 = null,
                    status = RecordingStatus.Pending,
                    createdAt = now,
                    updatedAt = now,
                )
                val tEnrich = System.currentTimeMillis()
                // Phase 6: upload API accepts null phone/direction — enrich kept, timed separately.
                val entity = RecordingCallMetadata.enrichEntity(
                    applicationContext,
                    base.fileName,
                    base,
                )
                enrichMs += System.currentTimeMillis() - tEnrich

                val tIns = System.currentTimeMillis()
                val rowId = runBlocking { dao.insert(entity) }
                insertMs += System.currentTimeMillis() - tIns
                if (rowId != -1L) insertedCount++
            } catch (e: Exception) {
                Log.e(TAG_SCAN, "insert failed run=$runId", e)
                // Per-file failure: continue others; do not advance checkpoint for the run.
                abortedDuringInsert = true
            }
        }

        progress.recordTiming("calllog_enrich_ms", enrichMs)
        progress.recordTiming("room_insert_ms", insertMs)
        progress.setPhase(ScanProgressStore.Phase.INSERT_DONE)
        progress.setCounts(inserted = insertedCount)
        progress.recordTiming("estimated_provider_calls", estimatedProviderCalls.toLong())

        val totalElapsed = System.currentTimeMillis() - startedAt
        Log.i(
            TAG_SCAN,
            "perf run=$runId totalMs=$totalElapsed files=${children.size} probes=${probes.size} " +
                "candidates=${finalCandidates.size} inserted=$insertedCount estIpc=$estimatedProviderCalls " +
                "timings=${progress.timingsJson()}",
        )

        val runOk = ScanEnqueuePolicy.mayAdvanceCheckpoint(
            runSucceeded = !abortedDuringInsert,
            timedOut = false,
            abortedDuringInsert = abortedDuringInsert,
        )

        // Checkpoint only after successful completion with no insert-path abort.
        if (runOk && mode == MODE_INCREMENTAL) {
            val nextCp = ScanCandidateLogic.nextCheckpoint(finalCandidates, checkpoint)
            if (nextCp != null && !nextCp.lastSeenUri.isNullOrEmpty()) {
                progress.advanceCheckpoint(nextCp.lastSeenTimestamp, nextCp.lastSeenUri!!)
            }
        } else if (runOk && mode == MODE_FULL_RECONCILE) {
            if (markReconcileComplete) {
                progress.markFullReconcileComplete()
                val newest = probes.sortedWith(ScanCandidateLogic.newestFirst()).firstOrNull()
                if (newest != null) {
                    progress.advanceCheckpoint(newest.rankingTimestamp, newest.uri)
                }
            } else if (nextReconcileCursor != null) {
                progress.setReconcileCursor(nextReconcileCursor)
            }
        }

        if (abortedDuringInsert) {
            progress.finish(ScanProgressStore.Result.FAILED)
            mark("scan failed partial inserts=$insertedCount (checkpoint unchanged)")
            SyncStatusTracker.onScanFinished(applicationContext, success = false, errorMsg = "insert_partial_fail")
            RecordingSyncTrigger.enqueueUpload(applicationContext)
            return Result.failure()
        }

        progress.finish(ScanProgressStore.Result.SUCCESS)
        mark(
            "scan complete inserted=$insertedCount hasMore=" +
                "${incrementalHasMore || nextReconcileCursor != null}",
        )
        SyncStatusTracker.onScanFinished(applicationContext, success = true)
        WorkerDebugStore(applicationContext).putLong(
            WorkerDebugStore.KEY_LAST_SCAN_SUCCESS_MS,
            System.currentTimeMillis(),
        )
        RecordingSyncTrigger.enqueueUpload(applicationContext)

        // P0: drain backlog without requiring another manual app open.
        when {
            mode == MODE_FULL_RECONCILE && nextReconcileCursor != null -> {
                RecordingSyncTrigger.enqueueScanContinue(
                    applicationContext,
                    mode = MODE_FULL_RECONCILE,
                )
            }
            mode == MODE_INCREMENTAL && incrementalHasMore -> {
                RecordingSyncTrigger.enqueueScanContinue(
                    applicationContext,
                    mode = MODE_INCREMENTAL,
                )
            }
        }
        return Result.success()
    }

    private fun isAudioFile(name: String?, type: String?): Boolean {
        val mime = type?.lowercase().orEmpty()
        if (mime.startsWith("audio/")) return true
        val n = name?.lowercase().orEmpty()
        return n.endsWith(".m4a") || n.endsWith(".mp3") || n.endsWith(".aac") ||
            n.endsWith(".wav") || n.endsWith(".3gp") || n.endsWith(".amr") || n.endsWith(".ogg")
    }

    companion object {
        const val KEY_MODE = "scan_mode"
        const val MODE_INCREMENTAL = "incremental"
        const val MODE_FULL_RECONCILE = "full_reconcile"
    }

    private object ScanWorkerDeps {
        fun get(context: Context): AppDatabase = AppDatabaseProvider.get(context)
    }
}
