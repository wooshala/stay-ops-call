package com.stayopscall.mobile.core.calllog

import android.Manifest
import android.content.Context
import android.content.pm.PackageManager
import android.provider.CallLog
import androidx.core.content.ContextCompat
import kotlin.math.abs

data class CallLogMatchResult(
    val phoneNumber: String,
    val normalizedPhone: String,
    val direction: String,
    val callLogDate: Long,
    val callLogMatchDeltaSec: Int,
    val contactName: String?,
)

object CallLogMatcher {
    private const val WINDOW_MS = 5 * 60 * 1000L

    data class CallLogCandidate(
        val phoneNumber: String,
        val normalizedPhone: String,
        val direction: String,
        val date: Long,
        val duration: Long,
        val cachedName: String?,
    )

    fun hasCallLogPermission(context: Context): Boolean {
        return ContextCompat.checkSelfPermission(
            context,
            Manifest.permission.READ_CALL_LOG,
        ) == PackageManager.PERMISSION_GRANTED
    }

    fun match(
        context: Context,
        targetMs: Long,
        contactNameCandidate: String?,
    ): CallLogMatchResult? {
        if (!hasCallLogPermission(context)) return null

        val windowStart = targetMs - WINDOW_MS
        val windowEnd = targetMs + WINDOW_MS

        val cursor = context.contentResolver.query(
            CallLog.Calls.CONTENT_URI,
            arrayOf(
                CallLog.Calls.NUMBER,
                CallLog.Calls.DATE,
                CallLog.Calls.DURATION,
                CallLog.Calls.TYPE,
                CallLog.Calls.CACHED_NAME,
            ),
            "${CallLog.Calls.DATE} >= ? AND ${CallLog.Calls.DATE} <= ?",
            arrayOf(windowStart.toString(), windowEnd.toString()),
            "${CallLog.Calls.DATE} ASC",
        ) ?: return null

        val candidates = mutableListOf<CallLogCandidate>()
        cursor.use {
            val numberIdx = it.getColumnIndex(CallLog.Calls.NUMBER)
            val dateIdx = it.getColumnIndex(CallLog.Calls.DATE)
            val durationIdx = it.getColumnIndex(CallLog.Calls.DURATION)
            val typeIdx = it.getColumnIndex(CallLog.Calls.TYPE)
            val nameIdx = it.getColumnIndex(CallLog.Calls.CACHED_NAME)
            if (numberIdx < 0 || dateIdx < 0 || typeIdx < 0) return null

            while (it.moveToNext()) {
                val rawNumber = it.getString(numberIdx)?.trim().orEmpty()
                val normalized = PhoneNormalizer.normalize(rawNumber) ?: continue
                val date = it.getLong(dateIdx)
                val duration = if (durationIdx >= 0) it.getLong(durationIdx) else 0L
                val type = it.getInt(typeIdx)
                val cachedName = if (nameIdx >= 0) it.getString(nameIdx)?.trim()?.takeIf { n -> n.isNotEmpty() } else null
                candidates.add(
                    CallLogCandidate(
                        phoneNumber = rawNumber,
                        normalizedPhone = normalized,
                        direction = mapDirection(type),
                        date = date,
                        duration = duration,
                        cachedName = cachedName,
                    ),
                )
            }
        }

        val best = selectBestCandidate(candidates, targetMs) ?: return null
        val contactName = contactNameCandidate?.trim()?.takeIf { it.isNotEmpty() }
            ?: best.cachedName

        return CallLogMatchResult(
            phoneNumber = best.phoneNumber,
            normalizedPhone = best.normalizedPhone,
            direction = best.direction,
            callLogDate = best.date,
            callLogMatchDeltaSec = (abs(best.date - targetMs) / 1000).toInt(),
            contactName = contactName,
        )
    }

    internal fun selectBestCandidate(
        candidates: List<CallLogCandidate>,
        targetMs: Long,
    ): CallLogCandidate? {
        if (candidates.isEmpty()) return null
        return candidates.minWithOrNull(
            compareBy<CallLogCandidate>(
                { if (it.duration > 0) 0 else 1 },
                { abs(it.date - targetMs) },
            ),
        )
    }

    internal fun mapDirection(type: Int): String = when (type) {
        CallLog.Calls.OUTGOING_TYPE -> "outbound"
        CallLog.Calls.MISSED_TYPE,
        CallLog.Calls.REJECTED_TYPE,
        CallLog.Calls.BLOCKED_TYPE,
        -> "missed"
        else -> "inbound"
    }
}
