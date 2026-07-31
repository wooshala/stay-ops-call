package com.stayopscall.mobile.core.calllog

data class EndedCallEvent(
    val callLogId: Long,
    val normalizedPhone: String,
    val contactName: String?,
    val startedAtMs: Long,
    val endedAtMs: Long,
    val durationSeconds: Int,
    val direction: String,
)
