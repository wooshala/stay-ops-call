package com.stayopscall.mobile.core.phone

import android.Manifest
import android.content.Context
import android.content.pm.PackageManager
import android.os.Build
import android.os.Handler
import android.os.HandlerThread
import android.telephony.PhoneStateListener
import android.telephony.TelephonyCallback
import android.telephony.TelephonyManager
import android.util.Log
import androidx.annotation.RequiresApi
import androidx.core.content.ContextCompat
import com.stayopscall.mobile.core.calllog.CallLogCallTaskMonitor
import com.stayopscall.mobile.core.calllog.IncomingCallState
import com.stayopscall.mobile.core.calllog.PhoneNormalizer
import com.stayopscall.mobile.core.relay.CallTaskRelayClient
import java.util.concurrent.Executor

object IncomingCallListener {
    private const val TAG = "StayOpsCallRelay"

    // HTTP relay 전용 background thread — main thread 차단 없이 network 가능
    private val bgThread = HandlerThread("IncomingRelayBg").also { it.start() }
    private val bgHandler = Handler(bgThread.looper)
    private val bgExecutor: Executor = Executor { cmd -> bgHandler.post(cmd) }

    // 강참조 보관 — anonymous object GC 방지
    @Volatile private var callbackRef: TelephonyCallback? = null
    @Volatile private var legacyListenerRef: PhoneStateListener? = null
    @Volatile private var registered = false

    // RINGING dedup: callback + legacy 둘 다 등록 시 한 번만 relay
    @Volatile private var lastRingingSentMs = 0L
    private const val RINGING_DEDUP_WINDOW_MS = 3_000L

    fun hasPermission(context: Context): Boolean =
        ContextCompat.checkSelfPermission(context, Manifest.permission.READ_PHONE_STATE) ==
            PackageManager.PERMISSION_GRANTED

    fun start(context: Context) {
        val appContext = context.applicationContext

        // 1. 권한 상태 전체 로그
        val hasReadPhoneState = ContextCompat.checkSelfPermission(
            appContext, Manifest.permission.READ_PHONE_STATE
        ) == PackageManager.PERMISSION_GRANTED
        val hasReadPhoneNumbers = ContextCompat.checkSelfPermission(
            appContext, Manifest.permission.READ_PHONE_NUMBERS
        ) == PackageManager.PERMISSION_GRANTED
        val hasReadCallLog = ContextCompat.checkSelfPermission(
            appContext, Manifest.permission.READ_CALL_LOG
        ) == PackageManager.PERMISSION_GRANTED
        Log.i(
            TAG,
            "[INCOMING_PERMISSION_STATE] READ_PHONE_STATE=$hasReadPhoneState" +
                " READ_PHONE_NUMBERS=$hasReadPhoneNumbers READ_CALL_LOG=$hasReadCallLog",
        )

        if (!hasReadPhoneState) {
            Log.w(TAG, "[INCOMING_LISTENER] READ_PHONE_STATE not granted — skipping")
            return
        }

        synchronized(this) {
            if (registered) return
            val tm = appContext.getSystemService(Context.TELEPHONY_SERVICE) as? TelephonyManager
            if (tm == null) {
                Log.w(TAG, "[INCOMING_LISTENER] TelephonyManager unavailable")
                return
            }
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
                registerCallback(appContext, tm)
                // API 31+에서도 legacy fallback 함께 등록 — 어느 쪽이 RINGING을 받는지 확인
                registerLegacyFallback(appContext, tm)
            } else {
                @Suppress("DEPRECATION")
                registerLegacyListener(appContext, tm)
            }
            registered = true
            Log.i(TAG, "[INCOMING_LISTENER] started apiLevel=${Build.VERSION.SDK_INT}")
        }
    }

    @RequiresApi(Build.VERSION_CODES.S)
    private fun registerCallback(context: Context, tm: TelephonyManager) {
        try {
            val cb = object : TelephonyCallback(), TelephonyCallback.CallStateListener {
                override fun onCallStateChanged(state: Int) {
                    Log.d(TAG, "[CALL_STATE_CHANGED] state=$state source=TelephonyCallback")
                    handleState(state, rawPhone = null, context = context, source = "callback")
                }
            }
            // mainExecutor: OEM 호환성 최우선
            tm.registerTelephonyCallback(context.mainExecutor, cb)
            callbackRef = cb
            Log.i(TAG, "[INCOMING_LISTENER] TelephonyCallback registered (API 31+) executor=mainExecutor")
        } catch (e: Exception) {
            Log.e(
                TAG,
                "[INCOMING_LISTENER_REGISTER_FAIL] type=${e.javaClass.simpleName} message=${e.message}",
            )
            callbackRef = null
        }
    }

    @Suppress("DEPRECATION")
    private fun registerLegacyFallback(context: Context, tm: TelephonyManager) {
        // API 31+에서 deprecated이지만 실기기에서 콜백이 안 오는 경우 fallback 진단용
        try {
            val listener = object : PhoneStateListener() {
                @Deprecated("Deprecated in Java")
                override fun onCallStateChanged(state: Int, phoneNumber: String?) {
                    Log.d(TAG, "[CALL_STATE_CHANGED_LEGACY] state=$state source=PhoneStateListener")
                    handleState(state, rawPhone = phoneNumber, context = context, source = "legacy")
                }
            }
            @Suppress("DEPRECATION")
            tm.listen(listener, PhoneStateListener.LISTEN_CALL_STATE)
            legacyListenerRef = listener
            Log.i(TAG, "[INCOMING_LISTENER] PhoneStateListener fallback registered")
        } catch (e: Exception) {
            Log.w(TAG, "[INCOMING_LISTENER] PhoneStateListener fallback failed: ${e.message}")
        }
    }

    @Suppress("DEPRECATION")
    private fun registerLegacyListener(context: Context, tm: TelephonyManager) {
        val listener = object : PhoneStateListener() {
            @Deprecated("Deprecated in Java")
            override fun onCallStateChanged(state: Int, phoneNumber: String?) {
                Log.d(TAG, "[CALL_STATE_CHANGED_LEGACY] state=$state source=PhoneStateListener")
                handleState(state, rawPhone = phoneNumber, context = context, source = "legacy")
            }
        }
        @Suppress("DEPRECATION")
        tm.listen(listener, PhoneStateListener.LISTEN_CALL_STATE)
        legacyListenerRef = listener
        Log.i(TAG, "[INCOMING_LISTENER] PhoneStateListener registered (API ≤30)")
    }

    private fun handleState(state: Int, rawPhone: String?, context: Context, source: String) {
        val apiLevel = Build.VERSION.SDK_INT
        when (state) {
            TelephonyManager.CALL_STATE_RINGING -> {
                Log.i(TAG, "[CALL_STATE_RINGING] source=$source apiLevel=$apiLevel")

                // callback + legacy 동시 등록 시 dedup — 3초 내 중복 relay 차단
                val now = System.currentTimeMillis()
                val shouldRelay = synchronized(this) {
                    if (now - lastRingingSentMs < RINGING_DEDUP_WINDOW_MS) {
                        false
                    } else {
                        lastRingingSentMs = now
                        true
                    }
                }
                if (!shouldRelay) {
                    Log.d(TAG, "[CALL_STATE_RINGING_DEDUP] source=$source skipped (already sent within ${RINGING_DEDUP_WINDOW_MS}ms)")
                    return
                }

                val startMs = now
                val normalized = PhoneNormalizer.normalize(rawPhone?.trim())
                val phoneMasked = normalized?.let { "***${it.takeLast(4)}" } ?: "null"
                val sourceEventId = "incoming:$startMs:${normalized ?: "unknown"}"

                Log.i(TAG, "[CALL_INCOMING_DETECTED] sourceEventId=$sourceEventId phone=$phoneMasked apiLevel=$apiLevel source=$source")

                if (normalized.isNullOrEmpty()) {
                    Log.w(TAG, "[CALL_PHONE_MISSING] sourceEventId=$sourceEventId apiLevel=$apiLevel source=$source")
                }

                IncomingCallState.record(normalized, sourceEventId, startMs)

                // HTTP는 반드시 bgExecutor에서 — main thread에서 호출하면 NetworkOnMainThreadException
                val capturedContext = context
                val capturedPhone = normalized
                val capturedSourceEventId = sourceEventId
                val capturedStartMs = startMs
                bgExecutor.execute {
                    CallTaskRelayClient.relayIncomingCall(
                        context = capturedContext,
                        phone = capturedPhone,
                        sourceEventId = capturedSourceEventId,
                        startedAtMs = capturedStartMs,
                    )
                }
            }

            TelephonyManager.CALL_STATE_OFFHOOK -> {
                Log.i(TAG, "[CALL_STATE_OFFHOOK] source=$source apiLevel=$apiLevel")
            }

            TelephonyManager.CALL_STATE_IDLE -> {
                Log.i(TAG, "[CALL_STATE_IDLE] source=$source apiLevel=$apiLevel")
                val unknownPending = IncomingCallState.hasUnknownPending()
                if (unknownPending != null) {
                    Log.w(
                        TAG,
                        "[CALL_INCOMING_IDLE_WITHOUT_CALLLOG] sourceEventId=${unknownPending.sourceEventId} apiLevel=$apiLevel",
                    )
                }
                // CallLog가 늦게 기록되는 기기 대응 — IDLE 직후 즉시+지연 재스캔
                val capturedContext = context
                CallLogCallTaskMonitor.scanAndRelay(capturedContext)
                bgHandler.postDelayed({ CallLogCallTaskMonitor.scanAndRelay(capturedContext) }, 3_000)
                bgHandler.postDelayed({ CallLogCallTaskMonitor.scanAndRelay(capturedContext) }, 8_000)
                bgHandler.postDelayed({ CallLogCallTaskMonitor.scanAndRelay(capturedContext) }, 15_000)
                Log.i(TAG, "[CALL_IDLE_SCAN_SCHEDULED] immediate+3s+8s+15s scheduled source=$source")
            }
        }
    }
}
