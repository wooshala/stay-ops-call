package com.stayopscall.mobile.data.local.entity

import androidx.room.Entity
import androidx.room.Index
import androidx.room.PrimaryKey

/**
 * Durable outbox for CallLog → /api/call-tasks/relay.
 * Unique on [androidCallLogId] (CallLog.Calls._ID) — stable device-local identity.
 */
@Entity(
    tableName = "call_log_outbox",
    indices = [
        Index(value = ["androidCallLogId"], unique = true),
        Index(value = ["status"]),
        Index(value = ["startedAtMs"]),
        Index(value = ["sourceEventId"]),
    ],
)
data class CallLogOutboxEntity(
    @PrimaryKey(autoGenerate = true) val id: Long = 0,
    val androidCallLogId: Long,
    /** Sticky once chosen; usually call-log:{id} or linked incoming:… */
    val sourceEventId: String,
    val phoneNumber: String,
    val contactName: String? = null,
    val direction: String,
    val startedAtMs: Long,
    val endedAtMs: Long,
    val durationSeconds: Int,
    val eventType: String = "ended",
    val status: String,
    val attemptCount: Int = 0,
    val lastAttemptAt: Long? = null,
    val lastError: String? = null,
    val createdAt: Long = System.currentTimeMillis(),
    val updatedAt: Long = System.currentTimeMillis(),
    val ackedAt: Long? = null,
    val nextAttemptAt: Long = 0L,
)
