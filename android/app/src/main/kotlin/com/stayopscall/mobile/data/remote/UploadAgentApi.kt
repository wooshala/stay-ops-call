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
@Part("contact_name") contactName: RequestBody?,
@Part("call_log_matched_at") callLogMatchedAt: RequestBody?,
@Part("call_log_match_delta_sec") callLogMatchDeltaSec: RequestBody?,
/**
 * CallLog.Calls.DURATION — **초 단위 정수**. 서버는 `calls.duration_sec` 로 저장한다.
 * 값을 모르면 part 를 생략(null)한다. 0 으로 위장하지 않는다.
 * relay 의 `duration_seconds` 와 이름이 다르므로 혼동 금지.
 */
@Part("duration_sec") durationSec: RequestBody?,
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