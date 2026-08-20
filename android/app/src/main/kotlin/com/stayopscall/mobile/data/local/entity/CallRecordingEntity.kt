package com.stayopscall.mobile.data.local.entity

import androidx.room.Entity
import androidx.room.Index
import androidx.room.PrimaryKey

@Entity(
    tableName = "call_recordings",
    indices = [
        Index(name = "index_call_recordings_fileUri", value = ["fileUri"], unique = true),
        Index(value = ["sha256"], unique = true),
        Index(value = ["status"]),
        Index(value = ["createdAt"])
    ]
)
data class CallRecordingEntity(
    @PrimaryKey(autoGenerate = true) val id: Long = 0,
    val fileName: String,
    val fileUri: String,
    val fileSize: Long,
    val lastModifiedAt: Long,
    val sha256: String?,
    val status: String,
    val retryCount: Int = 0,
    val remoteCallId: String? = null,
    val remoteStatus: String? = null,
    val errorMessage: String? = null,
    val phoneNumber: String? = null,
    val normalizedPhone: String? = null,
    val direction: String? = null,
    val contactName: String? = null,
    val recordedAtFromFilename: Long? = null,
    val callLogMatchedAt: Long? = null,
    val callLogMatchDeltaSec: Int? = null,
    /** CallLog.Calls.DURATION — 초 단위. 업로드 시 multipart `duration_sec` 로 전송 */
    val durationSec: Int? = null,
    val createdAt: Long = System.currentTimeMillis(),
    val updatedAt: Long = System.currentTimeMillis(),
    val nextAttemptAt: Long = 0L,
)
