package com.stayopscall.mobile.core.calllog

import android.util.Log
import java.util.concurrent.ConcurrentHashMap

/**
 * 수신 전화 sourceEventId를 메모리에 보관.
 * CallLog ContentObserver가 종료 이벤트를 감지했을 때 같은 번호의 entry를 꺼내
 * 서버 upsert(ringing → pending)에 사용한다.
 */
object IncomingCallState {
    private const val TAG = "StayOpsCallRelay"
    private const val STALE_MS = 30 * 60 * 1000L // 30분

    data class Entry(val sourceEventId: String, val startedAtMs: Long)

    // normalizedPhone (번호 없으면 "UNKNOWN") → Entry
    private val pending = ConcurrentHashMap<String, Entry>()

    fun record(normalizedPhone: String?, sourceEventId: String, startedAtMs: Long) {
        val key = normalizedPhone?.takeIf { it.isNotEmpty() } ?: "UNKNOWN"
        pending[key] = Entry(sourceEventId, startedAtMs)
        clearStale()
    }

    /**
     * 해당 번호의 pending incoming entry를 꺼내 반환하고 삭제.
     * ended relay의 source_event_id로 사용해 서버 upsert를 유도한다.
     */
    fun consumeForPhone(normalizedPhone: String): String? {
        val entry = pending.remove(normalizedPhone) ?: return null
        Log.d(TAG, "[INCOMING_STATE_LINKED] sourceEventId=${entry.sourceEventId} phone=***${normalizedPhone.takeLast(4)}")
        return entry.sourceEventId
    }

    /** IDLE 시 번호 없는 pending 확인용 (부재중 감지) */
    fun hasUnknownPending(): Entry? = pending["UNKNOWN"]

    /**
     * phone=null로 수신된 incoming entry를 시간 기반으로 ended 통화에 연결.
     * ended 통화의 started_at과 UNKNOWN entry의 startedAtMs가 windowMs 이내이면 소비.
     */
    fun consumeUnknownIfRecent(callStartedAtMs: Long, windowMs: Long = 5 * 60 * 1000L): String? {
        val entry = pending["UNKNOWN"] ?: return null
        val timeDiff = Math.abs(entry.startedAtMs - callStartedAtMs)
        if (timeDiff > windowMs) {
            Log.d(TAG, "[INCOMING_STATE_UNKNOWN_TOO_OLD] diff=${timeDiff}ms window=${windowMs}ms — skipping")
            return null
        }
        val removed = pending.remove("UNKNOWN") ?: return null
        Log.i(TAG, "[INCOMING_STATE_UNKNOWN_LINKED] sourceEventId=${removed.sourceEventId} diff=${timeDiff}ms")
        return removed.sourceEventId
    }

    private fun clearStale() {
        val cutoff = System.currentTimeMillis() - STALE_MS
        val stale = pending.entries.filter { it.value.startedAtMs < cutoff }.map { it.key }
        for (key in stale) pending.remove(key)
    }
}
