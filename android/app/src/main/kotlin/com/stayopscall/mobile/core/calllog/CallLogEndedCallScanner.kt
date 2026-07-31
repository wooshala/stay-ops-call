package com.stayopscall.mobile.core.calllog

import android.content.Context
import android.provider.CallLog

object CallLogEndedCallScanner {
    private const val MIN_DURATION_SECONDS = 20
    private const val MAX_ROWS = 20

    fun scanRecentEndedCalls(context: Context, sinceMs: Long): List<EndedCallEvent> {
        if (!CallLogMatcher.hasCallLogPermission(context)) return emptyList()

        val cursor = context.contentResolver.query(
            CallLog.Calls.CONTENT_URI,
            arrayOf(
                CallLog.Calls._ID,
                CallLog.Calls.NUMBER,
                CallLog.Calls.DATE,
                CallLog.Calls.DURATION,
                CallLog.Calls.TYPE,
                CallLog.Calls.CACHED_NAME,
            ),
            "${CallLog.Calls.DATE} >= ? AND ${CallLog.Calls.DURATION} >= ?",
            arrayOf(sinceMs.toString(), MIN_DURATION_SECONDS.toString()),
            "${CallLog.Calls.DATE} DESC",
        ) ?: return emptyList()

        val results = mutableListOf<EndedCallEvent>()
        cursor.use {
            val idIdx = it.getColumnIndex(CallLog.Calls._ID)
            val numberIdx = it.getColumnIndex(CallLog.Calls.NUMBER)
            val dateIdx = it.getColumnIndex(CallLog.Calls.DATE)
            val durationIdx = it.getColumnIndex(CallLog.Calls.DURATION)
            val typeIdx = it.getColumnIndex(CallLog.Calls.TYPE)
            val nameIdx = it.getColumnIndex(CallLog.Calls.CACHED_NAME)
            if (idIdx < 0 || numberIdx < 0 || dateIdx < 0 || durationIdx < 0 || typeIdx < 0) {
                return emptyList()
            }

            while (it.moveToNext() && results.size < MAX_ROWS) {
                val direction = CallLogMatcher.mapDirection(it.getInt(typeIdx))
                if (direction != "inbound" && direction != "outbound") continue

                val rawNumber = it.getString(numberIdx)?.trim().orEmpty()
                val normalized = PhoneNormalizer.normalize(rawNumber) ?: continue
                val dateMs = it.getLong(dateIdx)
                val durationSec = it.getLong(durationIdx).toInt()
                if (durationSec < MIN_DURATION_SECONDS) continue

                val cachedName = if (nameIdx >= 0) {
                    it.getString(nameIdx)?.trim()?.takeIf { name -> name.isNotEmpty() }
                } else {
                    null
                }

                results.add(
                    EndedCallEvent(
                        callLogId = it.getLong(idIdx),
                        normalizedPhone = normalized,
                        contactName = cachedName,
                        startedAtMs = dateMs,
                        endedAtMs = dateMs + durationSec * 1000L,
                        durationSeconds = durationSec,
                        direction = direction,
                    ),
                )
            }
        }
        return results
    }
}
