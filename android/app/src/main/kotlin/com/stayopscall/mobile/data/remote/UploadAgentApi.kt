package com.stayopscall.mobile.data.remote

import okhttp3.MultipartBody
import okhttp3.RequestBody
import retrofit2.Response
import retrofit2.http.Multipart
import retrofit2.http.POST
import retrofit2.http.Part

/**
 * Upload agent API (server): POST /api/calls/upload (multipart)
 *
 * NOTE: This is intentionally separate from MobileApi (api/mobile paths).
*/
interface UploadAgentApi {
@Multipart
@POST("/api/calls/upload")
suspend fun uploadCall(
@Part file: MultipartBody.Part,
@Part("source_type") sourceType: RequestBody,
@Part("file_fingerprint") fileFingerprint: RequestBody,
@Part("device_id") deviceId: RequestBody,
@Part("original_file_name") originalFileName: RequestBody?,
@Part("mime_type") mimeType: RequestBody?,
@Part("started_at") startedAt: RequestBody?,
@Part("phone_number") phoneNumber: RequestBody?,
@Part("direction") direction: RequestBody?,
): Response<UploadCallResponse>
}

data class UploadCallResponse(
val ok: Boolean,
val duplicate: Boolean? = null,
val call_id: String? = null,
val error: String? = null,
)

data class UploadCallErrorResponse(
val ok: Boolean? = null,
val duplicate: Boolean? = null,
val call_id: String? = null,
val error: String? = null,
)