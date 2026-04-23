package com.stayopscall.mobile.work

import android.content.Context
import android.net.Uri
import android.util.Log
import androidx.room.Room
import androidx.work.CoroutineWorker
import androidx.work.WorkerParameters
import com.stayopscall.mobile.BuildConfig
import com.stayopscall.mobile.core.device.DeviceIdentityProvider
import com.stayopscall.mobile.core.storage.WorkerDebugStore
import com.stayopscall.mobile.data.local.RecordingStatus
import com.stayopscall.mobile.data.local.AppDatabase
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
import okio.BufferedSink
import retrofit2.Retrofit
import retrofit2.converter.moshi.MoshiConverterFactory

/**
 * Upload worker instantiated by WorkManager directly (no Hilt).
 *
 * NOTE: This uses a small service-locator for its dependencies to avoid WorkerFactory injection issues.
 */
class UploadQueueWorker(
    appContext: Context,
    workerParams: WorkerParameters
) : CoroutineWorker(appContext, workerParams) {
    private val maxRetryCount = 3
    private val testProcessLimit = 10

    companion object {
        // 강제 동시성 1: WorkManager 중복 실행/레이스 방지 (프로세스 내)
        private val uploadMutex = Mutex()
    }

    override suspend fun doWork(): Result {
        return uploadMutex.withLock {
        val debugStore = WorkerDebugStore(applicationContext)
        Log.d("StayOpsUpload", "doWork() started")

        try {
            val deps = UploadWorkerDeps.get(applicationContext)
            val callRecordingDao = deps.callRecordingDao
            val uploadAgentApi = deps.uploadAgentApi
            val deviceIdentityProvider = deps.deviceIdentityProvider
            val moshi = deps.moshi

            // Items left in Uploading from a previous crashed run — reset so they retry.
            val stuckUploading = callRecordingDao.loadByStatuses(
                statuses = listOf(RecordingStatus.Uploading),
                limit = 100
            )
            if (stuckUploading.isNotEmpty()) {
                Log.d("StayOpsUpload", "resetting ${stuckUploading.size} stuck Uploading items")
                val now = System.currentTimeMillis()
                stuckUploading.forEach { item ->
                    callRecordingDao.update(item.copy(status = RecordingStatus.Pending, updatedAt = now))
                }
            }

            val pendingAll = callRecordingDao.loadByStatuses(
                statuses = listOf(RecordingStatus.Pending, RecordingStatus.RetryPending),
                limit = testProcessLimit
            )
            val pending = pendingAll.take(testProcessLimit)
            Log.d("StayOpsUpload", "pending=${pending.size}")

            if (pending.isEmpty()) {
                debugStore.put(WorkerDebugStore.KEY_UPLOAD_LAST, "완료: 업로드 대기 없음")
                return Result.success()
            }

            val token = BuildConfig.UPLOAD_AGENT_TOKEN
            if (token.isNullOrBlank()) {
                Log.e("StayOpsUpload", "UPLOAD_AGENT_TOKEN missing")
                pending.forEach { item ->
                    markFailedWithRetryPolicy(callRecordingDao, item, "UPLOAD_AGENT_TOKEN missing")
                }
                debugStore.put(WorkerDebugStore.KEY_UPLOAD_LAST, "오류: 업로드 토큰 미설정")
                return Result.failure()
            }

            var uploadedCount = 0
            var duplicateCount = 0
            var failedCount = 0
            var permanentFailedCount = 0

            for (item in pending) {
                Log.d("StayOpsUpload", "uploading id=${item.id} file=${item.fileName}")
                try {
                    val itemUploading = item.copy(
                        status = RecordingStatus.Uploading,
                        updatedAt = System.currentTimeMillis(),
                        errorMessage = null
                    )
                    callRecordingDao.update(itemUploading)

                    val uri = Uri.parse(item.fileUri)
                    val mimeType = applicationContext.contentResolver.getType(uri) ?: "audio/m4a"
                    val deviceId = deviceIdentityProvider.getOrCreateInstallationUuid()

                    // file part (streaming)
                    val fileBody = object : RequestBody() {
                        override fun contentType() = mimeType.toMediaTypeOrNull()
                        override fun contentLength(): Long = item.fileSize
                        override fun writeTo(sink: BufferedSink) {
                            applicationContext.contentResolver.openInputStream(uri)?.use { input ->
                                val buffer = ByteArray(DEFAULT_BUFFER_SIZE)
                                while (true) {
                                    val read = input.read(buffer)
                                    if (read <= 0) break
                                    sink.write(buffer, 0, read)
                                }
                            } ?: throw IllegalStateException("Cannot open file stream")
                        }
                    }
                    val filePart = MultipartBody.Part.createFormData("file", item.fileName, fileBody)

                    fun textPartOrNull(value: String?): RequestBody? {
                        val v = value?.trim()
                        if (v.isNullOrEmpty()) return null
                        return RequestBody.create("text/plain".toMediaTypeOrNull(), v)
                    }

                    val sourceType = RequestBody.create("text/plain".toMediaTypeOrNull(), "android_agent")
                    // TODO: sha256 null = scan 단계에서 계산 생략. 업로드 시 fileUri를 임시 fingerprint로 사용
                    val fp = RequestBody.create("text/plain".toMediaTypeOrNull(), item.sha256 ?: item.fileUri)
                    val devId = RequestBody.create("text/plain".toMediaTypeOrNull(), deviceId)

                    Log.d("StayOpsUpload", "sending id=${item.id}")
                    val resp = uploadAgentApi.uploadCall(
                        file = filePart,
                        sourceType = sourceType,
                        fileFingerprint = fp,
                        deviceId = devId,
                        originalFileName = textPartOrNull(item.fileName),
                        mimeType = textPartOrNull(mimeType),
                        // ISO timestamp is optional; best-effort from lastModified
                        startedAt = textPartOrNull(java.time.Instant.ofEpochMilli(item.lastModifiedAt).toString()),
                        phoneNumber = null,
                        direction = null,
                    )

                    val now = System.currentTimeMillis()
                    Log.d("StayOpsUpload", "response ${resp.code()} id=${item.id}")

                    if (resp.code() == 409) {
                        val raw = resp.errorBody()?.string()
                        val parsed = parseUploadError(raw)
                        val callId = parsed?.call_id
                        val parsedOk = parsed != null
                        val callIdPresent = !callId.isNullOrBlank()

                        // 409 is defined as duplicate in this API. Body is best-effort for call_id only.
                        android.util.Log.w(
                            "UploadQueueWorker",
                            "HTTP 409 received; parsed_duplicate_body=${if (parsedOk) "success" else "fail"}; call_id_present=$callIdPresent",
                        )
                        if (parsedOk && parsed?.duplicate != true) {
                            android.util.Log.w("UploadQueueWorker", "unexpected_409_body")
                        }

                        callRecordingDao.update(
                            itemUploading.copy(
                                status = RecordingStatus.Duplicate,
                                remoteCallId = if (callIdPresent) callId else null,
                                remoteStatus = "duplicate",
                                errorMessage = if (parsedOk && parsed?.duplicate != true) "unexpected_409_body" else null,
                                updatedAt = now
                            )
                        )
                        duplicateCount++
                    } else if (resp.isSuccessful) {
                        val body = resp.body()
                        if (body?.ok == true && body.call_id != null) {
                            callRecordingDao.update(
                                itemUploading.copy(
                                    status = RecordingStatus.Synced,
                                    remoteCallId = body.call_id,
                                    remoteStatus = "uploaded",
                                    updatedAt = now
                                )
                            )
                            uploadedCount++
                        } else {
                            throw IllegalStateException("upload ok but response invalid: $body")
                        }
                    } else {
                        val code = resp.code()
                        if (code in listOf(500, 502, 503, 504)) {
                            throw IllegalStateException("RETRYABLE_HTTP_$code")
                        }
                        val parsed = parseUploadError(resp.errorBody()?.string())
                        throw IllegalStateException("UPLOAD_FAILED_HTTP_$code: ${parsed?.error ?: "unknown"}")
                    }
                } catch (e: Exception) {
                    val resolvedError = when {
                        e is java.net.UnknownHostException -> "DNS_FAIL: ${e.message}"
                        e is java.net.ConnectException -> "CONNECT_FAIL: ${e.message}"
                        e is java.io.IOException -> "RETRYABLE_IO: ${e.message}"
                        e.message?.contains("RETRYABLE_HTTP_") == true -> e.message
                        else -> e.message ?: "Upload worker unknown error"
                    }
                    Log.e("StayOpsUpload", "item failed id=${item.id}: $resolvedError", e)
                    failedCount++
                    val becamePermanent = markFailedWithRetryPolicy(callRecordingDao, item, resolvedError)
                    if (becamePermanent) permanentFailedCount++
                }
            }

            val ts = java.time.LocalTime.now().toString().substring(0, 5)
            val summary = "[$ts] 업로드 $uploadedCount건, 중복 $duplicateCount건, 실패 $failedCount건 (전체 ${pending.size}건)"
            Log.d("StayOpsUpload", "done: uploaded=$uploadedCount dup=$duplicateCount failed=$failedCount")
            debugStore.put(WorkerDebugStore.KEY_UPLOAD_LAST, summary)
            if (failedCount > 0) return Result.retry()
            return Result.success()
        } catch (e: Exception) {
            Log.e("StayOpsUpload", "doWork failed", e)
            val ts = java.time.LocalTime.now().toString().substring(0, 5)
            debugStore.put(WorkerDebugStore.KEY_UPLOAD_LAST, "[$ts] 오류: ${e.message ?: e.javaClass.simpleName}")
            return Result.failure()
        }
        }
    }

    private suspend fun markFailedWithRetryPolicy(
        callRecordingDao: CallRecordingDao,
        item: com.stayopscall.mobile.data.local.entity.CallRecordingEntity,
        error: String?
    ): Boolean {
        val nextRetryCount = item.retryCount + 1
        val isPermanentFailure = nextRetryCount >= maxRetryCount
        callRecordingDao.update(
            item.copy(
                status = if (isPermanentFailure) RecordingStatus.FailedUpload else RecordingStatus.RetryPending,
                retryCount = nextRetryCount,
                errorMessage = error,
                updatedAt = System.currentTimeMillis()
            )
        )
        return isPermanentFailure
    }

    // NOTE: Upload agent endpoint is separate from /api/mobile/* and does not use mobile refresh flow.

    private fun parseUploadError(raw: String?): UploadCallErrorResponse? {
        if (raw.isNullOrBlank()) return null
        val moshi = UploadWorkerDeps.get(applicationContext).moshi
        return runCatching { moshi.adapter(UploadCallErrorResponse::class.java).fromJson(raw) }.getOrNull()
    }

    private object UploadWorkerDeps {
        @Volatile private var instance: Deps? = null

        data class Deps(
            val db: AppDatabase,
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

                val moshi = Moshi.Builder()
                    .add(KotlinJsonAdapterFactory())
                    .build()

                val db = Room.databaseBuilder(appContext, AppDatabase::class.java, "stay_ops_call.db")
                    .addMigrations(AppDatabase.MIGRATION_1_2, AppDatabase.MIGRATION_2_3)
                    .build()

                val logging = HttpLoggingInterceptor().apply {
                    level = HttpLoggingInterceptor.Level.BASIC
                }
                val uploadClient = OkHttpClient.Builder()
                    .addInterceptor { chain ->
                        val request = chain.request()
                        val token = BuildConfig.UPLOAD_AGENT_TOKEN
                        if (token.isNullOrBlank()) {
                            chain.proceed(request)
                        } else {
                            chain.proceed(
                                request.newBuilder()
                                    .header("Authorization", "Bearer $token")
                                    .build()
                            )
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
                    db = db,
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
