package com.stayopscall.mobile.work

import android.content.Context
import android.net.Uri
import android.util.Log
import androidx.work.CoroutineWorker
import androidx.work.WorkerParameters
import com.stayopscall.mobile.BuildConfig
import com.stayopscall.mobile.core.calllog.RecordingCallMetadata
import com.stayopscall.mobile.core.device.DeviceIdentityProvider
import com.stayopscall.mobile.core.storage.WorkerDebugStore
import com.stayopscall.mobile.core.sync.CollectorRetryPolicy
import com.stayopscall.mobile.core.sync.SafRecordingUploadBody
import com.stayopscall.mobile.core.sync.SyncStatusTracker
import com.stayopscall.mobile.data.local.AppDatabaseProvider
import com.stayopscall.mobile.data.local.RecordingStatus
import com.stayopscall.mobile.data.local.dao.CallRecordingDao
import com.stayopscall.mobile.data.remote.UploadAgentApi
import com.stayopscall.mobile.data.remote.UploadCallErrorResponse
import com.squareup.moshi.Moshi
import com.squareup.moshi.kotlin.reflect.KotlinJsonAdapterFactory
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock
import okhttp3.MediaType.Companion.toMediaTypeOrNull
import okhttp3.MultipartBody
import okhttp3.OkHttpClient
import okhttp3.RequestBody
import okhttp3.logging.HttpLoggingInterceptor
import retrofit2.Retrofit
import retrofit2.converter.moshi.MoshiConverterFactory

class UploadQueueWorker(
    appContext: Context,
    workerParams: WorkerParameters,
) : CoroutineWorker(appContext, workerParams) {
    private val batchLimit = 10

    override suspend fun doWork(): Result = uploadMutex.withLock {
        val debugStore = WorkerDebugStore(applicationContext)
        Log.d("StayOpsUpload", "doWork() started")
        try {
            runUpload(debugStore)
        } catch (e: Exception) {
            Log.e("StayOpsUpload", "doWork failed", e)
            val ts = java.time.LocalTime.now().toString().substring(0, 5)
            debugStore.put(WorkerDebugStore.KEY_UPLOAD_LAST, "[$ts] 오류: ${e.message ?: e.javaClass.simpleName}")
            SyncStatusTracker.onUploadFinished(
                applicationContext,
                success = false,
                errorMsg = e.message ?: e.javaClass.simpleName,
            )
            Result.retry()
        }
    }

    private suspend fun runUpload(debugStore: WorkerDebugStore): Result {
        val now = System.currentTimeMillis()
        val deps = UploadWorkerDeps.get(applicationContext)
        val callRecordingDao = deps.callRecordingDao
        val uploadAgentApi = deps.uploadAgentApi
        val deviceIdentityProvider = deps.deviceIdentityProvider

        val stuckUploading = callRecordingDao.loadByStatuses(
            statuses = listOf(RecordingStatus.Uploading),
            limit = 100,
        )
        if (stuckUploading.isNotEmpty()) {
            Log.d("StayOpsUpload", "resetting ${stuckUploading.size} stuck Uploading items")
            stuckUploading.forEach { item ->
                callRecordingDao.update(
                    item.copy(status = RecordingStatus.Retryable, updatedAt = now, nextAttemptAt = 0L),
                )
            }
        }

        val pending = callRecordingDao.loadDue(
            statuses = RecordingStatus.drainStatuses,
            nowMs = now,
            limit = batchLimit,
        )
        Log.d("StayOpsUpload", "due=${pending.size}")
        if (pending.isEmpty()) {
            debugStore.put(WorkerDebugStore.KEY_UPLOAD_LAST, "완료: 업로드 대기 없음")
            SyncStatusTracker.onUploadFinished(applicationContext, success = true)
            return Result.success()
        }

        val token = BuildConfig.UPLOAD_AGENT_TOKEN
        if (token.isNullOrBlank()) {
            pending.forEach { item ->
                markFailure(callRecordingDao, item, "UPLOAD_AGENT_TOKEN missing", now)
            }
            debugStore.put(WorkerDebugStore.KEY_UPLOAD_LAST, "오류: 업로드 토큰 미설정 (AUTH_BLOCKED)")
            SyncStatusTracker.onUploadFinished(applicationContext, success = false, errorMsg = "UPLOAD_AGENT_TOKEN missing")
            return Result.retry()
        }

        var uploadedCount = 0
        var duplicateCount = 0
        var retryableCount = 0

        for (item in pending) {
            try {
                val itemUploading = item.copy(
                    status = RecordingStatus.Uploading,
                    updatedAt = System.currentTimeMillis(),
                    errorMessage = null,
                )
                callRecordingDao.update(itemUploading)
                val enriched = RecordingCallMetadata.enrichEntity(
                    applicationContext,
                    itemUploading.fileName,
                    itemUploading,
                )
                if (enriched != itemUploading) {
                    callRecordingDao.update(enriched.copy(updatedAt = System.currentTimeMillis()))
                }
                val uploadItem = enriched
                val uri = Uri.parse(uploadItem.fileUri)
                val mimeType = applicationContext.contentResolver.getType(uri) ?: "audio/m4a"
                val deviceId = deviceIdentityProvider.getOrCreateInstallationUuid()

                // Do not trust Room/SAF metadata fileSize for Content-Length (03C/03F).
                val fileBody =
                    SafRecordingUploadBody.fromStream(mimeType) {
                        applicationContext.contentResolver.openInputStream(uri)
                    }
                val filePart = MultipartBody.Part.createFormData("file", uploadItem.fileName, fileBody)

                fun textPartOrNull(value: String?): RequestBody? {
                    val v = value?.trim()
                    if (v.isNullOrEmpty()) return null
                    return RequestBody.create("text/plain".toMediaTypeOrNull(), v)
                }

                fun intPartOrNull(value: Int?): RequestBody? {
                    if (value == null) return null
                    return RequestBody.create("text/plain".toMediaTypeOrNull(), value.toString())
                }

                val sourceType = RequestBody.create("text/plain".toMediaTypeOrNull(), "android_agent")
                val fp = RequestBody.create("text/plain".toMediaTypeOrNull(), uploadItem.sha256 ?: uploadItem.fileUri)
                val devId = RequestBody.create("text/plain".toMediaTypeOrNull(), deviceId)
                val startedAtMs = uploadItem.recordedAtFromFilename ?: uploadItem.lastModifiedAt
                val callLogMatchedAtIso = uploadItem.callLogMatchedAt?.let {
                    java.time.Instant.ofEpochMilli(it).toString()
                }

                val resp = uploadAgentApi.uploadCall(
                    file = filePart,
                    sourceType = sourceType,
                    fileFingerprint = fp,
                    deviceId = devId,
                    originalFileName = textPartOrNull(uploadItem.fileName),
                    mimeType = textPartOrNull(mimeType),
                    startedAt = textPartOrNull(java.time.Instant.ofEpochMilli(startedAtMs).toString()),
                    phoneNumber = textPartOrNull(RecordingCallMetadata.resolveUploadPhone(uploadItem)),
                    direction = textPartOrNull(uploadItem.direction),
                    contactName = textPartOrNull(uploadItem.contactName),
                    callLogMatchedAt = textPartOrNull(callLogMatchedAtIso),
                    callLogMatchDeltaSec = intPartOrNull(uploadItem.callLogMatchDeltaSec),
                    durationSec = intPartOrNull(uploadItem.durationSec?.takeIf { it > 0 }),
                )
                val doneAt = System.currentTimeMillis()
                when {
                    resp.code() == 409 -> {
                        val parsed = parseUploadError(resp.errorBody()?.string())
                        callRecordingDao.update(
                            itemUploading.copy(
                                status = RecordingStatus.Duplicate,
                                remoteCallId = parsed?.call_id,
                                remoteStatus = "duplicate",
                                errorMessage = null,
                                updatedAt = doneAt,
                                nextAttemptAt = 0L,
                            ),
                        )
                        duplicateCount++
                        debugStore.putLong(WorkerDebugStore.KEY_LAST_UPLOAD_SUCCESS_MS, doneAt)
                    }
                    resp.isSuccessful -> {
                        val body = resp.body()
                        if (body?.ok == true && body.call_id != null) {
                            callRecordingDao.update(
                                itemUploading.copy(
                                    status = RecordingStatus.Synced,
                                    remoteCallId = body.call_id,
                                    remoteStatus = "uploaded",
                                    updatedAt = doneAt,
                                    nextAttemptAt = 0L,
                                ),
                            )
                            uploadedCount++
                            debugStore.putLong(WorkerDebugStore.KEY_LAST_UPLOAD_SUCCESS_MS, doneAt)
                        } else {
                            throw IllegalStateException("upload ok but response invalid: $body")
                        }
                    }
                    else -> throw IllegalStateException("HTTP ${resp.code()}")
                }
            } catch (e: Exception) {
                val resolvedError = when (e) {
                    is java.io.FileNotFoundException -> "FILE_NOT_FOUND: ${e.message}"
                    is java.net.UnknownHostException -> "DNS_FAIL: ${e.message}"
                    is java.net.ConnectException -> "CONNECT_FAIL: ${e.message}"
                    is java.io.IOException -> "RETRYABLE_IO: ${e.message}"
                    else -> e.message ?: "Upload worker unknown error"
                }
                Log.e("StayOpsUpload", "item failed id=${item.id}: $resolvedError", e)
                markFailure(callRecordingDao, item, resolvedError, System.currentTimeMillis())
                retryableCount++
            }
        }

        val ts = java.time.LocalTime.now().toString().substring(0, 5)
        val summary = "[$ts] 업로드 ${uploadedCount}건, 중복 ${duplicateCount}건, 재시도 ${retryableCount}건 (처리 ${pending.size}건)"
        debugStore.put(WorkerDebugStore.KEY_UPLOAD_LAST, summary)
        if (retryableCount > 0) {
            SyncStatusTracker.onUploadFinished(applicationContext, success = false, errorMsg = summary)
            return Result.retry()
        }
        SyncStatusTracker.onUploadFinished(applicationContext, success = true)
        return Result.success()
    }

    private suspend fun markFailure(
        callRecordingDao: CallRecordingDao,
        item: com.stayopscall.mobile.data.local.entity.CallRecordingEntity,
        error: String?,
        nowMs: Long,
    ) {
        if (item.status == RecordingStatus.FailedUpload) return
        val attempts = item.retryCount + 1
        val outcome = CollectorRetryPolicy.classifyErrorText(error)
        val (status, nextAttemptAt) = when (outcome) {
            CollectorRetryPolicy.Outcome.PERMANENT ->
                RecordingStatus.FailedPermanent to Long.MAX_VALUE
            CollectorRetryPolicy.Outcome.AUTH_BLOCKED ->
                RecordingStatus.AuthBlocked to CollectorRetryPolicy.authNextAttemptAt(nowMs)
            CollectorRetryPolicy.Outcome.RETRYABLE ->
                RecordingStatus.Retryable to CollectorRetryPolicy.nextAttemptAt(attempts, nowMs)
            CollectorRetryPolicy.Outcome.ACK -> RecordingStatus.Synced to 0L
        }
        callRecordingDao.update(
            item.copy(
                status = status,
                retryCount = attempts,
                errorMessage = error,
                updatedAt = nowMs,
                nextAttemptAt = nextAttemptAt,
            ),
        )
    }

    private fun parseUploadError(raw: String?): UploadCallErrorResponse? {
        if (raw.isNullOrBlank()) return null
        val moshi = UploadWorkerDeps.get(applicationContext).moshi
        return runCatching { moshi.adapter(UploadCallErrorResponse::class.java).fromJson(raw) }.getOrNull()
    }

    companion object {
        private val uploadMutex = Mutex()
    }

    private object UploadWorkerDeps {
        @Volatile private var instance: Deps? = null

        data class Deps(
            val callRecordingDao: CallRecordingDao,
            val moshi: Moshi,
            val uploadAgentApi: UploadAgentApi,
            val deviceIdentityProvider: DeviceIdentityProvider,
        )

        fun get(context: Context): Deps {
            instance?.let { return it }
            synchronized(this) {
                instance?.let { return it }
                val appContext = context.applicationContext
                val moshi = Moshi.Builder().add(KotlinJsonAdapterFactory()).build()
                val db = AppDatabaseProvider.get(appContext)
                val logging = HttpLoggingInterceptor().apply {
                    level = HttpLoggingInterceptor.Level.BASIC
                }
                val uploadClient = OkHttpClient.Builder()
                    .connectTimeout(120, java.util.concurrent.TimeUnit.SECONDS)
                    .readTimeout(180, java.util.concurrent.TimeUnit.SECONDS)
                    .writeTimeout(180, java.util.concurrent.TimeUnit.SECONDS)
                    .addInterceptor { chain ->
                        val request = chain.request()
                        val token = BuildConfig.UPLOAD_AGENT_TOKEN
                        if (token.isNullOrBlank()) {
                            chain.proceed(request)
                        } else {
                            chain.proceed(request.newBuilder().header("Authorization", "Bearer $token").build())
                        }
                    }
                    .addInterceptor(logging)
                    .build()
                val retrofit = Retrofit.Builder()
                    .baseUrl(BuildConfig.UPLOAD_BASE_URL)
                    .client(uploadClient)
                    .addConverterFactory(MoshiConverterFactory.create(moshi))
                    .build()
                val deps = Deps(
                    callRecordingDao = db.callRecordingDao(),
                    moshi = moshi,
                    uploadAgentApi = retrofit.create(UploadAgentApi::class.java),
                    deviceIdentityProvider = DeviceIdentityProvider(appContext),
                )
                instance = deps
                return deps
            }
        }
    }
}
